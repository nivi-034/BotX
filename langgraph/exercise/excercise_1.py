from typing import TypedDict
from langgraph.graph import StateGraph, START, END


# creating state
class ComplimentAgent(TypedDict):
    name: str
    

# creating nodes
def compliment_node(state: ComplimentAgent) -> ComplimentAgent:
    """compliment node"""
    state['name'] = f"Hello, {state['name']}, you are amazing!!"
    return state

graph = StateGraph(ComplimentAgent)

graph.add_node("compliment", compliment_node)
graph.set_entry_point("compliment")
graph.set_finish_point("compliment")

app = graph.compile()

print(app.invoke({"name": "John"})["name"])