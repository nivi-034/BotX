# langchain_bot_web_rag.py — RAG over web pages (URLs), optional web search, idempotent Pinecone v3, multi-query, RRF
# pip install python-dotenv requests beautifulsoup4 duckduckgo-search langchain-groq langchain-huggingface pinecone-client

import os
import time
import argparse
import hashlib
import re
from typing import List, Dict, Any, Iterable, Optional

from dotenv import load_dotenv
load_dotenv()

# -------- Basic web fetch --------
import requests
from bs4 import BeautifulSoup

# (Optional) Web search (DuckDuckGo)
try:
    from duckduckgo_search import DDGS
    HAVE_DDG = True
except Exception:
    HAVE_DDG = False

# -------- Chunking --------
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
INDEX_NAME = os.getenv("PINECONE_INDEX", "web-rag-index")
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

def sha1_of_list(items: List[str]) -> str:
    return sha1_bytes("\n".join(sorted(items)).encode("utf-8"))

def deterministic_id(namespace_seed: str, url: str, chunk_idx: int, text: str) -> str:
    text_hash = sha1_bytes(text.encode("utf-8"))[:10]
    safe = re.sub(r"[^a-zA-Z0-9]+", "_", url)[:60]  # keep id length sane
    return f"{namespace_seed}-{safe}-{chunk_idx}-{text_hash}"

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

def fetch_one(id_: str, namespace: str, retries: int = 8, delay: float = 0.6) -> Optional[Dict[str, Any]]:
    for _ in range(retries):
        vecs = fetch_vectors([id_], namespace)
        vrec = vecs.get(id_)
        if vrec:
            return vrec
        time.sleep(delay)
    return None

# -------- URL parsing & fetching --------
def parse_urls_arg(urls_arg: str) -> List[str]:
    """
    Accepts:
      - comma- or space-separated URLs
      - a path to a file containing URLs (one per line)
    """
    urls: List[str] = []
    if urls_arg and os.path.exists(urls_arg) and os.path.isfile(urls_arg):
        with open(urls_arg, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                u = line.strip()
                if u:
                    urls.append(u)
    else:
        # split on commas/space/newlines
        for u in re.split(r"[\s,]+", urls_arg.strip()):
            if u:
                urls.append(u)

    # normalize
    out = []
    for u in urls:
        if not re.match(r"^https?://", u, re.I):
            u = "http://" + u
        out.append(u)
    # de-dup while preserving order
    seen = set()
    uniq = []
    for u in out:
        if u not in seen:
            uniq.append(u)
            seen.add(u)
    return uniq

def fetch_url_text(url: str, timeout: int = 20, max_chars: int = 120_000) -> str:
    headers = {
        "User-Agent": "Mozilla/5.0 (RAGBot/1.0; +https://example.com)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    r = requests.get(url, headers=headers, timeout=timeout)
    r.raise_for_status()
    html = r.text
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "header", "footer", "nav", "aside"]):
        tag.decompose()
    text = " ".join(soup.stripped_strings)
    # clamp extremely long pages
    return text[:max_chars]

def search_urls(query: str, num_results: int = 5) -> List[str]:
    if not HAVE_DDG:
        print("[warn] duckduckgo-search not installed; skipping web search.")
        return []
    urls = []
    with DDGS() as ddgs:
        for r in ddgs.text(query, max_results=num_results):
            u = r.get("href") or r.get("url")
            if u:
                urls.append(u)
    # de-dup
    seen = set()
    out = []
    for u in urls:
        if u not in seen:
            out.append(u)
            seen.add(u)
    return out

# -------- Chunking URLs --------
def load_and_chunk_urls(urls: List[str], chunk_size: int = 2800, chunk_overlap: int = 200) -> List[Document]:
    splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    all_docs: List[Document] = []

    for url in urls:
        try:
            print(f"↗️ Fetching: {url}")
            page_text = fetch_url_text(url)
            if not page_text.strip():
                print(f"[warn] Empty text for: {url}")
                continue
            chunks = splitter.split_text(page_text)
            for ch in chunks:
                all_docs.append(Document(page_content=ch, metadata={"source_url": url, "page": "NA"}))
        except Exception as e:
            print(f"[warn] Failed to fetch {url}: {e}")
    return all_docs

# -------- Embedding helpers --------
def embed_texts(texts: List[str]) -> List[List[float]]:
    vecs = embeddings.embed_documents(texts)
    if not vecs or len(vecs[0]) != EXPECTED_DIM:
        raise RuntimeError(f"Unexpected embedding size: {len(vecs[0]) if vecs else 'N/A'} (expected {EXPECTED_DIM}).")
    return vecs

