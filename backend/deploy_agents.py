#!/usr/bin/env python3
"""Script to deploy the Dominikito ADK agents to Vertex AI Agent Runtime (Reasoning Engines).

This script uses the Vertex AI SDK to package and deploy:
- cuentista agent
- dilemas agent
- narrador agent

Prerequisites:
1. GCP credentials authenticated (or running within Cloud Build/runner).
2. google-cloud-aiplatform installed.
3. Staging bucket created (via Terraform).
4. Custom agent service account created (via Terraform).
"""

import argparse
import os
import sys
from pathlib import Path

# WORKAROUND: Patch protobuf parser to ignore the undocumented 'effectiveIdentity' field
# returned by the Vertex AI API, which causes a ParseError in the SDK (Issue #6321).
try:
    import google.protobuf.json_format as json_format
    _original_parse = json_format.Parse

    def _patched_parse(text, message, ignore_unknown_fields=False, descriptor_pool=None):
        return _original_parse(
            text, 
            message, 
            ignore_unknown_fields=True, 
            descriptor_pool=descriptor_pool
        )
    json_format.Parse = _patched_parse
except Exception:
    pass

# Add backend directory to Python path if run from elsewhere and load environment variables
BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

try:
    from dotenv import load_dotenv
    load_dotenv(BACKEND_DIR / ".env")
except ImportError:
    pass

def deploy_agent(agent_name, project_id, region, staging_bucket, service_account_email):
    import vertexai
    from vertexai.preview.reasoning_engines import ReasoningEngine
    import os

    print(f"\n==================================================")
    print(f"Deploying agent '{agent_name}' to Agent Runtime...")
    print(f"==================================================")

    # Change current working directory to BACKEND_DIR so tar.add archives relative paths
    os.chdir(str(BACKEND_DIR))

    # Initialize Vertex AI
    vertexai.init(
        project=project_id,
        location=region,
        staging_bucket=f"gs://{staging_bucket}"
    )

    # Entrypoint spec
    entrypoint = f"agents.{agent_name}.agent_runtime_app:agent_runtime"

    # Files and packages to package and upload (using relative paths for archive structure)
    extra_packages = [
        "agents",
        "schemas.py",
        "taxonomy.py",
        "profile.py",
        "development.py",
        "dilemas_postprocess.py"
    ]

    # Required packages in the Reasoning Engine environment
    requirements = [
        "google-adk",
        "google-genai",
        "pydantic>=2.0.0",
        "python-dotenv",
        "elevenlabs",
        "supabase",
        "google-cloud-logging",
        "google-cloud-aiplatform>=1.129.0"
    ]

    # Check for existing reasoning engines with the same display name
    display_name = f"dominikito-{agent_name}"
    description = f"Dominikito {agent_name.capitalize()} Agent"

    print(f"Staging Bucket: gs://{staging_bucket}")
    print(f"Service Account: {service_account_email}")
    print(f"Entrypoint: {entrypoint}")
    print(f"Display Name: {display_name}")

    # Import the local agent runtime instance
    import importlib
    try:
        module = importlib.import_module(f"agents.{agent_name}.agent_runtime_app")
        local_agent_runtime = getattr(module, "agent_runtime")
    except Exception as e:
        print(f"\n❌ Error importing local agent runtime for '{agent_name}': {e}")
        sys.exit(1)

    try:
        # Deploy Reasoning Engine
        engine = ReasoningEngine.create(
            reasoning_engine=local_agent_runtime,
            requirements=requirements,
            extra_packages=extra_packages,
            display_name=display_name,
            description=description,
            sys_version="3.10", # Specify Python runtime version
        )
        print(f"\n✓ Successfully deployed agent '{agent_name}'!")
        print(f"Reasoning Engine Resource Name: {engine.resource_name}")
        return engine.resource_name
    except Exception as e:
        print(f"\n❌ Error deploying agent '{agent_name}': {e}")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Deploy Dominikito ADK agents to Vertex AI Reasoning Engines.")
    parser.add_argument("--project", default=os.environ.get("GCP_PROJECT_ID"), help="GCP Project ID")
    parser.add_argument("--region", default=os.environ.get("GCP_REGION", "us-central1"), help="GCP Region")
    parser.add_argument("--bucket", default=os.environ.get("GCS_STAGING_BUCKET"), help="GCS Staging Bucket Name")
    parser.add_argument("--sa", default=os.environ.get("GCP_SERVICE_ACCOUNT"), help="Custom Agent Service Account Email")
    parser.add_argument("--agent", choices=["all", "cuentista", "dilemas", "narrador"], default="all", help="Agent to deploy")

    args = parser.parse_args()

    # Validate that we have all required parameters
    missing = []
    if not args.project:
        missing.append("GCP_PROJECT_ID (env) or --project (cli)")
    if not args.bucket:
        missing.append("GCS_STAGING_BUCKET (env) or --bucket (cli)")
    if not args.sa:
        missing.append("GCP_SERVICE_ACCOUNT (env) or --sa (cli)")

    if missing:
        print(f"\n❌ Error: Missing required deployment parameter(s):")
        for item in missing:
            print(f" - {item}")
        print("\nPlease define them in your backend/.env file or pass them as arguments.")
        sys.exit(1)

    # Verify we can import vertexai and install dependencies if missing
    try:
        import vertexai
    except ImportError:
        print("Installing required google-cloud-aiplatform library...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "google-cloud-aiplatform>=1.129.0"])
        import vertexai

    agents = ["cuentista", "dilemas", "narrador"] if args.agent == "all" else [args.agent]

    deployed_engines = {}
    for agent in agents:
        resource_name = deploy_agent(
            agent_name=agent,
            project_id=args.project,
            region=args.region,
            staging_bucket=args.bucket,
            service_account_email=args.sa
        )
        deployed_engines[agent] = resource_name

    print("\n==================================================")
    print("Deployment Summary:")
    for agent, resource in deployed_engines.items():
        print(f" - {agent}: {resource}")
    print("==================================================")

if __name__ == "__main__":
    main()
