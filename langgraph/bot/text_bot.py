# langchain_bot_pinecone.py — General Ask-Anything RAG (idempotent, multi-query, RRF, v3-safe)

import os
import time
import argparse
import hashlib
from typing import List, Dict, Any, Iterable

from dotenv import load_dotenv
load_dotenv()

# -------- Loaders & chunking --------
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document

# -------- Embeddings (remote HF) --------
from langchain_huggingface import HuggingFaceEndpointEmbeddings
EMB_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
EXPECTED_DIM = 384
embeddings = HuggingFaceEndpointEmbeddings(
    model=EMB_MODEL,
    task="feature-extraction",
    huggingfacehub_api_token=os.getenv("HUGGINGFACEHUB_API_TOKEN"),
)

# -------- LLM (Groq) --------
from langchain_groq import ChatGroq
llm = ChatGroq(
    model_name="llama-3.3-70b-versatile",
    temperature=0.0,
    groq_api_key=os.getenv("GROQ_API_KEY"),
)

# -------- Pinecone (v3) --------
from pinecone import Pinecone, ServerlessSpec

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_ENV_REGION = os.getenv("PINECONE_ENV_REGION", "us-east-1")
INDEX_NAME = os.getenv("PINECONE_INDEX", "pdf-rag-index")
if not PINECONE_API_KEY:
    raise RuntimeError("PINECONE_API_KEY missing from .env")

pc = Pinecone(api_key=PINECONE_API_KEY)

def _index_names() -> List[str]:
    names: List[str] = []
    for x in pc.list_indexes():
        name = getattr(x, "name", None) or (x.get("name") if isinstance(x, dict) else None)
        if name:
            names.append(name)
    return names

# Create index if needed (serverless)
if INDEX_NAME not in _index_names():
    print(f"Creating Pinecone index '{INDEX_NAME}' (dim={EXPECTED_DIM}, cosine) …")
    pc.create_index(
        name=INDEX_NAME,
        dimension=EXPECTED_DIM,
        metric="cosine",
        spec=ServerlessSpec(cloud="aws", region=PINECONE_ENV_REGION),
    )
    while not pc.describe_index(INDEX_NAME).status["ready"]:
        time.sleep(0.4)
    print("✅ Pinecone index is ready.")

index = pc.Index(INDEX_NAME)

# -------- Helpers --------
def sha1_bytes(b: bytes) -> str:
    return hashlib.sha1(b).hexdigest()

def sha1_of_file(path: str) -> str:
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1_048_576), b""):
            h.update(chunk)
    return h.hexdigest()

def deterministic_id(file_sha1: str, page: int | None, text: str) -> str:
    text_hash = sha1_bytes(text.encode("utf-8"))[:10]
    return f"{file_sha1}-{page if page is not None else 'NA'}-{text_hash}"

def response_matches(res) -> List[Dict[str, Any]]:
    if hasattr(res, "matches"):
        return res.matches or []
    if isinstance(res, dict):
        return res.get("matches", []) or []
    return []

def fetch_vectors(ids: Iterable[str], namespace: str) -> Dict[str, Any]:
    ids = list(ids)
    if not ids:
        return {}
    resp = index.fetch(ids=ids, namespace=namespace)
    if isinstance(resp, dict):
        return resp.get("vectors", {}) or {}
    return getattr(resp, "vectors", {}) or {}

def fetch_one(id_: str, namespace: str, retries: int = 8, delay: float = 0.6) -> Dict[str, Any] | None:
    for _ in range(retries):
        vecs = fetch_vectors([id_], namespace)
        vrec = vecs.get(id_)
        if vrec:
            return vrec
        time.sleep(delay)
    return None

