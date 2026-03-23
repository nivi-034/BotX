from typing import TypedDict, List
from langgraph.graph import StateGraph, START, END


class AgentState(TypedDict):
    values: List[int]
    name: str
    result: str
    

def process_values(state: AgentState) -> AgentState:
    """process values"""
    state['result'] = f"Hi {state['name']}, The sum of the values is {sum(state['values'])}"
    return state

graph = StateGraph(AgentState)
graph.add_node("process_values", process_values)
graph.set_entry_point("process_values")
graph.set_finish_point("process_values")


app = graph.compile()

print(app.invoke({"values": [1, 2, 3], "name": "John"})["result"])