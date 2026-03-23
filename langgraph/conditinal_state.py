from typing import TypedDict
from langgraph.graph import StateGraph, START, END


class AgentState(TypedDict):
    number_1: int
    number_2: int
    operator: str
    result: str
    
    
def adder(state: AgentState) -> AgentState:
    """ adder node """
    state['result'] = state['number_1'] + state['number_2']
    return state

def subtractor(state: AgentState) -> AgentState:
    """ subtractor node """
    state['result'] = state['number_1'] - state['number_2']
    return state

def decide_next_node(state: AgentState) -> str:
    """ decide next node """
    if state['operator'] == '+':
        return "adder"
    else:
        return "subtractor"
    
graph = StateGraph(AgentState)

graph.add_node("adder_node", adder)

graph.add_node("subtractor_node", subtractor)

graph.add_node("router", lambda state: state)

graph.add_edge(START, "router")
graph.add_conditional_edges(
    "router",
    decide_next_node,
    {
        "adder": "adder_node",
        "subtractor": "subtractor_node"
    }
)

graph.add_edge("adder_node", END)
graph.add_edge("subtractor_node", END)


app = graph.compile()

print(app.invoke({"number_1": 1, "number_2": 2, "operator": "+"})["result"])