def load_and_chunk(file_path: str) -> List[Document]:
    """Load PDF or text-like files and split into chunks. Ensures text docs have 'page' metadata."""
    ext = os.path.splitext(file_path)[1].lower()

    # 1) Load
    if ext == ".pdf":
        docs = PyPDFLoader(file_path).load()
    elif ext in {".txt", ".log", ".md", ".csv"}:
        # Try TextLoader with autodetect; fallback to manual decoding if needed.
        try:
            docs = TextLoader(file_path, encoding="utf-8", autodetect_encoding=True).load()
        except Exception:
            with open(file_path, "rb") as f:
                raw = f.read()

            text = None
            for enc in ("utf-8-sig", "utf-16", "utf-16le", "utf-16be", "cp1252", "latin-1"):
                try:
                    text = raw.decode(enc)
                    break
                except Exception:
                    continue
            if text is None:
                text = raw.decode("utf-8", errors="ignore")

            docs = [Document(page_content=text, metadata={"source_file": os.path.basename(file_path)})]
    else:
        raise ValueError(f"Unsupported file type: {ext}. Use .pdf or .txt/.md/.log/.csv")

    # 2) Chunk
    splitter = RecursiveCharacterTextSplitter(chunk_size=1200, chunk_overlap=150)
    chunks = splitter.split_documents(docs)

    # For non-PDFs, assign a 1-based "page" per chunk so metadata is never None
    if ext != ".pdf":
        for i, doc in enumerate(chunks):
            md = dict(doc.metadata or {})
            md["page"] = i + 1
            doc.metadata = md

    return chunks

def embed_texts(texts: List[str]) -> List[List[float]]:
    vecs = embeddings.embed_documents(texts)
    if not vecs or len(vecs[0]) != EXPECTED_DIM:
        raise RuntimeError(f"Unexpected embedding size: {len(vecs[0]) if vecs else 'N/A'} (expected {EXPECTED_DIM}).")
    return vecs

def format_ctx(hits: List[Dict[str, Any]]) -> str:
    parts = []
    for m in hits:
        md = (m.get("metadata") if isinstance(m, dict) else getattr(m, "metadata", {})) or {}
        page = md.get("page", "NA")
        text = md.get("text", "")
        parts.append(f"[p.{page}] {text}")
    return "\n\n---\n\n".join(parts)

def multi_query_variants(question: str, n: int = 4) -> List[str]:
    """Use the LLM to generate neutral reformulations (no fine-tuning)."""
    prompt = (
        "Rewrite the user question into {} semantically different but faithful variants, "
        "one per line, without numbering. Keep them short and generic.\n\n"
        "User question:\n{}\n"
    ).format(n, question)
    out = llm.invoke(prompt).content.strip()
    lines = [ln.strip("- •\t ") for ln in out.splitlines() if ln.strip()]
    uniq: List[str] = []
    seen = set()
    for q in [question] + lines:
        ql = q.lower()
        if ql not in seen:
            uniq.append(q)
            seen.add(ql)
    return uniq[: n + 1]  # original + n variants

def rrf_combine(result_lists: List[List[Dict[str, Any]]], k: int = 60, top_k: int = 8) -> List[Dict[str, Any]]:
    """Reciprocal Rank Fusion to merge multiple result lists."""
    scores: Dict[str, float] = {}
    best_meta: Dict[str, Dict[str, Any]] = {}
    for results in result_lists:
        for rank, m in enumerate(results, start=1):
            mid = getattr(m, "id", None) or (m.get("id") if isinstance(m, dict) else None)
            if not mid:
                continue
            scores[mid] = scores.get(mid, 0.0) + 1.0 / (k + rank)
            md = getattr(m, "metadata", None) or (m.get("metadata") if isinstance(m, dict) else None)
            best_meta[mid] = md
    merged = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:top_k]
    out = []
    for mid, _ in merged:
        out.append({"id": mid, "metadata": best_meta.get(mid, {}), "score": scores[mid]})
    return out

def pinecone_query(vector: List[float], namespace: str, top_k: int = 6):
    return index.query(
        vector=vector,
        top_k=top_k,
        include_values=False,
        include_metadata=True,
        namespace=namespace
    )

def ensure_namespace(ids: List[str], texts: List[str], metas: List[Dict[str, Any]], namespace: str):
    """Idempotent ingest: only embed & upsert missing ids."""
    print(f"Checking which of {len(ids)} chunks already exist in namespace …")
    existing_ids: set[str] = set()
    BATCH = 100
    for i in range(0, len(ids), BATCH):
        batch_ids = ids[i:i+BATCH]
        vecs = fetch_vectors(batch_ids, namespace)
        existing_ids.update(vecs.keys())

    missing_idx = [i for i, id_ in enumerate(ids) if id_ not in existing_ids]
    if not missing_idx:
        print(f"♻️ All {len(ids)} chunks already exist; skipping re-embed/upsert.")
        return

    miss_ids = [ids[i] for i in missing_idx]
    miss_texts = [texts[i] for i in missing_idx]
    miss_metas = [metas[i] for i in missing_idx]

    print(f"Embedding {len(miss_ids)} new chunk(s) via HF Inference API …")
    miss_vecs = embed_texts(miss_texts)
    vectors = [{"id": miss_ids[i], "values": miss_vecs[i], "metadata": miss_metas[i]} for i in range(len(miss_ids))]
    print(f"Upserting {len(vectors)} vectors to Pinecone namespace='{namespace}' …")
    upsert_resp = index.upsert(vectors=vectors, namespace=namespace)
    print("🔁 Upsert response:", upsert_resp)

    # Prove visibility for at least one id (eventual consistency safe)
    probe_id = miss_ids[0]
    vrec = fetch_one(probe_id, namespace, retries=10, delay=0.7)
    if not vrec:
        raise RuntimeError(
            f"Fetch failed for id '{probe_id}' in namespace '{namespace}' after upsert. "
            "Double-check INDEX_NAME, namespace, and API key/workspace."
        )
    print(f"🔍 Fetch OK for id '{probe_id}' in namespace '{namespace}'.")

