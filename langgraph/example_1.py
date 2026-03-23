# start -> node -> end

from typing import Dict, TypedDict
from langgraph.graph import StateGraph, START, END


class AgentState(TypedDict): # state schema
    message: str
    

# input and output should be state
def greeting_node(state: AgentState) -> AgentState:
    """simple greeting node"""
    
    state["message"] = "Hello, " + state["message"] + ", how are you?"
    
    return state

graph = StateGraph(AgentState)

graph.add_node("greeting", greeting_node)
graph.set_entry_point("greeting")
graph.set_finish_point("greeting")

app = graph.compile()

print(app.invoke({"message": "John"})["message"])
