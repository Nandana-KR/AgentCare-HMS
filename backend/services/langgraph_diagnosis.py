"""
Multi-Agent Diagnosis System using LangGraph
=============================================
5 specialized agents orchestrated via LangGraph StateGraph:

1. Triage Agent        — emergency detection, urgency classification (LLM)
2. Patient Context     — gathers all patient data from DB (NO LLM)
3. Clinical Matcher    — matches symptoms to ICD-10 via RAG (LLM)
4. Drug Safety Agent   — checks interactions via OpenFDA + ChromaDB (NO LLM)
5. Diagnosis Synthesizer — combines everything into final report (LLM)

Only 3 LLM calls total. 2 agents are pure data lookups.
"""
import json
import os
from typing import TypedDict, Any
from dotenv import load_dotenv

from langgraph.graph import StateGraph, END
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage

from sqlalchemy.orm import Session
from models.patient import Patient
from services.agent_tools import (
    get_patient_profile, get_medical_history, get_current_medications,
    get_latest_vitals, get_vitals_trend, find_similar_past_cases, detect_emergency
)
from services.rag_service import search_clinical_guidelines, search_drug_interactions

load_dotenv()

MODEL = "llama-3.3-70b-versatile"


def _get_llm():
    return ChatGroq(
        api_key=os.getenv("GROQ_API_KEY"),
        model=MODEL,
        temperature=0.2,
        max_tokens=1200,
        model_kwargs={"response_format": {"type": "json_object"}}
    )


class DiagnosisState(TypedDict):
    patient: Any
    symptoms: str
    db: Any
    triage: dict
    patient_context: dict
    clinical_match: dict
    drug_safety: dict
    final_report: dict
    agent_trace: list
    error: str


def _add_trace(state: dict, agent: str, summary: str):
    state["agent_trace"].append({"agent": agent, "summary": summary})


# ── AGENT 1: Triage Agent (LLM) ──
def triage_agent(state: DiagnosisState) -> dict:
    symptoms = state["symptoms"]

    rule_based = detect_emergency(symptoms)

    llm = _get_llm()
    response = llm.invoke([
        SystemMessage(content="""You are a medical triage AI. Analyze the symptoms and classify urgency.
Respond in JSON:
{
  "urgency": "emergency | urgent | routine",
  "initial_assessment": "brief clinical impression",
  "key_symptoms": ["list", "of", "identified", "symptoms"],
  "systems_involved": ["respiratory", "cardiovascular", etc],
  "triage_reasoning": "why this urgency level"
}"""),
        HumanMessage(content=f"Patient symptoms: {symptoms}")
    ])

    try:
        result = json.loads(response.content)
    except json.JSONDecodeError:
        result = {"urgency": "routine", "initial_assessment": symptoms, "key_symptoms": [symptoms]}

    if rule_based.get("is_emergency"):
        result["urgency"] = "emergency"
        result["emergency_flags"] = rule_based["red_flags"]

    _add_trace(state, "Triage Agent", f"Urgency: {result.get('urgency', 'routine')} — {result.get('initial_assessment', '')}")

    return {"triage": result}


# ── AGENT 2: Patient Context Agent (NO LLM — pure DB lookup) ──
def patient_context_agent(state: DiagnosisState) -> dict:
    patient = state["patient"]
    db = state["db"]
    symptoms = state["symptoms"]

    context = {
        "profile": get_patient_profile(patient),
        "vitals": get_latest_vitals(patient.id, db),
        "vitals_trend": get_vitals_trend(patient.id, db),
        "medical_history": get_medical_history(patient.id, db),
        "current_medications": get_current_medications(patient.id, db),
        "similar_past_cases": find_similar_past_cases(patient.id, symptoms, db)
    }

    med_count = len(context["current_medications"].get("active_medications", []))
    history_count = len(context["medical_history"])
    vitals_status = "anomalies detected" if context["vitals"].get("anomalies") else "normal"

    _add_trace(state, "Patient Context Agent",
               f"Profile loaded. {history_count} past diagnoses, {med_count} active medications, vitals: {vitals_status}")

    return {"patient_context": context}


