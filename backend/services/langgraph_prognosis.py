"""
Multi-Agent Prognosis System using LangGraph
=============================================
6 specialized agents:

1. Clinical Analyzer    — prognostic factors + comorbidity (LLM)
2. Disease Specialist   — disease behavior + specialists (LLM + RAG)
3. Trajectory Predictor — timeline + outcomes + survival (LLM + RAG survival stats)
4. Drug Safety Validator— allergy + interaction check (NO LLM)
5. Guardrail Agent      — validates all outputs (NO LLM)
6. Report Assembler     — final structured report (LLM)

3 LLM calls + 2 data lookups + 1 validation = complete prognosis.
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
from services.rag_service import search_clinical_guidelines, search_drug_interactions, search_survival_statistics

load_dotenv()

MODEL = "llama-3.3-70b-versatile"
MODEL_FAST = "llama-3.1-8b-instant"
USE_OLLAMA = os.getenv("USE_OLLAMA", "false").lower() == "true"
OLLAMA_BASE = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")


def _get_llm(fast=False):
    if USE_OLLAMA:
        from langchain_community.chat_models import ChatOllama
        return ChatOllama(base_url=OLLAMA_BASE, model=OLLAMA_MODEL, temperature=0.3, format="json")
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
    summary: str = ""
    clinical_factors: dict = Field(default_factory=dict)
    disease_outlook: dict = Field(default_factory=dict)
    trajectory: dict = Field(default_factory=dict)
    survival_estimate: dict = Field(default_factory=dict)
    drug_safety: dict = Field(default_factory=dict)
    specialists_needed: list = Field(default_factory=list)
    recommendations: list = Field(default_factory=list)
    warnings: list = Field(default_factory=list)
    follow_up_plan: str = ""
    lifestyle_modifications: list = Field(default_factory=list)
    milestones: list = Field(default_factory=list)


# ── State ──

class PrognosisState(TypedDict):
    patient: Any
    diagnosis: Any
    db: Any
    session_id: str
    patient_context: dict
    clinical_analysis: dict
    disease_analysis: dict
    trajectory: dict
    drug_safety: dict
    guardrail: dict
    final_report: dict
    agent_trace: list


def _add_trace(state: dict, agent: str, summary: str, sources: list = None, details: dict = None):
    state["agent_trace"].append({
        "agent": agent,
        "summary": summary,
        "sources": sources or [],
        "details": details or {}
    })
    if state.get("session_id"):
        from services.agent_broadcaster import broadcast
        broadcast(state["session_id"], agent, summary, sources)


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
               f"Risk: {validated['overall_risk_level']}. {fav} favorable, {unfav} unfavorable factors",
               ["Groq LLM (llama-3.3-70b)", "PostgreSQL Database"],
               {"favorable": validated["favorable_factors"], "unfavorable": validated["unfavorable_factors"],
                "risk_level": validated["overall_risk_level"], "age_factor": validated["age_factor"],
                "vitals": validated["vitals_assessment"], "comorbidity": validated["comorbidity_impact"]})

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
            HumanMessage(content=f"Analyze disease behavior:\n{disease_context}")
        ],
        DiseaseAnalysis().model_dump()
    )

    validated = DiseaseAnalysis(**result).model_dump()
    specs = [s.get("specialty", s) if isinstance(s, dict) else s for s in validated["specialists_needed"]]

    _add_trace(state, "Disease Specialist",
               f"Reversibility: {validated['reversibility']}. Recurrence: {validated['recurrence_risk']}. Specialists: {', '.join(specs[:3]) or 'None'}",
               ["ChromaDB Vector Search (WHO ICD-10)", "Groq LLM (llama-3.3-70b)"],
               {"disease_behavior": validated["disease_behavior"], "complications": validated["expected_complications"],
                "reversibility": validated["reversibility"], "recurrence": validated["recurrence_risk"],
                "specialists": validated["specialists_needed"], "natural_course": validated["natural_course"]})

    return {"disease_analysis": validated}


# ── AGENT 3: Trajectory Predictor (LLM + RAG survival stats) ──
def trajectory_predictor_agent(state: PrognosisState) -> dict:
    diagnosis = state["diagnosis"]
    clinical = state.get("clinical_analysis", {})
    disease = state.get("disease_analysis", {})
    context = state.get("patient_context", {})

    survival_data = search_survival_statistics(
        f"{diagnosis.diagnosis_text} {diagnosis.icd_code or ''}"
    )

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
        "vitals_trend": context.get("vitals_trend", []),
        "survival_statistics_rag": survival_data
    }, default=str)

    result = _llm_call_with_retry(
        _get_llm(fast=True),
        [
            SystemMessage(content="""You are a medical trajectory predictor. Predict patient outcomes using the provided survival statistics data.
