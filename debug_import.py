import sys, os
try:
    import pinecone
    print(f"pinecone version: {getattr(pinecone, '__version__', 'unknown')}")
    print(f"pinecone file: {pinecone.__file__}")
    from pinecone import Pinecone
    print("Pinecone import OK!")
except ImportError as e:
    print(f"ImportError: {e}")
except Exception as e:
    print(f"Exception: {e}")

sys.path.append(os.getcwd())
try:
    from base.agents.langchain_bot_pinecone import pc
    print("Full agent import OK!")
except Exception as e:
    print(f"Agent import error: {e}")