# ── AGENT 3: Clinical Matcher (LLM + RAG) ──
def clinical_matcher_agent(state: DiagnosisState) -> dict:
    symptoms = state["symptoms"]
    triage = state["triage"]
    context = state["patient_context"]

    rag_results = search_clinical_guidelines(symptoms)

    patient_info = json.dumps({
        "profile": context["profile"],
        "vitals": context["vitals"],
        "history_summary": [h.get("diagnosis", "") for h in context["medical_history"][:5]],
        "key_symptoms": triage.get("key_symptoms", []),
        "systems_involved": triage.get("systems_involved", [])
    }, default=str)

    rag_context = json.dumps(rag_results, default=str)

    llm = _get_llm()
    response = llm.invoke([
        SystemMessage(content="""You are a clinical diagnosis AI. Match symptoms to conditions using the provided WHO ICD-10 medical knowledge.
Respond in JSON:
{
  "primary_diagnosis": {"code": "ICD-10 code", "title": "condition name", "confidence": 85, "reasoning": "why"},
  "differentials": [
    {"code": "code", "title": "name", "confidence": 60, "reasoning": "why"},
    {"code": "code", "title": "name", "confidence": 30, "reasoning": "why"}
  ],
  "recommended_treatment": "evidence-based treatment from guidelines",
  "recommended_tests": ["test1", "test2"],
  "red_flags_to_watch": ["flag1", "flag2"]
}"""),
        HumanMessage(content=f"""Patient data: {patient_info}

WHO ICD-10 Knowledge Base Results:
{rag_context}

Symptoms: {symptoms}

Match to the most appropriate ICD-10 diagnosis using the knowledge base. Provide evidence-based treatment from the guidelines.""")
    ])

    try:
        result = json.loads(response.content)
    except json.JSONDecodeError:
        result = {"primary_diagnosis": {"code": "", "title": symptoms, "confidence": 50}}

    primary = result.get("primary_diagnosis", {})
    _add_trace(state, "Clinical Matcher",
               f"Primary: {primary.get('title', '')} ({primary.get('code', '')}) — {primary.get('confidence', 0)}% confidence. Source: WHO ICD-10 RAG")

    return {"clinical_match": result}


# ── AGENT 4: Drug Safety Agent (NO LLM — OpenFDA + ChromaDB) ──
def drug_safety_agent(state: DiagnosisState) -> dict:
    context = state["patient_context"]
    clinical = state["clinical_match"]

    current_meds = context["current_medications"]
    recommended = clinical.get("recommended_treatment", "")

    safety_results = {}

    med_list = current_meds.get("active_medications", [])
    if med_list:
        for med in med_list[:3]:
            med_name = med.get("medication", "").split()[0]
            if med_name:
                safety_results[med_name] = search_drug_interactions(med_name)

    if recommended:
        first_drug = recommended.split()[0]
        if first_drug and len(first_drug) > 3:
            safety_results[f"recommended_{first_drug}"] = search_drug_interactions(first_drug)

    warnings = []
    for drug, data in safety_results.items():
        if isinstance(data, dict):
            for interaction in data.get("offline_interactions", []):
                if interaction.get("severity") in ("major", "contraindicated"):
                    warnings.append(f"⚠ {interaction.get('drug_a', '')} + {interaction.get('drug_b', '')}: {interaction.get('severity', '')} — see drug safety data")
            for live in data.get("live_fda_data", []):
                if isinstance(live, dict) and live.get("interactions"):
                    warnings.append(f"FDA: {live['interactions'][:200]}")

    result = {
        "interactions_checked": list(safety_results.keys()),
        "warnings": warnings,
        "raw_data": safety_results,
        "source": "OpenFDA (live) + ChromaDB (offline)"
    }

    warning_count = len(warnings)
    _add_trace(state, "Drug Safety Agent",
               f"Checked {len(safety_results)} drugs. {warning_count} warnings found. Source: OpenFDA + ChromaDB")

    return {"drug_safety": result}


