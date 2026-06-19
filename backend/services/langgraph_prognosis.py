"""
Multi-Agent Prognosis System using LangGraph
=============================================
5 specialized agents:

1. Clinical Analyzer    — prognostic factors + comorbidity impact (LLM)
2. Disease Specialist   — disease behavior + specialist recommendations (LLM + RAG)
3. Trajectory Predictor — timeline + outcomes + survival estimation (LLM)
4. Drug Safety Validator— reuses existing RAG pipeline (NO LLM)
5. Report Assembler     — final structured prognosis report (LLM)

3 LLM calls + 1 data lookup = complete prognosis.
"""
import json
import os
import traceback
from typing import TypedDict, Any
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from langgraph.graph import StateGraph, END
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage

from sqlalchemy.orm import Session
from models.patient import Patient
from models.diagnosis import Diagnosis
from services.agent_tools import (
    get_patient_profile, get_medical_history, get_current_medications,
    get_latest_vitals, get_vitals_trend
)
from services.rag_service import search_clinical_guidelines, search_drug_interactions

load_dotenv()

MODEL = "llama-3.3-70b-versatile"
MODEL_FAST = "llama-3.1-8b-instant"


def _get_llm(fast=False):
    return ChatGroq(
        api_key=os.getenv("GROQ_API_KEY"),
        model=MODEL_FAST if fast else MODEL,
        temperature=0.3,
        max_tokens=1500,
        model_kwargs={"response_format": {"type": "json_object"}}
    )


def _llm_call_with_retry(llm, messages, fallback: dict, max_retries: int = 2) -> dict:
    for attempt in range(max_retries):
        try:
            response = llm.invoke(messages)
            return json.loads(response.content)
        except Exception as e:
            if attempt == max_retries - 1:
                print(f"Prognosis LLM call failed: {e}")
                return fallback
    return fallback


# ── Pydantic Models ──

class ClinicalAnalysis(BaseModel):
    favorable_factors: list = Field(default_factory=list)
    unfavorable_factors: list = Field(default_factory=list)
    comorbidity_impact: str = "No significant comorbidities identified"
    overall_risk_level: str = "moderate"
    age_factor: str = ""
    vitals_assessment: str = ""


class DiseaseAnalysis(BaseModel):
    disease_behavior: str = ""
    expected_complications: list = Field(default_factory=list)
    reversibility: str = ""
    recurrence_risk: str = ""
    specialists_needed: list = Field(default_factory=list)
    natural_course: str = ""


class TrajectoryPrediction(BaseModel):
    trajectory_class: str = "stable"
    short_term: dict = Field(default_factory=lambda: {"period": "1-2 weeks", "outlook": "", "expected_status": ""})
    medium_term: dict = Field(default_factory=lambda: {"period": "1-3 months", "outlook": "", "expected_status": ""})
    long_term: dict = Field(default_factory=lambda: {"period": "6-12 months", "outlook": "", "expected_status": ""})
    survival_estimate: dict = Field(default_factory=lambda: {"one_year": "N/A", "three_year": "N/A", "five_year": "N/A"})
    milestones: list = Field(default_factory=list)


class PrognosisReport(BaseModel):
    overall_prognosis: str = "Guarded"
    confidence: int = 50
    clinical_analysis: dict = Field(default_factory=dict)
    disease_analysis: dict = Field(default_factory=dict)
    trajectory: dict = Field(default_factory=dict)
    drug_safety: dict = Field(default_factory=dict)
    recommendations: list = Field(default_factory=list)
    warnings: list = Field(default_factory=list)
    follow_up_plan: str = ""
    lifestyle_modifications: list = Field(default_factory=list)


# ── State ──

class PrognosisState(TypedDict):
    patient: Any
    diagnosis: Any
    db: Any
    patient_context: dict
    clinical_analysis: dict
    disease_analysis: dict
    trajectory: dict
    drug_safety: dict
    final_report: dict
    agent_trace: list


def _add_trace(state: dict, agent: str, summary: str, sources: list = None):
    state["agent_trace"].append({
        "agent": agent,
        "summary": summary,
        "sources": sources or []
    })


