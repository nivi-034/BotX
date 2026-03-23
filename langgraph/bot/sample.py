from langchain_groq import ChatGroq

from typing import Annotated

from langchain.chat_models import init_chat_model
from langchain_core.messages import BaseMessage, HumanMessage
from typing_extensions import TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import tools_condition

class State(TypedDict):
    messages: Annotated[list, add_messages]

graph_builder = StateGraph(State)

llm = ChatGroq(model="llama3-8b-8192", temperature=0.0, api_key="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")


def chatbot(state: State):
    return {"messages": [llm.invoke(state["messages"])]}

graph_builder.add_node("chatbot", chatbot)


graph_builder.add_conditional_edges(
    "chatbot",
    tools_condition,
    {
        "tools": "chatbot",
        "__end__": END
    }
)

graph_builder.set_entry_point("chatbot")
memory = InMemorySaver()
graph = graph_builder.compile(checkpointer=memory)

print(graph.invoke({"messages": [HumanMessage(content="What is the capital of France?")]}))