# ── AGENT 5: Diagnosis Synthesizer (LLM — final report) ──
def diagnosis_synthesizer(state: DiagnosisState) -> dict:
    llm = _get_llm()

    context_summary = json.dumps({
        "triage": state["triage"],
        "patient": state["patient_context"]["profile"],
        "vitals": state["patient_context"]["vitals"],
        "medical_history": state["patient_context"]["medical_history"][:3],
        "current_medications": state["patient_context"]["current_medications"],
        "clinical_match": state["clinical_match"],
        "drug_safety_warnings": state["drug_safety"]["warnings"]
    }, default=str)

    response = llm.invoke([
        SystemMessage(content="""You are a senior physician AI synthesizing a final diagnosis report from multiple specialist agents.
You MUST respond in this exact JSON format:
{
  "diagnosis_text": "Clear diagnosis in 1-2 sentences",
  "icd_code": "ICD-10 code",
  "differentials": [
    {"diagnosis": "name", "icd_code": "code", "confidence": 85, "reasoning": "why"},
    {"diagnosis": "name", "icd_code": "code", "confidence": 60, "reasoning": "why"},
    {"diagnosis": "name", "icd_code": "code", "confidence": 30, "reasoning": "why"}
  ],
  "prescription": "specific medication with dosage, frequency, duration",
  "warnings": ["safety warnings from drug interactions"],
  "recommended_tests": ["tests to confirm diagnosis"],
  "follow_up": "follow-up plan with timeline",
  "lifestyle_advice": "diet, exercise, habits",
  "urgency": "routine | urgent | emergency",
  "watchlist": ["things to monitor"],
  "confidence_breakdown": {
    "symptom_match": 90,
    "history_correlation": 75,
    "vitals_support": 80
  },
  "clinical_notes": "summary for the doctor"
}

Rules:
- Use the clinical matcher's ICD-10 findings for diagnosis
- NEVER prescribe a drug that has a major/contraindicated interaction from drug safety
- Include ALL drug safety warnings in the warnings field
- Be specific with prescriptions: drug, dose, frequency, duration"""),
        HumanMessage(content=f"Synthesize final diagnosis from these agent findings:\n{context_summary}")
    ])

    try:
        result = json.loads(response.content)
    except json.JSONDecodeError:
        result = {
            "diagnosis_text": "Unable to complete AI analysis. Please diagnose manually.",
            "icd_code": "",
            "differentials": [],
            "prescription": "",
            "warnings": ["AI synthesis failed — manual review required"],
            "recommended_tests": [],
            "follow_up": "",
            "lifestyle_advice": "",
            "urgency": state["triage"].get("urgency", "routine"),
            "watchlist": [],
            "confidence_breakdown": {"symptom_match": 0, "history_correlation": 0, "vitals_support": 0},
            "clinical_notes": "Multi-agent synthesis failed. Individual agent data may still be useful."
        }

    _add_trace(state, "Diagnosis Synthesizer",
               f"Final: {result.get('diagnosis_text', '')} — ICD: {result.get('icd_code', '')}")

    return {"final_report": result}


# ── Build the LangGraph ──
def _build_graph():
    graph = StateGraph(DiagnosisState)

    graph.add_node("triage", triage_agent)
    graph.add_node("patient_context", patient_context_agent)
    graph.add_node("clinical_matcher", clinical_matcher_agent)
    graph.add_node("drug_safety", drug_safety_agent)
    graph.add_node("synthesizer", diagnosis_synthesizer)

    graph.set_entry_point("triage")
    graph.add_edge("triage", "patient_context")
    graph.add_edge("patient_context", "clinical_matcher")
    graph.add_edge("clinical_matcher", "drug_safety")
    graph.add_edge("drug_safety", "synthesizer")
    graph.add_edge("synthesizer", END)

    return graph.compile()


_compiled_graph = None


def get_graph():
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = _build_graph()
    return _compiled_graph


def run_diagnosis_agent(patient: Patient, symptoms: str, db: Session) -> dict:
    graph = get_graph()

    initial_state = {
        "patient": patient,
        "symptoms": symptoms,
        "db": db,
        "triage": {},
        "patient_context": {},
        "clinical_match": {},
        "drug_safety": {},
        "final_report": {},
        "agent_trace": [],
        "error": ""
    }

    result = graph.invoke(initial_state)

    report = result["final_report"]
    report["reasoning_trace"] = [
        {"step": i + 1, "agent": t["agent"], "thought": t["summary"], "type": "agent_output"}
        for i, t in enumerate(result["agent_trace"])
    ]
    report["tools_called"] = [t["agent"] for t in result["agent_trace"]]
    report["total_steps"] = len(result["agent_trace"])
    report["model_used"] = MODEL
    report["architecture"] = "LangGraph Multi-Agent (5 agents, 3 LLM calls)"

    return report