# ── AGENT 1: Clinical Analyzer (LLM) ──
def clinical_analyzer_agent(state: PrognosisState) -> dict:
    patient = state["patient"]
    diagnosis = state["diagnosis"]
    db = state["db"]

    context = {
        "profile": get_patient_profile(patient),
        "vitals": get_latest_vitals(patient.id, db),
        "vitals_trend": get_vitals_trend(patient.id, db),
        "history": get_medical_history(patient.id, db),
        "medications": get_current_medications(patient.id, db),
        "allergies": getattr(patient, 'allergies', None) or "None recorded"
    }

    state["patient_context"] = context

    patient_data = json.dumps({
        "profile": context["profile"],
        "vitals": context["vitals"],
        "vitals_trend": context["vitals_trend"],
        "history": context["history"][:5],
        "medications": context["medications"],
        "allergies": context["allergies"],
        "current_diagnosis": {
            "text": diagnosis.diagnosis_text,
            "icd": diagnosis.icd_code,
            "symptoms": diagnosis.symptoms,
            "prescription": diagnosis.prescription
        }
    }, default=str)

    result = _llm_call_with_retry(
        _get_llm(),
        [
            SystemMessage(content="""You are a clinical prognostic analyst. Analyze ALL factors affecting patient prognosis.
Respond in JSON:
{
  "favorable_factors": ["factor1", "factor2"],
  "unfavorable_factors": ["factor1", "factor2"],
  "comorbidity_impact": "how existing conditions affect this diagnosis",
  "overall_risk_level": "low | moderate | high | critical",
  "age_factor": "how age affects prognosis",
  "vitals_assessment": "what vitals indicate about severity and trend"
}"""),
            HumanMessage(content=f"Analyze prognostic factors:\n{patient_data}")
        ],
        ClinicalAnalysis().model_dump()
    )

    validated = ClinicalAnalysis(**result).model_dump()

    fav = len(validated["favorable_factors"])
    unfav = len(validated["unfavorable_factors"])
    _add_trace(state, "Clinical Analyzer",
               f"Risk: {validated['overall_risk_level']}. {fav} favorable, {unfav} unfavorable factors. {validated['comorbidity_impact'][:100]}",
               ["Groq LLM (llama-3.3-70b)", "PostgreSQL Database"])

    return {"clinical_analysis": validated, "patient_context": context}


# ── AGENT 2: Disease Specialist (LLM + RAG) ──
def disease_specialist_agent(state: PrognosisState) -> dict:
    diagnosis = state["diagnosis"]
    clinical = state.get("clinical_analysis", {})

    rag_results = search_clinical_guidelines(
        f"{diagnosis.diagnosis_text} {diagnosis.icd_code or ''} prognosis complications"
    )

    disease_context = json.dumps({
        "diagnosis": diagnosis.diagnosis_text,
        "icd_code": diagnosis.icd_code,
        "symptoms": diagnosis.symptoms,
        "risk_level": clinical.get("overall_risk_level", "moderate"),
        "unfavorable_factors": clinical.get("unfavorable_factors", []),
        "rag_guidelines": rag_results
    }, default=str)

    result = _llm_call_with_retry(
        _get_llm(),
        [
            SystemMessage(content="""You are a disease specialist analyzing disease behavior and required specialties.
Respond in JSON:
{
  "disease_behavior": "how this disease typically progresses",
  "expected_complications": ["complication1", "complication2"],
  "reversibility": "fully reversible | partially reversible | irreversible | depends on treatment",
  "recurrence_risk": "low | moderate | high — with explanation",
  "specialists_needed": [
    {"specialty": "name", "reason": "why needed", "urgency": "immediate | within week | routine"}
  ],
  "natural_course": "what happens without treatment vs with treatment"
}"""),
            HumanMessage(content=f"Analyze disease behavior and specialist needs:\n{disease_context}")
        ],
        DiseaseAnalysis().model_dump()
    )

    validated = DiseaseAnalysis(**result).model_dump()
    specs = [s.get("specialty", s) if isinstance(s, dict) else s for s in validated["specialists_needed"]]

    _add_trace(state, "Disease Specialist",
               f"Reversibility: {validated['reversibility']}. Recurrence: {validated['recurrence_risk']}. Specialists: {', '.join(specs[:3]) or 'None'}",
               ["ChromaDB Vector Search (WHO ICD-10)", "Groq LLM (llama-3.3-70b)"])

    return {"disease_analysis": validated}


