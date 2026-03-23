# langchain_bot_pinecone.py — Robust Pinecone RAG (idempotent + v3-safe)

import os
import time
import hashlib
from typing import List, Dict, Any, Iterable

from dotenv import load_dotenv
load_dotenv()

# -------- PDF loading & chunking --------
from langchain_community.document_loaders import PyPDFLoader
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
    # Support object & dict list elements
    out = []
    for x in pc.list_indexes():
        name = getattr(x, "name", None)
        if not name and isinstance(x, dict):
            name = x.get("name")
        if name:
            out.append(name)
    return out

# Create index if needed (serverless)
if INDEX_NAME not in _index_names():
    print(f"Creating Pinecone index '{INDEX_NAME}' (dim={EXPECTED_DIM}, cosine) …")
    pc.create_index(
        name=INDEX_NAME,
        dimension=EXPECTED_DIM,
        metric="cosine",
        spec=ServerlessSpec(cloud="aws", region=PINECONE_ENV_REGION),
    )
    # wait until ready
    while not pc.describe_index(INDEX_NAME).status["ready"]:
        time.sleep(0.5)
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
    # deterministic = stable across runs; short hash keeps ids < 512 chars
    text_hash = sha1_bytes(text.encode("utf-8"))[:10]
    return f"{file_sha1}-{page if page is not None else 'NA'}-{text_hash}"

def response_matches(res) -> List[Dict[str, Any]]:
    # Works with v3 QueryResponse and dict
    if hasattr(res, "matches"):
        return res.matches or []
    if isinstance(res, dict):
        return res.get("matches", []) or []
    return []

def fetch_vectors(ids: Iterable[str], namespace: str) -> Dict[str, Any]:
    """Fetch a set of ids (<=100 per call). Returns mapping id -> vector_record."""
    ids = list(ids)
    if not ids:
        return {}
    resp = index.fetch(ids=ids, namespace=namespace)
    if isinstance(resp, dict):
        return resp.get("vectors", {}) or {}
    # v3 FetchResponse
    return getattr(resp, "vectors", {}) or {}

def fetch_one(id_: str, namespace: str, retries: int = 8, delay: float = 0.75) -> Dict[str, Any] | None:
    """Retry-fetch one id to ride out eventual consistency."""
    for _ in range(retries):
        vecs = fetch_vectors([id_], namespace)
        vrec = vecs.get(id_)
        if vrec:
            return vrec
        time.sleep(delay)
    return None

def describe_namespace_count(namespace: str) -> int:
    stats = index.describe_index_stats()
    ns_info = None
    if isinstance(stats, dict):
        ns_info = (stats.get("namespaces") or {}).get(namespace)
    else:
        # v3 returns dict-like; keeping dict handling is fine
        ns_info = (stats.get("namespaces") or {}).get(namespace)
    return (ns_info or {}).get("vector_count", 0)

def wait_for_namespace_count(ns: str, expect_min: int, timeout_s: int = 30) -> int:
    start = time.time()
    last = 0
    while time.time() - start < timeout_s:
        cnt = describe_namespace_count(ns)
        last = cnt
        if cnt >= expect_min:
            return cnt
        time.sleep(1.0)
    return last

def chunk_pdf(pdf_path: str) -> List[Document]:
    loader = PyPDFLoader(pdf_path)
    docs = loader.load()
    splitter = RecursiveCharacterTextSplitter(chunk_size=1200, chunk_overlap=150)
    return splitter.split_documents(docs)

def embed_texts(texts: List[str]) -> List[List[float]]:
    vecs = embeddings.embed_documents(texts)
    if not vecs or len(vecs[0]) != EXPECTED_DIM:
        raise RuntimeError(f"Unexpected embedding size: {len(vecs[0]) if vecs else 'N/A'} (expected {EXPECTED_DIM}).")
    return vecs

def format_ctx(hits: List[Dict[str, Any]]) -> str:
    parts = []
    for m in hits:
        md = None
        if isinstance(m, dict):
            md = m.get("metadata", {}) or {}
        else:
            md = getattr(m, "metadata", {}) or {}
        page = md.get("page", "NA")
        text = md.get("text", "")
        parts.append(f"[p.{page}] {text}")
    return "\n\n---\n\n".join(parts)

# -------- Inputs --------
PDF_PATH = os.getenv("PDF_PATH", r"C:\Users\Admin\Downloads\Nagipragalathan_Nagimani.pdf")
if not os.path.exists(PDF_PATH):
    raise RuntimeError(f"PDF not found: {PDF_PATH}")

file_sha1 = sha1_of_file(PDF_PATH)
NAMESPACE = file_sha1  # isolate per PDF
QUESTION = "how many languagess he knows ?"
TOP_K = 8

# -------- Chunk + prepare IDs/metadata (always cheap) --------
print("Loading & chunking PDF …")
chunks = chunk_pdf(PDF_PATH)
if not chunks:
    raise RuntimeError("No chunks produced from PDF.")

