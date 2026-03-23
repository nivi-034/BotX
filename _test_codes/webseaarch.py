import os
import faiss
import numpy as np
from pymongo import MongoClient
from langchain_groq import ChatGroq
from langchain_community.tools import DuckDuckGoSearchResults
from langchain_community.vectorstores import FAISS
from langchain.agents import initialize_agent, AgentType
from langchain.agents import Tool
import requests
import json

# -------- Bypass OpenMP Error --------
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'  # This will bypass OpenMP runtime errors

# -------- LLM (Groq) --------
llm = ChatGroq(
    model_name="llama-3.3-70b-versatile",  # Replace with your actual Groq model name
    temperature=0.0,
    groq_api_key="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",  # Your Groq API key
)

# MongoDB connection setup (for document storage)
MONGO_URI = "mongodb+srv://nivetha:123@cluster0.405bx9q.mongodb.net/pdf_rag?retryWrites=true&w=majority"
client = MongoClient(MONGO_URI)

# Initialize FAISS (Vector Database) for document retrieval
def initialize_faiss_index(dimensions=512):
    index = faiss.IndexFlatL2(dimensions)  # For simplicity, use L2 distance
    return index

# Example of FAISS-based document retrieval (using random embeddings for this demo)
def search_faiss(query, faiss_index, document_embeddings):
    query_embedding = np.random.rand(512).astype('float32')  # Random query embedding for example
    _, indices = faiss_index.search(query_embedding.reshape(1, -1), k=5)  # Get top 5 results
    results = [document_embeddings[i] for i in indices[0]]
    return results

# Initialize FAISS index
faiss_index = initialize_faiss_index()
document_embeddings = []  # For this example, embeddings are random

# LangChain Tool Setup
tools = [
    Tool(
        name="DuckDuckGoSearch",
        func=DuckDuckGoSearchResults().run,
        description="Use DuckDuckGo to search the web for information"
    ),
    Tool(
        name="DocumentRetriever",
        func=lambda query: search_faiss(query, faiss_index, document_embeddings),
        description="Retrieve relevant documents from FAISS"
    ),
    Tool(
        name="GroqAI",
        func=lambda query: llm([{"role": "user", "content": query}]),  # Correct format for Groq input
        description="Use Groq for AI-based tasks"
    ),
]

# LangChain Agent Setup
agent = initialize_agent(
    tools, llm, agent_type=AgentType.ZERO_SHOT_REACT_DESCRIPTION, verbose=True
)

# Function to handle user input and generate chatbot responses
def chatbot(query):
    print(f"Processing query: {query}")  # Debug: Track the query being processed
    try:
        response = agent.run(query)
        print(f"Generated Response: {response}")  # Debug: Show the agent's response
        return response
    except Exception as e:
        print(f"Error during agent execution: {e}")
        return "Sorry, there was an error processing your query."

# Example usage:
if __name__ == "__main__":
    user_query = "listout remo clg chennai courses!"  # Example query
    response = chatbot(user_query)
    print("Chatbot Response: ", response)