# ── AGENT 3: Trajectory Predictor (LLM) ──
def trajectory_predictor_agent(state: PrognosisState) -> dict:
    diagnosis = state["diagnosis"]
    clinical = state.get("clinical_analysis", {})
    disease = state.get("disease_analysis", {})
    context = state.get("patient_context", {})

    trajectory_input = json.dumps({
        "diagnosis": diagnosis.diagnosis_text,
        "icd_code": diagnosis.icd_code,
        "prescription": diagnosis.prescription,
        "risk_level": clinical.get("overall_risk_level", "moderate"),
        "favorable": clinical.get("favorable_factors", []),
        "unfavorable": clinical.get("unfavorable_factors", []),
        "reversibility": disease.get("reversibility", ""),
        "complications": disease.get("expected_complications", []),
        "patient_age": context.get("profile", {}).get("age", "Unknown"),
        "vitals_trend": context.get("vitals_trend", [])
    }, default=str)

    result = _llm_call_with_retry(
        _get_llm(fast=True),
        [
            SystemMessage(content="""You are a medical trajectory predictor. Predict patient outcomes over time.
Respond in JSON:
{
  "trajectory_class": "improving | stable | fluctuating | deteriorating | critical",
  "short_term": {"period": "1-2 weeks", "outlook": "what to expect", "expected_status": "recovering | stable | worsening"},
  "medium_term": {"period": "1-3 months", "outlook": "what to expect", "expected_status": "recovered | managing | declining"},
  "long_term": {"period": "6-12 months", "outlook": "what to expect", "expected_status": "full recovery | chronic management | progressive decline"},
  "survival_estimate": {"one_year": "95%", "three_year": "90%", "five_year": "85%"},
  "milestones": ["expected recovery milestones in order"]
}"""),
            HumanMessage(content=f"Predict trajectory:\n{trajectory_input}")
        ],
        TrajectoryPrediction().model_dump()
    )

    validated = TrajectoryPrediction(**result).model_dump()

    _add_trace(state, "Trajectory Predictor",
               f"Trajectory: {validated['trajectory_class']}. Short-term: {validated['short_term'].get('expected_status', '')}. Survival 1yr: {validated['survival_estimate'].get('one_year', 'N/A')}",
               ["Groq LLM (llama-3.1-8b, fast)", "Clinical + Disease analysis"])


    return {"trajectory": validated}


# ── AGENT 4: Drug Safety Validator (NO LLM) ──
def drug_safety_validator_agent(state: PrognosisState) -> dict:
    diagnosis = state["diagnosis"]
    context = state.get("patient_context", {})

    prescription = diagnosis.prescription or ""
    medications = context.get("medications", {})
    allergies = context.get("allergies", "None recorded")

    warnings = []
    interactions_checked = []

    if allergies and allergies != "None recorded":
        allergy_list = [a.strip().lower() for a in allergies.split(",")]
        for allergy in allergy_list:
            if allergy in prescription.lower():
                warnings.append(f"ALLERGY ALERT: Patient allergic to {allergy} — found in current prescription!")

    if prescription:
        first_drug = prescription.split()[0]
        if first_drug and len(first_drug) > 3:
            result = search_drug_interactions(first_drug)
            interactions_checked.append(first_drug)
            if isinstance(result, dict):
                for interaction in result.get("offline_interactions", []):
                    if interaction.get("severity") in ("major", "contraindicated"):
                        warnings.append(f"{interaction.get('drug_a', '')} + {interaction.get('drug_b', '')}: {interaction.get('severity', '')}")

    med_list = medications.get("active_medications", [])
    for med in med_list[:3]:
        med_name = med.get("medication", "").split()[0]
        if med_name and len(med_name) > 3:
            result = search_drug_interactions(med_name)
            interactions_checked.append(med_name)

    safety = {
        "interactions_checked": interactions_checked,
        "warnings": warnings,
        "safe": len(warnings) == 0,
        "source": "OpenFDA (live) + ChromaDB (offline)"
    }

    _add_trace(state, "Drug Safety Validator",
               f"Checked {len(interactions_checked)} drugs. {len(warnings)} warnings. Safe: {'YES' if safety['safe'] else 'NO'}",
               ["OpenFDA Live API (api.fda.gov)", "ChromaDB Vector Search (FDA drug interactions)"])

    return {"drug_safety": safety}