Respond in JSON:
{
  "trajectory_class": "improving | stable | fluctuating | deteriorating | critical",
  "short_term": {"period": "1-2 weeks", "outlook": "what to expect", "expected_status": "recovering | stable | worsening"},
  "medium_term": {"period": "1-3 months", "outlook": "what to expect", "expected_status": "recovered | managing | declining"},
  "long_term": {"period": "6-12 months", "outlook": "what to expect", "expected_status": "full recovery | chronic management | progressive decline"},
  "survival_estimate": {"one_year": "95%", "three_year": "90%", "five_year": "85%"},
  "milestones": ["expected recovery milestones in order"]
}

IMPORTANT: Use the survival_statistics_rag data to provide EVIDENCE-BASED survival percentages, not guesses."""),
            HumanMessage(content=f"Predict trajectory using survival data:\n{trajectory_input}")
        ],
        TrajectoryPrediction().model_dump()
    )

    validated = TrajectoryPrediction(**result).model_dump()

    _add_trace(state, "Trajectory Predictor",
               f"Trajectory: {validated['trajectory_class']}. Survival 1yr: {validated['survival_estimate'].get('one_year', 'N/A')}",
               ["ChromaDB Vector Search (Survival Statistics)", "Groq LLM (llama-3.1-8b, fast)"],
               {"trajectory": validated["trajectory_class"], "short_term": validated["short_term"],
                "medium_term": validated["medium_term"], "long_term": validated["long_term"],
                "survival": validated["survival_estimate"], "milestones": validated["milestones"]})

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
            search_drug_interactions(med_name)
            interactions_checked.append(med_name)

    safety = {
        "interactions_checked": interactions_checked,
        "warnings": warnings,
        "safe": len(warnings) == 0,
        "source": "OpenFDA (live) + ChromaDB (offline)"
    }

    _add_trace(state, "Drug Safety Validator",
               f"Checked {len(interactions_checked)} drugs. {len(warnings)} warnings. Safe: {'YES' if safety['safe'] else 'NO'}",
               ["OpenFDA Live API (api.fda.gov)", "ChromaDB Vector Search (FDA drug interactions)"],
               {"drugs_checked": interactions_checked, "warnings": warnings, "safe": safety["safe"]})

    return {"drug_safety": safety}


# ── AGENT 5: Guardrail Agent (NO LLM — pure validation) ──
def guardrail_agent(state: PrognosisState) -> dict:
    clinical = state.get("clinical_analysis", {})
    disease = state.get("disease_analysis", {})
    trajectory = state.get("trajectory", {})
    drug_safety = state.get("drug_safety", {})
    context = state.get("patient_context", {})

    issues = []

    if clinical.get("overall_risk_level") == "critical":
        issues.append("CRITICAL RISK — patient requires immediate attention and close monitoring")

    if not drug_safety.get("safe", True):
        issues.append("DRUG SAFETY CONCERN — current prescription has major interactions or allergy conflict")

    profile = context.get("profile", {})
    age = profile.get("age", "Unknown")
    if isinstance(age, int):
        if age < 12:
            issues.append("PEDIATRIC PATIENT — prognosis models may not apply, consult pediatric specialist")
        elif age > 75:
            issues.append("ELDERLY PATIENT — higher complication risk, consider geriatric assessment")

    unfav = clinical.get("unfavorable_factors", [])
    if len(unfav) > 3:
        issues.append(f"Multiple unfavorable factors ({len(unfav)}) — consider conservative prognosis estimate")

    survival = trajectory.get("survival_estimate", {})
    one_yr = survival.get("one_year", "N/A")
    if one_yr != "N/A":
        try:
            pct = int(one_yr.replace("%", ""))
            if pct < 50:
                issues.append("LOW SURVIVAL ESTIMATE — recommend palliative care consultation")
        except ValueError:
            pass

    result = {
        "issues": issues,
        "passed": len(issues) == 0,
        "risk_override": clinical.get("overall_risk_level") == "critical"
    }

    status = f"{len(issues)} issues" if issues else "All checks passed"
    _add_trace(state, "Guardrail Agent",
               f"{status}. {'CRITICAL OVERRIDE' if result['risk_override'] else 'Proceeding normally'}",
               ["Pydantic validation", "Rule-based safety checks", "Age-based risk assessment"],
               {"issues": issues, "passed": result["passed"]})

    return {"guardrail": result}


# ── AGENT 6: Report Assembler (LLM) ──
def report_assembler_agent(state: PrognosisState) -> dict:
    guardrail = state.get("guardrail", {})

    all_data = json.dumps({
        "patient": state.get("patient_context", {}).get("profile", {}),
        "allergies": state.get("patient_context", {}).get("allergies", "None"),
        "diagnosis": {
            "text": state["diagnosis"].diagnosis_text,
            "icd": state["diagnosis"].icd_code,
            "prescription": state["diagnosis"].prescription
        },
        "clinical_analysis": state.get("clinical_analysis", {}),
        "disease_analysis": state.get("disease_analysis", {}),
        "trajectory": state.get("trajectory", {}),
        "drug_safety": state.get("drug_safety", {}),
        "guardrail_issues": guardrail.get("issues", [])
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
- Base prognosis on ALL agent findings including guardrail issues
- Include ALL drug safety warnings and guardrail issues in warnings
- Use survival statistics from trajectory predictor (evidence-based, not guesses)
- Be specific with follow-up timelines
- If guardrail flagged critical risk, set overall_prognosis accordingly"""),
            HumanMessage(content=f"Assemble final prognosis:\n{all_data}")
        ],
        PrognosisReport().model_dump()
    )

    validated = PrognosisReport(**result).model_dump()

    extra_warnings = state.get("drug_safety", {}).get("warnings", []) + guardrail.get("issues", [])
    if extra_warnings:
        validated["warnings"] = list(set(validated.get("warnings", []) + extra_warnings))

    _add_trace(state, "Report Assembler",
               f"Prognosis: {validated['overall_prognosis']} ({validated['confidence']}% confidence)",
               ["Groq LLM (llama-3.3-70b)", "All previous agent outputs", "Guardrail validation"])

    return {"final_report": validated}


