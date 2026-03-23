import os
import time
import hashlib
from typing import List, Dict, Any
from uuid import uuid4

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

# -------- Pinecone --------
from pinecone import Pinecone, ServerlessSpec

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_ENV_REGION = os.getenv("PINECONE_ENV_REGION", "us-east-1")
INDEX_NAME = os.getenv("PINECONE_INDEX", "pdf-rag-index")

if not PINECONE_API_KEY:
    raise RuntimeError("PINECONE_API_KEY missing from .env")

pc = Pinecone(api_key=PINECONE_API_KEY)

# Create index if needed (serverless)
existing = [x["name"] for x in pc.list_indexes()]
if INDEX_NAME not in existing:
    print(f"Creating Pinecone index '{INDEX_NAME}' (dim={EXPECTED_DIM}, cosine) …")
    pc.create_index(
        name=INDEX_NAME,
        dimension=EXPECTED_DIM,
        metric="cosine",
        spec=ServerlessSpec(cloud="aws", region=PINECONE_ENV_REGION),
    )
    while not pc.describe_index(INDEX_NAME).status["ready"]:
        time.sleep(0.5)
    print("✅ Pinecone index is ready.")

index = pc.Index(INDEX_NAME)

# -------- Helpers --------
def sha1_of_file(path: str) -> str:
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1_048_576), b""):
            h.update(chunk)
    return h.hexdigest()

def format_ctx(hits: List[Dict[str, Any]]) -> str:
    parts = []
    for m in hits:
        md = (m.get("metadata") if isinstance(m, dict) else getattr(m, "metadata", {})) or {}
        page = md.get("page", "NA")
        text = md.get("text", "")
        parts.append(f"[p.{page}] {text}")
    return "\n\n---\n\n".join(parts)

def upsert_in_batches(vectors: List[Dict[str, Any]], namespace: str, batch_size: int = 100):
    for i in range(0, len(vectors), batch_size):
        batch = vectors[i:i+batch_size]
        index.upsert(vectors=batch, namespace=namespace)

def response_matches(res) -> List[Dict[str, Any]]:
    """Support both dict-like and object responses."""
    if isinstance(res, dict):
        return res.get("matches", []) or []
    # v3 returns a QueryResponse with .matches attr
    return getattr(res, "matches", []) or []

# -------- Config / Inputs --------
PDF_PATH = os.getenv("PDF_PATH", r"C:\Users\Admin\Downloads\Nagipragalathan_Nagimani.pdf")
if not os.path.exists(PDF_PATH):
    raise RuntimeError(f"PDF not found: {PDF_PATH}")

file_sha1 = sha1_of_file(PDF_PATH)
NAMESPACE = file_sha1                    # <— isolate by file (no metadata filter needed)
QUESTION = "summarize the following text in 200 words"
TOP_K = 8

# -------- Ingest (idempotent) --------
print("Loading & chunking PDF …")
loader = PyPDFLoader(PDF_PATH)
docs = loader.load()
splitter = RecursiveCharacterTextSplitter(chunk_size=1200, chunk_overlap=150)
chunks: List[Document] = splitter.split_documents(docs)
if not chunks:
    raise RuntimeError("No chunks produced from PDF.")

# Create stable IDs per chunk (namespace+id makes them unique)
ids: List[str] = []
texts: List[str] = []
metas: List[Dict[str, Any]] = []
for i, d in enumerate(chunks):
    text = d.page_content or ""
    page = d.metadata.get("page", None)
    cid = f"{file_sha1}-{page or 'NA'}-{i}-{uuid4().hex[:6]}"
    ids.append(cid)
    texts.append(text)
    metas.append({
        "file_sha1": file_sha1,
        "page": page,
        "text": text,
        "source_file": os.path.basename(PDF_PATH)
    })

print(f"Embedding {len(texts)} chunks via HF Inference API …")
# Use embed_documents for corpus embeddings
doc_vecs: List[List[float]] = embeddings.embed_documents(texts)
if not doc_vecs or len(doc_vecs[0]) != EXPECTED_DIM:
    raise RuntimeError(f"Unexpected doc embedding size: {len(doc_vecs[0]) if doc_vecs else 'N/A'}")

vectors = [{"id": ids[i], "values": doc_vecs[i], "metadata": metas[i]} for i in range(len(ids))]

print(f"Upserting {len(vectors)} vectors to Pinecone namespace='{NAMESPACE}' …")
upsert_in_batches(vectors, namespace=NAMESPACE, batch_size=100)
print("✅ Upsert complete.")

# Small settle (usually instant, but good for clarity)
time.sleep(0.5)

# -------- Diagnostics --------
stats = index.describe_index_stats()
print("📊 Index stats:", stats)

# If you want to verify one stored vector quickly:
# fetched = index.fetch(ids=ids[:1], namespace=NAMESPACE)
# print("🔍 Sample fetch:", fetched)

# -------- Retrieval (NO FILTER; namespace isolates the file) --------
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
        "No matches returned from Pinecone.\n"
        "Checklist:\n"
        f" • Index '{INDEX_NAME}' is ready, dim=384, metric=cosine\n"
        f" • Namespace '{NAMESPACE}' contains vectors (see index stats and consider 'fetch' on a known id)\n"
        " • embed_documents() used for chunks and embed_query() for the question\n"
        " • If stats show 0 vectors in this namespace, your upsert likely went to a different namespace.\n"
        "   Set NAMESPACE explicitly to the printed file_sha1."
    )

# -------- LLM Answer --------
context = format_ctx(matches)
if not context.strip():
    raise RuntimeError("Context empty after retrieval—check that 'text' is in metadata.")

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