# -------- CLI --------
parser = argparse.ArgumentParser()
parser.add_argument("--file", default=os.getenv("DOC_PATH", r"C:/Users/Admin/Documents/Work/XtraCut_Works/echoBot/langgraph/bot/remo.txt"))
parser.add_argument("--question", default=os.getenv("QUESTION", "What is the warranty period?"))
parser.add_argument("--topk", type=int, default=8)
parser.add_argument("--print_ctx", action="store_true", help="Print retrieved context before answering")
args = parser.parse_args()

FILE_PATH = args.file
QUESTION = args.question
TOP_K = args.topk

if not os.path.exists(FILE_PATH):
    raise RuntimeError(f"File not found: {FILE_PATH}")

# -------- Chunk + prepare IDs/metadata --------
print("Loading & chunking document …")
file_sha1 = sha1_of_file(FILE_PATH)
NAMESPACE = file_sha1  # isolate per document
chunks = load_and_chunk(FILE_PATH)
if not chunks:
    raise RuntimeError("No chunks produced from document.")

ids: List[str] = []
texts: List[str] = []
metas: List[Dict[str, Any]] = []

for i, d in enumerate(chunks):
    text = str(d.page_content or "")
    raw_page = d.metadata.get("page", None)

    # Pinecone v3 metadata must be str/number/bool/list[str]; never None
    if raw_page is None:
        page_meta = i + 1          # pseudo-page for non-PDFs / missing pages
    elif isinstance(raw_page, (int, float, bool, str)):
        page_meta = raw_page
    else:
        page_meta = str(raw_page)

    ids.append(deterministic_id(file_sha1, raw_page if isinstance(raw_page, int) else None, text))
    texts.append(text)
    metas.append({
        "file_sha1": file_sha1,
        "page": page_meta,  # <= never None
        "text": text,
        "source_file": os.path.basename(FILE_PATH)
    })

# -------- Idempotent ingest --------
ensure_namespace(ids, texts, metas, NAMESPACE)

# -------- Multi-query expansion + RRF retrieval --------
variants = multi_query_variants(QUESTION, n=4)
print("🔎 Query variants:", variants)

result_lists: List[List[Dict[str, Any]]] = []
for q in variants:
    q_vec = embeddings.embed_query(q)
    res = pinecone_query(q_vec, NAMESPACE, top_k=min(10, TOP_K + 2))
    result_lists.append(response_matches(res))

merged = rrf_combine(result_lists, k=60, top_k=TOP_K)
print(f"🔧 Merged hits (RRF): {len(merged)}")

if not merged:
    print("\n================= ANSWER =================")
    print("Not mentioned in the document.")
    print("==========================================")
    raise SystemExit(0)

# -------- Build context & answer strictly from it --------
context = format_ctx(merged)

if args.print_ctx:
    print("\n----- Retrieved context (top-k) -----\n")
    print(context)
    print("\n------------------------------------\n")

prompt = (
    "You are a careful assistant. Use ONLY the CONTEXT to answer. "
    "If the answer is not explicitly in the context, reply exactly: 'Not mentioned in the document.' "
    "Cite pages like (p. X).\n\n"
    f"Question: {QUESTION}\n\n"
    "CONTEXT:\n```text\n"
    f"{context}\n"
    "```\n\nAnswer:"
)

print(prompt)

answer = llm.invoke(prompt).content.strip()
print("\n================= ANSWER =================")
print(answer if answer else "Not mentioned in the document.")
print("==========================================")