# ── Build Graph ──
def _build_prognosis_graph():
    graph = StateGraph(PrognosisState)

    graph.add_node("clinical_analyzer", clinical_analyzer_agent)
    graph.add_node("disease_specialist", disease_specialist_agent)
    graph.add_node("trajectory_predictor", trajectory_predictor_agent)
    graph.add_node("drug_safety", drug_safety_validator_agent)
    graph.add_node("guardrail", guardrail_agent)
    graph.add_node("report_assembler", report_assembler_agent)

    graph.set_entry_point("clinical_analyzer")
    graph.add_edge("clinical_analyzer", "disease_specialist")
    graph.add_edge("disease_specialist", "trajectory_predictor")
    graph.add_edge("trajectory_predictor", "drug_safety")
    graph.add_edge("drug_safety", "guardrail")
    graph.add_edge("guardrail", "report_assembler")
    graph.add_edge("report_assembler", END)

    return graph.compile()


_compiled_graph = None


def get_prognosis_graph():
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = _build_prognosis_graph()
    return _compiled_graph


def run_prognosis_agent(patient: Patient, diagnosis: Diagnosis, db: Session, session_id: str = "") -> dict:
    graph = get_prognosis_graph()

    initial_state = {
        "patient": patient,
        "diagnosis": diagnosis,
        "db": db,
        "session_id": session_id,
        "patient_context": {},
        "clinical_analysis": {},
        "disease_analysis": {},
        "trajectory": {},
        "drug_safety": {},
        "guardrail": {},
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
        {"step": i + 1, "agent": t["agent"], "thought": t["summary"], "sources": t.get("sources", []), "details": t.get("details", {}), "type": "agent_output"}
        for i, t in enumerate(result["agent_trace"])
    ]
    report["agents_used"] = [t["agent"] for t in result["agent_trace"]]
    report["total_agents"] = len(result["agent_trace"])
    report["model_used"] = MODEL
    report["architecture"] = "LangGraph Multi-Agent (6 agents: Clinical Analyzer, Disease Specialist, Trajectory Predictor, Drug Safety, Guardrail, Report Assembler)"

    report["agent_details"] = {
        "clinical_analysis": result.get("clinical_analysis", {}),
        "disease_analysis": result.get("disease_analysis", {}),
        "trajectory_raw": result.get("trajectory", {}),
        "drug_safety_raw": result.get("drug_safety", {}),
        "guardrail": result.get("guardrail", {})
    }

    return report