# ── AGENT 5: Report Assembler (LLM) ──
def report_assembler_agent(state: PrognosisState) -> dict:
    all_data = json.dumps({
        "patient": state.get("patient_context", {}).get("profile", {}),
        "diagnosis": {
            "text": state["diagnosis"].diagnosis_text,
            "icd": state["diagnosis"].icd_code,
            "prescription": state["diagnosis"].prescription
        },
        "clinical_analysis": state.get("clinical_analysis", {}),
        "disease_analysis": state.get("disease_analysis", {}),
        "trajectory": state.get("trajectory", {}),
        "drug_safety": state.get("drug_safety", {})
    }, default=str)

    result = _llm_call_with_retry(
        _get_llm(),
        [
            SystemMessage(content="""You are a senior physician assembling a final prognosis report from multiple specialist agents.
Respond in JSON:
{
  "overall_prognosis": "Excellent | Good | Fair | Guarded | Poor | Critical",
  "confidence": 78,
  "summary": "2-3 sentence overall prognosis summary",
  "clinical_factors": {
    "favorable": ["factor1"],
    "unfavorable": ["factor1"],
    "risk_level": "low | moderate | high | critical"
  },
  "disease_outlook": {
    "behavior": "how the disease will progress",
    "reversibility": "fully | partially | irreversible",
    "recurrence_risk": "low | moderate | high"
  },
  "trajectory": {
    "class": "improving | stable | fluctuating | deteriorating",
    "short_term": "1-2 week outlook",
    "medium_term": "1-3 month outlook",
    "long_term": "6-12 month outlook"
  },
  "survival_estimate": {"one_year": "95%", "three_year": "90%", "five_year": "85%"},
  "specialists_needed": [{"specialty": "name", "reason": "why", "urgency": "when"}],
  "recommendations": ["actionable recommendation 1", "recommendation 2"],
  "warnings": ["warning about complications or drug safety"],
  "follow_up_plan": "detailed follow-up schedule",
  "lifestyle_modifications": ["lifestyle change 1", "lifestyle change 2"],
  "milestones": ["recovery milestone 1", "milestone 2"]
}

Rules:
- Base prognosis on ALL agent findings
- Include ALL drug safety warnings
- Be specific with follow-up timelines
- Survival estimates should reflect the actual disease severity"""),
            HumanMessage(content=f"Assemble final prognosis from agent findings:\n{all_data}")
        ],
        PrognosisReport().model_dump()
    )

    if state.get("drug_safety", {}).get("warnings"):
        result.setdefault("warnings", [])
        result["warnings"] = list(set(result["warnings"] + state["drug_safety"]["warnings"]))

    _add_trace(state, "Report Assembler",
               f"Prognosis: {result.get('overall_prognosis', 'Unknown')} ({result.get('confidence', 0)}% confidence)",
               ["Groq LLM (llama-3.3-70b)", "All previous agent outputs"])

    return {"final_report": result}


# ── Build Graph ──
def _build_prognosis_graph():
    graph = StateGraph(PrognosisState)

    graph.add_node("clinical_analyzer", clinical_analyzer_agent)
    graph.add_node("disease_specialist", disease_specialist_agent)
    graph.add_node("trajectory_predictor", trajectory_predictor_agent)
    graph.add_node("drug_safety", drug_safety_validator_agent)
    graph.add_node("report_assembler", report_assembler_agent)

    graph.set_entry_point("clinical_analyzer")
    graph.add_edge("clinical_analyzer", "disease_specialist")
    graph.add_edge("disease_specialist", "trajectory_predictor")
    graph.add_edge("trajectory_predictor", "drug_safety")
    graph.add_edge("drug_safety", "report_assembler")
    graph.add_edge("report_assembler", END)

    return graph.compile()


_compiled_graph = None


def get_prognosis_graph():
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = _build_prognosis_graph()
    return _compiled_graph


def run_prognosis_agent(patient: Patient, diagnosis: Diagnosis, db: Session) -> dict:
    graph = get_prognosis_graph()

    initial_state = {
        "patient": patient,
        "diagnosis": diagnosis,
        "db": db,
        "patient_context": {},
        "clinical_analysis": {},
        "disease_analysis": {},
        "trajectory": {},
        "drug_safety": {},
        "final_report": {},
        "agent_trace": []
    }

    try:
        result = graph.invoke(initial_state)
    except Exception as e:
        traceback.print_exc()
        raise e

    report = result["final_report"]
    report["reasoning_trace"] = [
        {"step": i + 1, "agent": t["agent"], "thought": t["summary"], "sources": t.get("sources", []), "type": "agent_output"}
        for i, t in enumerate(result["agent_trace"])
    ]
    report["agents_used"] = [t["agent"] for t in result["agent_trace"]]
    report["total_agents"] = len(result["agent_trace"])
    report["model_used"] = MODEL
    report["architecture"] = "LangGraph Multi-Agent (5 agents: Clinical Analyzer, Disease Specialist, Trajectory Predictor, Drug Safety, Report Assembler)"

    return report
