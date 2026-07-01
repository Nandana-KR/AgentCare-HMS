# AgentCare HMS

**AI-Powered Hospital Management System with Multi-Agent Diagnosis & Prognosis**

A full-stack hospital management system that uses 12 AI agents to assist doctors in diagnosing patients and predicting outcomes. Built with React, FastAPI, PostgreSQL, and LangGraph.

---

## Live Demo

**Frontend:** [hospital-ms-nandana.vercel.app](https://hospital-ms-nandana.vercel.app)

### Demo Credentials
Click any card on the login page to auto-fill:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@hms.com | Admin@123 |
| Doctor | doctor@hms.com | Doctor@123 |
| Receptionist | reception@hms.com | Reception@123 |
| Nurse | nurse@hms.com | Nurse@123 |

---

## What This Project Does

### The Problem
Doctors manually diagnose patients based on symptoms, memory, and experience. This process can miss drug interactions, doesn't always follow latest guidelines, and has no safety checks before prescribing.

### The Solution
AgentCare HMS automates the clinical workflow with AI agents that:
- Match symptoms to WHO ICD-10 disease codes using RAG
- Check drug interactions against FDA's database in real-time
- Validate prescriptions for allergies and age-based safety
- Predict patient outcomes with evidence-based survival statistics
- Generate structured clinical reports with full explanations

---

## How the AI Works

### Diagnosis Pipeline — 6 Agents

When a doctor enters symptoms, 6 specialized AI agents work in sequence:

```
Doctor enters: "fever, cough, patient on warfarin"

Agent 1: Triage Agent (LLM)
   Checks for emergencies, classifies urgency
   Output: "Routine - upper respiratory symptoms"

Agent 2: Patient Context (Database - zero tokens)
   Pulls vitals, history, medications from database
   Output: "Patient on warfarin, no allergies, vitals normal"

Agent 3: Clinical Matcher (LLM + RAG)
   Searches ChromaDB for WHO ICD-10 codes
   Output: "J06.9 - Acute URI, 90% confidence"

Agent 4: Drug Safety (OpenFDA + ChromaDB - zero tokens)
   Checks FDA's live database for drug interactions
   Output: "DON'T prescribe ibuprofen - warfarin interaction"

Agent 5: Guardrail (Rule-based - zero tokens)
   Validates age, allergies, drug safety
   Output: "All checks passed"

Agent 6: Synthesizer (LLM)
   Combines all findings into final report
   Output: "Acetaminophen 500mg (safe with warfarin)"
```

Only 3 out of 6 agents use LLM calls. The other 3 are data lookups, saving 50% on tokens.

### Prognosis Pipeline — 6 Agents

```
Agent 1: Clinical Analyzer   - favorable/unfavorable factors
Agent 2: Disease Specialist   - disease behavior, complications (RAG)
Agent 3: Trajectory Predictor - 1/3/5-year survival (evidence-based)
Agent 4: Drug Safety          - interaction check
Agent 5: Guardrail            - validates all outputs
Agent 6: Report Assembler     - final prognosis report
```

---

## RAG — How AI Retrieves Medical Knowledge

The AI doesn't rely on memory alone. It searches real medical databases first:

```
Offline (ChromaDB Vector DB):
  - 35 WHO ICD-10 disease codes with treatments
  - 40 FDA drug interactions with severity
  - 25 survival statistics with outcomes

Online (OpenFDA Live API):
  - Real-time drug safety from FDA's database
  - Millions of drug interaction records
  - Automatic offline fallback if API is down
```

---

## Features

### Clinical
- Multi-step diagnosis workflow (record, AI generate, review, save)
- AI prognosis with trajectory and survival estimates
- Voice input for hands-free symptom entry
- PDF export for clinical documentation
- Drug interaction checking (live FDA + offline)
- Allergy-aware prescriptions
- Auto-cancel no-show appointments after 24 hours

### User Roles
| Role | Access |
|------|--------|
| **Admin** | Manage staff, reset passwords, view all data |
| **Doctor** | Diagnose patients, generate prognosis, prescribe |
| **Receptionist** | Register patients, book appointments, filter by doctor |
| **Nurse** | Record vitals, view patient data |

### Technical
- WebSocket real-time agent status updates
- In-memory caching (40% token savings)
- Stage-based survival baselines (evidence-based)
- Factor reconciliation (validates AI output against patient data)
- Explanation fields (every AI decision explains WHY)
- Guardrail validation (age, allergy, drug safety)
- LangSmith observability for agent tracing
- Ollama fallback for offline AI

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **AI/ML** | LangGraph, LangChain, Groq (Llama 3.3 70B), ChromaDB, RAG, OpenFDA API, Pydantic, LangSmith, Ollama |
| **Backend** | Python, FastAPI, SQLAlchemy, PostgreSQL, Alembic, JWT, bcrypt, WebSocket |
| **Frontend** | React, Vite, Axios, Web Speech API |
| **DevOps** | GitHub Actions, Render, Vercel, pytest |

---

## Architecture

```
  React (Vercel)  --->  FastAPI (Railway)  --->  PostgreSQL
                              |
                        LangGraph Pipeline
                              |
                 +------------+------------+
                 |            |            |
            ChromaDB     OpenFDA API    Groq LLM
            (Vector DB)  (Live Drug)   (Llama 3.3)
                 |            |            |
            ICD-10 codes  Drug Safety   Diagnosis
            Drug data     Interactions  Prognosis
            Survival      Adverse       Synthesis
            Statistics    Events
```

---

## Project Structure

```
AgentCare-HMS/
  backend/
    routers/           API endpoints (auth, patients, appointments, diagnosis, prognosis)
    services/
      langgraph_diagnosis.py    6-agent diagnosis pipeline
      langgraph_prognosis.py    6-agent prognosis pipeline
      rag_service.py            ChromaDB + OpenFDA RAG
      agent_tools.py            Database query tools
      cache_service.py          In-memory caching
      agent_broadcaster.py      WebSocket broadcasting
    models/              Database models
    schemas/             Pydantic schemas
    data/                RAG knowledge base (ICD-10, drugs, survival)
    tests/               28 pytest test cases
  frontend/
    src/pages/           13 React pages
    src/components/      Sidebar, Toast, Modal
    src/styles/          Glassmorphism theme
  .github/workflows/    CI/CD pipeline
```

---

## Local Setup

### Backend
```bash
cd backend
pip install -r requirements.txt

# .env file
DATABASE_URL=postgresql://user:pass@localhost/agentcare
SECRET_KEY=your-secret
GROQ_API_KEY=your-groq-key

alembic upgrade head
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Running Tests

```bash
cd backend
pytest tests/ -v
```

28 test cases covering auth, patients, appointments, diagnoses, RAG, and caching. CI/CD runs automatically via GitHub Actions on every push.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/auth/login | Login |
| POST | /api/v1/users/register | Register staff |
| GET | /api/v1/patients/ | List patients |
| POST | /api/v1/diagnoses/ai-diagnose | Run AI diagnosis |
| POST | /api/v1/prognosis/generate | Run AI prognosis |
| GET | /cache-stats | Cache statistics |
| WS | /ws/diagnosis/{id} | Live agent status |

---

Built by [Nandana KR](https://github.com/Nandana-KR)
