from typing import TypedDict, Sequence
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage
from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, START, END, ToolNode
from langchain_core.tools import tool


class AgentState(TypedDict):
    messages: Sequence[BaseMessage]





# EIN - emotional intelligence
 
# SEL - solcial rmotinal learning






