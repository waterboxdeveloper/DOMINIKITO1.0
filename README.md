# Dominikito

> [!NOTE]
> Para ver instrucciones detalladas de desarrollo, arquitectura y despliegue del proyecto, por favor consulta [README_DEV.md](file:///Users/bbeltri/Documents/projects/Dominikito/DOMINIKITO1.0/README_DEV.md).

**Project Logo:** ![Project Logo](project-logo.png)

Track: 👁️ New Interfaces

## Team 28
- Eduardo Guzman Castañón ([@waterboxdeveloper](https://github.com/waterboxdeveloper))
- Adrián Balderas Lara ([@adrianbalderas](https://github.com/adrianbalderas))
- Emmanuel Beltran ([@manolobrn](https://github.com/manolobrn))
- Roger Rea ([@rogerrea](https://github.com/rogerrea))
- Syndel Callisaya ([@syndel1](https://github.com/syndel1))

## Overview
Dominikito is a web application for child emotional profiling through interactive storytelling. Using Google ADK and Gemini, the app generates personalized stories and presents moral dilemmas to the child. Decisions are logged securely in Firestore and aggregated in a dashboard for parents. The system also features dynamic image generation and text-to-speech narrations.

## Running Locally
1. Go to the backend directory: `cd backend`
2. Create a virtual environment: `python3 -m venv .venv`
3. Activate the environment: `source .venv/bin/activate`
4. Install dependencies: `pip install -r requirements.txt`
5. Configure the `.env` file with your Google API key and ElevenLabs API key.
6. Start the server: `python api.py`
