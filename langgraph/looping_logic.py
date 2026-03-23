from langgraph.graph import StateGraph, START, END
from typing import TypedDict, List
import random

class AgentState(TypedDict):
    name: str
    number: List[int]
    counter: int

# create nodes

def greetings(state: AgentState) -> AgentState:
    """ greetings """
    state['name'] = "John"
    return state

def generate_number(state: AgentState) -> AgentState:
    """ generate number """
    state['number'].append(random.randint(1, 100))
    state['counter'] += 1
    return state

def check_loop(state: AgentState) -> AgentState:
    """ check loop """
    if state['counter'] < 5:
        return "loop"
    else:
        return "end"
    
# draw the graph

graph = StateGraph(AgentState)

# add nodes
graph.add_node("greetings", greetings)
graph.add_node("generate_number", generate_number)
graph.add_node("check_loop", check_loop)


graph.add_edge(START, "greetings")
graph.add_edge("greetings", "generate_number")
graph.add_conditional_edges(
    "generate_number",
    check_loop,
    {
        "loop": "generate_number",
        "end": END
    }
)

app = graph.compile()

print(app.invoke({"name": "John", "number": [], "counter": 0}))