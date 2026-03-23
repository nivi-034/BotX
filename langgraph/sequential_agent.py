from typing import TypedDict, List
from langgraph.graph import StateGraph, START, END


class AgentState(TypedDict):
    name: str
    age: int
    result: str
    
    
def first_node(state: AgentState) -> AgentState:
    """first node"""
    state["result"] = f"Hello {state['name']}"
    return state

def second_node(state: AgentState) -> AgentState:
    """second node"""
    state['result'] = f"{state['result']}, you are {state['age']} years old"
    return state


graph = StateGraph(AgentState)

graph.add_node("first_node", first_node)

graph.add_node("second_node", second_node)


graph.set_entry_point("first_node")
graph.add_edge("first_node", "second_node")
graph.set_finish_point("second_node")

app = graph.compile()

print(app.invoke({"name": "John", "age": 20})["result"])