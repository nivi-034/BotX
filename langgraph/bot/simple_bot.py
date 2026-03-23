# simple_ctx_qa.py — minimal "train" via context stuffing (TXT → LLM answer from given content)
# Requires: pip install python-dotenv langchain-groq

import os
import glob
import argparse

from dotenv import load_dotenv
load_dotenv()

# Use Groq LLM (Llama 3 via API)
from langchain_groq import ChatGroq

def read_all_texts(path_or_glob: str) -> str:
    """
    Read a single .txt file, a directory of .txt files, or a glob like './data/*.txt',
    and concatenate everything into one big string.
    """
    files = []
    if os.path.isdir(path_or_glob):
        files = glob.glob(os.path.join(path_or_glob, "*.txt"))
    elif os.path.isfile(path_or_glob):
        files = [path_or_glob]
    else:
        files = glob.glob(path_or_glob)

    if not files:
        raise RuntimeError(f"No .txt files found for: {path_or_glob}")

    parts = []
    for fp in sorted(files):
        with open(fp, "r", encoding="utf-8", errors="ignore") as f:
            parts.append(f"\n\n===== FILE: {os.path.basename(fp)} =====\n\n")
            parts.append(f.read())
    return "".join(parts)

def build_prompt(question: str, corpus: str, strict: bool = True) -> str:
    guard = (
        "If the answer is not explicitly present in the content, reply exactly: 'Not mentioned in the document.'\n"
        "Do not use prior knowledge.\n"
    ) if strict else "Prefer the content below; if unclear, say what is missing.\n"

    return (
        "You are a careful assistant.\n"
        f"{guard}\n"
        "QUESTION:\n"
        f"{question}\n\n"
        "CONTENT (use this only):\n"
        "```text\n"
        f"{corpus}\n"
        "```\n\n"
        "Answer:"
    )

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True,
                        help="Path to .txt file, a folder of .txt, or a glob (e.g., ./data/*.txt)")
    parser.add_argument("--question", required=True, help="User question")
    parser.add_argument("--model", default="llama-3.3-70b-versatile", help="Groq model name")
    parser.add_argument("--max_chars", type=int, default=120000,
                        help="Hard cap of characters passed to the LLM (keep it simple + safe)")
    parser.add_argument("--not_strict", action="store_true",
                        help="Allow the model to infer beyond content; default is strict")
    args = parser.parse_args()

    # 1) Read all content
    corpus = read_all_texts(args.data)

    # 2) Keep it simple: hard-cap context if it's massive
    if len(corpus) > args.max_chars:
        print(f"[warn] Corpus is {len(corpus)} chars; truncating to {args.max_chars}.")
        corpus = corpus[:args.max_chars]

    # 3) Build a strict prompt so answers are grounded
    prompt = build_prompt(args.question, corpus, strict=not args.not_strict)

    # 4) Call Groq LLM
    groq_key = os.getenv("GROQ_API_KEY")
    if not groq_key:
        raise RuntimeError("GROQ_API_KEY is missing. Set it in your environment or .env")

    llm = ChatGroq(model_name=args.model, temperature=0.0, groq_api_key=groq_key)

    answer = llm.invoke(prompt).content.strip()
    print("\n================= ANSWER =================")
    print(answer if answer else ("Not mentioned in the document." if not args.not_strict else ""))
    print("==========================================")

if __name__ == "__main__":
    main()
