from typing import TypedDict, List
from langchain_core.messages import HumanMessage, AIMessage
from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, START, END
from dotenv import load_dotenv

load_dotenv()



class AgentState(TypedDict):
    messages: List[HumanMessage]
    
llm = ChatGroq(model="llama3-8b-8192", temperature=0.0)


def process_message(state: AgentState) -> AgentState:
    """process message"""
    response = llm.invoke(state['messages'])
    print(f"AI: {response.content}")
    return state


# create graph

graph = StateGraph(AgentState)

graph.add_node("process_message", process_message)

graph.add_edge(START, "process_message")
graph.add_edge("process_message", END)

agent = graph.compile()



while True:
    user_input = input("Enter your message: ")
    if user_input.lower() == "exit":
        break
    agent.invoke({"messages": [HumanMessage(content=user_input)]})