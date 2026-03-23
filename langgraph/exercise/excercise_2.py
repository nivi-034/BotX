from typing import TypedDict, List
from langgraph.graph import StateGraph, START, END


class AgentState(TypedDict):
    values: List[int]
    operator: str
    result: str
    

def process_values(state: AgentState) -> AgentState:
    """process values"""
    operator = state['operator']
    ans = state['values'][0]
    for i in state['values'][1:]:
        ans = eval(f"{ans} {operator} {i}")
    state['result'] = f"The result of the operation is {ans}"
    
    return state

graph = StateGraph(AgentState)

graph.add_node("process_values", process_values)
graph.set_entry_point("process_values")
graph.set_finish_point("process_values")

app = graph.compile()

print(app.invoke({"values": [1, 2, 3], "operator": "*"})["result"])