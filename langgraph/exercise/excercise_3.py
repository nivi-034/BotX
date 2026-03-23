from typing import TypedDict, List
from langgraph.graph import StateGraph, START, END


class AgentState(TypedDict):
    number_1: int
    number_2: int
    operator: str
    result: str
    
# creating nodes

def adding_node(state: AgentState) -> AgentState:
    """ adding node """
    result = state.get("result", "")
    state['result'] = result + f"{state['number_1'] + state['number_2']}"
    return state

def subtracting_node(state: AgentState) -> AgentState:
    """ subtracting node """
    result = state.get("result", "")
    state['result'] = result + f"{state['number_1'] - state['number_2']}"
    return state

def decide_next_node(state: AgentState) -> str:
    """ decide next node """
    if state['operator'] == '+':
        return "adding"
    else:
        return "subtracting"

# make connections

graph = StateGraph(AgentState)

graph.add_node("adding_node", adding_node)
graph.add_node("subtracting_node", subtracting_node)
graph.add_node("router", lambda state: state)

graph.add_edge(START, "router")
graph.add_conditional_edges(
    "router",
    decide_next_node,
    {
        "adding": "adding_node",
        "subtracting": "subtracting_node"
    }
)


graph.add_node("adding_node_2", adding_node)
graph.add_node("subtracting_node_2", subtracting_node)
graph.add_node("router_2", lambda state: state)

graph.add_edge("adding_node", "router_2")
graph.add_edge("subtracting_node", "router_2")

graph.add_conditional_edges(
    "router_2",
    decide_next_node,
    {
        "adding": "adding_node_2",
        "subtracting": "subtracting_node_2"
    }
)

graph.add_edge("adding_node_2", END)
graph.add_edge("subtracting_node_2", END)


app = graph.compile()
print(app.invoke({"number_1": 1, "number_2": 2, "operator": "+"})["result"])