# -------- Retrieval formatting --------
def format_ctx(hits: List[Dict[str, Any]]) -> str:
    parts = []
    for m in hits:
        md = (m.get("metadata") if isinstance(m, dict) else getattr(m, "metadata", {})) or {}
        page = md.get("page", "NA")
        text = md.get("text", "")
        src  = md.get("source_url", "unknown")
        parts.append(f"[{src} p.{page}] {text}")
    return "\n\n---\n\n".join(parts)

# -------- Multi-query expansion + RRF --------
def multi_query_variants(question: str, n: int = 3) -> List[str]:
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
    return uniq[: n + 1]

def rrf_combine(result_lists: List[List[Dict[str, Any]]], k: int = 60, top_k: int = 8) -> List[Dict[str, Any]]:
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

    probe_id = miss_ids[0]
    vrec = fetch_one(probe_id, namespace, retries=10, delay=0.7)
    if not vrec:
        raise RuntimeError(
            f"Fetch failed for id '{probe_id}' in namespace '{namespace}' after upsert."
        )
    print(f"🔍 Fetch OK for id '{probe_id}' in namespace '{namespace}'.")

# -------- CLI --------
parser = argparse.ArgumentParser()
parser.add_argument("--urls", required=False, default=os.getenv("URLS", ""),
                    help="Comma/space-separated URLs OR a path to a text file with URLs (one per line).")
parser.add_argument("--search", required=False, default=os.getenv("WEB_SEARCH", ""),
                    help="Optional: Web search query to collect URLs (DuckDuckGo).")
parser.add_argument("--search_k", type=int, default=int(os.getenv("SEARCH_K", "5")),
                    help="Max URLs to fetch from web search.")
parser.add_argument("--question", default=os.getenv("QUESTION", "What is the warranty period?"))
parser.add_argument("--topk", type=int, default=8)
parser.add_argument("--chunk_size", type=int, default=2800)
parser.add_argument("--chunk_overlap", type=int, default=200)
parser.add_argument("--print_ctx", action="store_true")
args = parser.parse_args()

QUESTION = args.question
TOP_K = args.topk

# -------- Build URL set --------
urls_from_arg: List[str] = []
if args.urls.strip():
    urls_from_arg = parse_urls_arg(args.urls)

urls_from_search: List[str] = []
if args.search.strip():
    urls_from_search = search_urls(args.search, num_results=args.search_k)

URLS: List[str] = [
    "https://www.remocollege.com/",
    "https://www.remocollege.com/about-us",
    "https://www.remocollege.com/placement",
    "https://www.remocollege.com/bba-in-airline-and-airport-management-colleges-in-chennai",
    "https://www.remocollege.com/mba-airline-and-airport-management-colleges-in-chennai",
    "https://www.remocollege.com/bsc-aviation-colleges-in-chennai",
    "https://www.remocollege.com/b-sc-in-aviation-lateral-entry"
]
seen = set()
for u in urls_from_arg + urls_from_search:
    if u not in seen:
        URLS.append(u); seen.add(u)

if not URLS:
    raise RuntimeError("No URLs provided. Use --urls 'https://a,https://b' and/or --search 'your query'.")

print(f"Collected {len(URLS)} URL(s).")

# -------- Chunk + prepare IDs/metadata --------
print("Fetching & chunking web pages …")
docs = load_and_chunk_urls(URLS, chunk_size=args.chunk_size, chunk_overlap=args.chunk_overlap)
if not docs:
    raise RuntimeError("No chunks produced from URLs.")

# Namespace = hash of URL list (idempotent per corpus)
dataset_sha1 = sha1_of_list(URLS)
NAMESPACE = dataset_sha1
print(f"Using namespace: {NAMESPACE}")

ids: List[str] = []
texts: List[str] = []
metas: List[Dict[str, Any]] = []
for i, d in enumerate(docs):
    text = d.page_content or ""
    source_url = d.metadata.get("source_url", "unknown")
    page = d.metadata.get("page", "NA")
    ids.append(deterministic_id(dataset_sha1, source_url, i, text))
    texts.append(text)
    metas.append({
        "dataset_sha1": dataset_sha1,
        "page": page,
        "text": text,
        "source_url": source_url
    })

# -------- Idempotent ingest --------
ensure_namespace(ids, texts, metas, NAMESPACE)

# -------- Multi-query expansion + RRF retrieval --------
variants = multi_query_variants(QUESTION, n=3)
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
    "Cite sources like (source URL).\n\n"
    f"Question: {QUESTION}\n\n"
    "CONTEXT:\n```text\n"
    f"{context}\n"
    "```\n\nAnswer:"
)

print(prompt)

answer = llm.invoke(prompt).content.strip()
print("\n================= ANSWER =================")
print(answer if answer else "Not mentioned in the document.")
print("============================================")
