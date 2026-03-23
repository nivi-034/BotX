# langchain_bot_text_rag.py — General Ask-Anything RAG over TXT (idempotent, multi-query, RRF, v3-safe)

import os
import time
import argparse
import hashlib
import glob
from typing import List, Dict, Any, Iterable

from dotenv import load_dotenv
load_dotenv()

# -------- Loading & chunking (TXT) --------
from langchain_community.document_loaders import TextLoader

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
INDEX_NAME = os.getenv("PINECONE_INDEX", "txt-rag-index")
if not PINECONE_API_KEY:
    raise RuntimeError("PINECONE_API_KEY missing from .env")

pc = Pinecone(api_key=PINECONE_API_KEY)

def _index_names() -> List[str]:
    names: List[str] = []
    # Pinecone v3 client can return objects or dicts; handle both.
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

def sha1_of_bytes(content: bytes) -> str:
    return hashlib.sha1(content).hexdigest()

def deterministic_id(namespace_seed: str, file_path: str, chunk_idx: int, text: str) -> str:
    text_hash = sha1_bytes(text.encode("utf-8"))[:10]
    base = os.path.basename(file_path)
    return f"{namespace_seed}-{base}-{chunk_idx}-{text_hash}"

def response_matches(res) -> List[Dict[str, Any]]:
    # Pinecone v3 returns dict-like {matches: [...]}
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

def load_and_chunk_texts(path_or_glob: str, chunk_size: int = 2800, chunk_overlap: int = 200) -> List[Document]:
    """Load a single .txt file or a folder/glob of .txt files, then chunk."""
    file_list: List[str] = []

    if os.path.isdir(path_or_glob):
        # All .txt in directory (non-recursive); change to **/*.txt for recursive
        file_list = glob.glob(os.path.join(path_or_glob, "*.txt"))
    elif os.path.isfile(path_or_glob):
        if not path_or_glob.lower().endswith(".txt"):
            raise RuntimeError(f"Expected a .txt file, got: {path_or_glob}")
        file_list = [path_or_glob]
    else:
        # treat as glob pattern
        file_list = glob.glob(path_or_glob)

    if not file_list:
        raise RuntimeError(f"No .txt files found in: {path_or_glob}")

    splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    all_docs: List[Document] = []

    for fp in sorted(file_list):
        loader = TextLoader(fp, encoding="utf-8")
        docs = loader.load()
        # Propagate filename into chunks
        for d in splitter.split_documents(docs):
            md = dict(d.metadata or {})
            md["source_file"] = os.path.basename(fp)
            # many .txt won't have "page", so keep NA
            if "page" not in md:
                md["page"] = "NA"
            all_docs.append(Document(page_content=d.page_content, metadata=md))

    return all_docs

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
        src  = md.get("source_file", "unknown.txt")
        parts.append(f"[{src} p.{page}] {text}")
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
parser.add_argument("--data", default=os.getenv("TXT_PATH", r"./data/*.txt"),
                    help="Path to a .txt file, a directory of .txt files, or a glob like './data/*.txt'")
parser.add_argument("--question", default=os.getenv("QUESTION", "What is the warranty period?"))
parser.add_argument("--topk", type=int, default=8)
parser.add_argument("--print_ctx", action="store_true", help="Print retrieved context before answering")
args = parser.parse_args()

DATA_PATH = args.data
QUESTION = args.question
TOP_K = args.topk

# -------- Chunk + prepare IDs/metadata --------
print("Loading & chunking TXT dataset …")
docs = load_and_chunk_texts(DATA_PATH)
if not docs:
    raise RuntimeError("No chunks produced from text files.")

# Build a namespace per dataset (idempotent): hash of all filenames
all_names = "\n".join(sorted({d.metadata.get("source_file", "unknown.txt") for d in docs}))
dataset_sha1 = sha1_of_bytes(all_names.encode("utf-8"))
NAMESPACE = dataset_sha1
print(f"Using namespace: {NAMESPACE}")

ids: List[str] = []
texts: List[str] = []
metas: List[Dict[str, Any]] = []
for i, d in enumerate(docs):
    text = d.page_content or ""
    source_file = d.metadata.get("source_file", "unknown.txt")
    page = d.metadata.get("page", "NA")
    ids.append(deterministic_id(dataset_sha1, source_file, i, text))
    texts.append(text)
    metas.append({
        "dataset_sha1": dataset_sha1,
        "page": page,
        "text": text,
        "source_file": source_file
    })

# -------- Idempotent ingest --------
ensure_namespace(ids, texts, metas, NAMESPACE)

# -------- Multi-query expansion + RRF retrieval --------
variants = multi_query_variants(QUESTION, n=4)
print("🔎 Query variants:", variants)

result_lists: List[List[Dict[str, Any]]] = []
for q in variants[:3]:
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
    "Dont miss any of the content make a deep search of the given context. and give the detailed answer."
    "if they are ask list anything collect all of the things and give entire list. dont skip anything else."
    "If the answer is not explicitly in the context, reply exactly: 'Not mentioned in the document.' "
    
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
