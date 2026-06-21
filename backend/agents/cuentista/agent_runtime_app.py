import os
import vertexai
from google.adk.apps import App
from google.adk.artifacts import InMemoryArtifactService
from vertexai.agent_engines.templates.adk import AdkApp

# Import the root agent defined in agent.py
from .agent import root_agent

# Initialize Vertex AI SDK
vertexai.init()

# Define the ADK App wrapping our LLM agent
adk_app = App(name="cuentista", root_agent=root_agent)

class AgentEngineApp(AdkApp):
    def set_up(self) -> None:
        super().set_up()

# This is the entrypoint object deployed to Agent Runtime
agent_runtime = AgentEngineApp(
    app=adk_app,
    artifact_service_builder=InMemoryArtifactService
)
