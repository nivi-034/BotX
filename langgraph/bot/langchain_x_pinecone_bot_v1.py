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
    # small wait until index is ready
    while True:
        status = pc.describe_index(INDEX_NAME).status["ready"]
        if status:
            break
        time.sleep(1)
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
        md = m.get("metadata", {}) or {}
        page = md.get("page", "NA")
        text = md.get("text", "")
        parts.append(f"[p.{page}] {text}")
    return "\n\n---\n\n".join(parts)

def upsert_in_batches(vectors: List[Dict[str, Any]], batch_size: int = 100):
    for i in range(0, len(vectors), batch_size):
        batch = vectors[i:i+batch_size]
        index.upsert(vectors=batch)

# -------- Config / Inputs --------
PDF_PATH = os.getenv("PDF_PATH", r"C:\Users\Admin\Downloads\Nagipragalathan_Nagimani.pdf")
if not os.path.exists(PDF_PATH):
    raise RuntimeError(f"PDF not found: {PDF_PATH}")

file_sha1 = sha1_of_file(PDF_PATH)
NAMESPACE = None  # we’ll use metadata filtering rather than namespaces

# -------- Ingest (idempotent) --------
# We’ll store: id, values (embedding), metadata: {file_sha1, page, text, source_file}
# To avoid double-inserts, we can look for an existing vector with same file_sha1. Pinecone
# doesn’t support listing by metadata directly, so we’ll just re-upsert (upsert is idempotent per id).
# Generate stable IDs per chunk using (file_sha1 + page + chunk_index).

print("Loading & chunking PDF …")
loader = PyPDFLoader(PDF_PATH)
docs = loader.load()
splitter = RecursiveCharacterTextSplitter(chunk_size=1200, chunk_overlap=150)
chunks: List[Document] = splitter.split_documents(docs)

if not chunks:
    raise RuntimeError("No chunks produced from PDF.")

print(f"Embedding {len(chunks)} chunks via Hugging Face Inference API …")
vectors = []
for i, d in enumerate(chunks):
    text = d.page_content or ""
    page = d.metadata.get("page", None)
    vec = embeddings.embed_query(text)  # returns 384-length list
    vid = f"{file_sha1}-{page}-{i}-{uuid4().hex[:8]}"
    vectors.append({
        "id": vid,
        "values": vec,
        "metadata": {
            "file_sha1": file_sha1,
            "page": page,
            "text": text,
            "source_file": os.path.basename(PDF_PATH)
        }
    })

print(f"Upserting {len(vectors)} vectors to Pinecone …")
upsert_in_batches(vectors, batch_size=100)
print("✅ Upsert complete.")

# -------- Retrieval --------
question = "summarize the following text in 200 words"
q_vec = embeddings.embed_query(question)

# Filter to THIS PDF using metadata
flt = {"file_sha1": {"$eq": file_sha1}}

res = index.query(
    vector=q_vec,
    top_k=8,
    include_values=False,
    include_metadata=True,
    filter=flt,
    namespace=NAMESPACE
)

matches = res.get("matches", []) or []
print(f"🔧 Pinecone query hits: {len(matches)}")

if not matches:
    raise RuntimeError(
        "No matches returned from Pinecone.\n"
        "Checklist:\n"
        f" • Index '{INDEX_NAME}' exists and is ready\n"
        " • Dimensions = 384, metric = cosine\n"
        " • Vectors were upserted (check Pinecone console)\n"
        " • Metadata filter uses key 'file_sha1' (confirm in your metadata)"
    )

context = format_ctx(matches)
if not context.strip():
    raise RuntimeError("Context empty after retrieval—check that you stored 'text' in metadata.")

prompt = (
    "Answer ONLY using the CONTEXT. If the answer isn't in the context, say "
    "\"I don't know.\" Cite pages like (p. X).\n\n"
    f"Question: {question}\n\n"
    "CONTEXT:\n```text\n"
    f"{context}\n"
    "```\n\nAnswer:"
)
 
answer = llm.invoke(prompt).content
print("\n================= ANSWER =================")
print(answer)
print("==========================================")