ids: List[str] = []
texts: List[str] = []
metas: List[Dict[str, Any]] = []
for d in chunks:
    text = d.page_content or ""
    page = d.metadata.get("page", None)
    ids.append(deterministic_id(file_sha1, page, text))
    texts.append(text)
    metas.append({
        "file_sha1": file_sha1,
        "page": page,
        "text": text,
        "source_file": os.path.basename(PDF_PATH)
    })

# -------- Idempotent ingest: only embed & upsert MISSING IDs --------
print(f"Checking which of {len(ids)} chunks already exist in namespace …")
existing_ids: set[str] = set()
BATCH = 100
for i in range(0, len(ids), BATCH):
    batch_ids = ids[i:i+BATCH]
    vecs = fetch_vectors(batch_ids, NAMESPACE)
    existing_ids.update(vecs.keys())

missing_ids = [ids[i] for i in range(len(ids)) if ids[i] not in existing_ids]
missing_texts = [texts[i] for i in range(len(texts)) if ids[i] not in existing_ids]
missing_metas = [metas[i] for i in range(len(metas)) if ids[i] not in existing_ids]

if missing_ids:
    print(f"Embedding {len(missing_ids)} new chunk(s) via HF Inference API …")
    missing_vecs = embed_texts(missing_texts)
    vectors = [{"id": missing_ids[i], "values": missing_vecs[i], "metadata": missing_metas[i]} for i in range(len(missing_ids))]
    print(f"Upserting {len(vectors)} vectors to Pinecone namespace='{NAMESPACE}' …")
    upsert_resp = index.upsert(vectors=vectors, namespace=NAMESPACE)
    print("🔁 Upsert response:", upsert_resp)
    # Prove at least one is visible (fetch with retries)
    probe_id = missing_ids[0]
    vrec = fetch_one(probe_id, NAMESPACE, retries=12, delay=0.75)
    if not vrec:
        raise RuntimeError(
            f"Fetch failed for id '{probe_id}' in namespace '{NAMESPACE}' after upsert. "
            "Double-check INDEX_NAME, NAMESPACE, and PINECONE_API_KEY project/workspace."
        )
    print(f"🔍 Fetch OK for id '{probe_id}' (namespace='{NAMESPACE}').")
    # Optional: wait for stats to reflect (non-blocking if they lag)
    cnt_after = wait_for_namespace_count(NAMESPACE, expect_min=1, timeout_s=20)
    print(f"📊 Namespace '{NAMESPACE}' vector_count (eventual): {cnt_after}")
else:
    print(f"♻️ All {len(ids)} chunks already exist; skipping re-embed/upsert.")

# -------- Self-query to verify search path --------
# Use an existing vector: fetch one known id then query with it; should return hits
probe_id = ids[0]
vrec = fetch_one(probe_id, NAMESPACE, retries=8, delay=0.75)
probe_vec = None
if vrec:
    # vrec may be Vector object (v3) or dict (legacy)
    probe_vec = getattr(vrec, "values", None) or (vrec.get("values") if isinstance(vrec, dict) else None)

if probe_vec:
    self_res = index.query(
        vector=probe_vec,
        top_k=3,
        include_values=False,
        include_metadata=True,
        namespace=NAMESPACE
    )
    self_hits = response_matches(self_res)
    print(f"🧪 Self-query hits: {len(self_hits)} (should be > 0)")
    if not self_hits:
        raise RuntimeError(
            "Self-query returned 0 hits → index/namespace mismatch at query time. "
            "Ensure query uses the SAME index+namespace as upsert."
        )
else:
    print("ℹ️ Could not extract probe vector values; continuing. (This does not block user query.)")

# -------- Real retrieval --------
q_vec = embeddings.embed_query(QUESTION)
res = index.query(
    vector=q_vec,
    top_k=TOP_K,
    include_values=False,
    include_metadata=True,
    namespace=NAMESPACE
)
matches = response_matches(res)
print(f"🔧 Pinecone query hits: {len(matches)} (namespace={NAMESPACE})")
if not matches:
    raise RuntimeError(
        "No matches from Pinecone.\n"
        f" • Index '{INDEX_NAME}' ready, dim=384, metric=cosine\n"
        f" • Namespace '{NAMESPACE}' has vectors (fetch confirmed)\n"
        " • embed_documents() for chunks + embed_query() for question\n"
        "If this persists, verify in the Pinecone console that vectors appear under the index+namespace, "
        "and that you’re querying the same project."
    )

# -------- LLM Answer --------
context = format_ctx(matches)
if not context.strip():
    raise RuntimeError("Context empty after retrieval—ensure 'text' is stored in metadata.")

prompt = (
    "Answer ONLY using the CONTEXT. If the answer isn't in the context, say "
    "\"I don't know.\" Cite pages like (p. X).\n\n"
    f"Question: {QUESTION}\n\n"
    "CONTEXT:\n```text\n"
    f"{context}\n"
    "```\n\nAnswer:"
)
answer = llm.invoke(prompt).content
print("\n================= ANSWER =================")
print(answer)
print("==========================================")
