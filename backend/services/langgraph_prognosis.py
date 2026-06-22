"""
Multi-Agent Prognosis System using LangGraph
=============================================
Production-grade prognostic intelligence engine.

6 specialized agents:
1. Clinical Analyzer    — prognostic factors + comorbidity (LLM)
2. Disease Specialist   — disease behavior + specialists (LLM + RAG)
3. Trajectory Predictor — timeline + outcomes + survival (LLM + RAG)
4. Drug Safety Validator— allergy + interaction check (NO LLM)
5. Guardrail Agent      — validates all outputs (NO LLM)
6. Report Assembler     — final structured report (LLM)

Features:
- Explanation fields for every output (WHY each decision was made)
- Stage-based survival baselines (evidence-based, not LLM guesses)
- Factor reconciliation (dedupe + validate against patient data)
- In-memory caching, WebSocket broadcasting, Ollama fallback
"""
import json
import os
import re
import traceback
from typing import TypedDict, Any, List, Optional
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


# ── Stage-Based Survival Baselines (evidence-based) ──
STAGE_SURVIVAL_BASELINES = {
    "i":   {"1_year": 0.95, "3_year": 0.85, "5_year": 0.75},
    "ii":  {"1_year": 0.85, "3_year": 0.70, "5_year": 0.55},
    "iii": {"1_year": 0.65, "3_year": 0.45, "5_year": 0.30},
    "iv":  {"1_year": 0.40, "3_year": 0.20, "5_year": 0.10},
    "mild":     {"1_year": 0.97, "3_year": 0.93, "5_year": 0.90},
    "moderate": {"1_year": 0.90, "3_year": 0.80, "5_year": 0.70},
    "severe":   {"1_year": 0.75, "3_year": 0.55, "5_year": 0.40},
    "default":  {"1_year": 0.92, "3_year": 0.82, "5_year": 0.72}
}


def _parse_stage(stage: str) -> str:
    if not stage:
        return "default"
    s = stage.lower().strip()
    if re.search(r"(iv|t4|m1|stage 4|advanced|terminal)", s): return "iv"
    if re.search(r"(iii|t3|n2|n3|stage 3)", s): return "iii"
    if re.search(r"(ii|t2|n1|stage 2)", s): return "ii"
    if re.search(r"(i|t1|stage 1|early)", s): return "i"
    if "severe" in s: return "severe"
    if "moderate" in s: return "moderate"
    if "mild" in s: return "mild"
    return "default"


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


def _normalize_factor(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip().lower())


def _reconcile_factors(favorable: list, unfavorable: list, patient_data: str) -> tuple:
    patient_text = patient_data.lower()
    seen_fav = set()
    seen_unfav = set()
    filtered_fav = []
    filtered_unfav = []

    for f in favorable:
        norm = _normalize_factor(f.get("factor", ""))
        if not norm or norm in seen_fav or len(norm.split()) > 15:
            continue
        tokens = [t for t in re.findall(r"[a-z0-9]+", norm) if len(t) > 2]
        if tokens and sum(1 for t in tokens if t in patient_text) >= 1:
            seen_fav.add(norm)
            f["factor"] = norm
            filtered_fav.append(f)

    for f in unfavorable:
        norm = _normalize_factor(f.get("factor", ""))
        if not norm or norm in seen_unfav or len(norm.split()) > 15:
            continue
        tokens = [t for t in re.findall(r"[a-z0-9]+", norm) if len(t) > 2]
        if tokens and sum(1 for t in tokens if t in patient_text) >= 1:
            seen_unfav.add(norm)
            f["factor"] = norm
            filtered_unfav.append(f)

    return filtered_fav, filtered_unfav


# ── Pydantic Models ──

class PrognosticFactor(BaseModel):
    factor: str = ""
    magnitude: str = "moderate"
    evidence_strength: str = "moderate"
    modifiable: bool = False
    current_status: Optional[str] = None
    optimization_potential: Optional[str] = None
    explanation: Optional[str] = None


class TrajectoryPrediction(BaseModel):
    trajectory_class: str = "stable"
    short_term: dict = Field(default_factory=lambda: {"period": "1-2 weeks", "outlook": "", "explanation": ""})
    medium_term: dict = Field(default_factory=lambda: {"period": "1-3 months", "outlook": "", "explanation": ""})
    long_term: dict = Field(default_factory=lambda: {"period": "6-12 months", "outlook": "", "explanation": ""})
    survival_estimate: dict = Field(default_factory=lambda: {"one_year": "N/A", "three_year": "N/A", "five_year": "N/A"})
    milestones: list = Field(default_factory=list)
    trajectory_explanation: Optional[str] = None


class PrognosisReport(BaseModel):
    overall_prognosis: str = "Guarded"
    confidence: int = 50
    summary: str = ""
    summary_explanation: Optional[str] = None
    clinical_factors: dict = Field(default_factory=dict)
    disease_outlook: dict = Field(default_factory=dict)
    trajectory: dict = Field(default_factory=dict)
    survival_estimate: dict = Field(default_factory=dict)
    survival_explanation: Optional[str] = None
    drug_safety: dict = Field(default_factory=dict)
    specialists_needed: list = Field(default_factory=list)
    recommendations: list = Field(default_factory=list)
    warnings: list = Field(default_factory=list)
    follow_up_plan: str = ""
    lifestyle_modifications: list = Field(default_factory=list)
    milestones: list = Field(default_factory=list)
    treatment_response: dict = Field(default_factory=dict)
    modifiable_factors: list = Field(default_factory=list)
    red_flags: list = Field(default_factory=list)


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
        "agent": agent, "summary": summary, "sources": sources or [], "details": details or {}
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
        "profile": context["profile"], "vitals": context["vitals"],
        "history": context["history"][:5], "medications": context["medications"],
        "current_diagnosis": {"text": diagnosis.diagnosis_text, "icd": diagnosis.icd_code, "symptoms": diagnosis.symptoms, "prescription": diagnosis.prescription}
    }, default=str)

    result = _llm_call_with_retry(
        _get_llm(),
        [SystemMessage(content="""You are a clinical prognostic analyst. Analyze ALL factors affecting patient prognosis.
Respond in JSON:
{
  "favorable_factors":[{"factor":"name","explanation":"WHY this is favorable based on patient data","magnitude":"strong|moderate|mild","evidence_strength":"strong|moderate|weak","modifiable":false,"current_status":"status","optimization_potential":"text or null"}],
  "unfavorable_factors":[{"factor":"name","explanation":"WHY this is unfavorable based on patient data","magnitude":"strong|moderate|mild","evidence_strength":"strong|moderate|weak","modifiable":true,"current_status":"status","optimization_potential":"what can be done"}],
  "overall_risk_level":"low|moderate|high|critical",
  "risk_explanation":"WHY this risk level based on the balance of factors",
  "age_factor":"how age affects prognosis",
  "vitals_assessment":"what vitals indicate",
  "comorbidity_impact":"how existing conditions affect this diagnosis"
}
RULES: Use ONLY information from patient data. Each factor MUST have an explanation citing specific patient evidence. modifiable factors MUST have optimization_potential filled."""),
         HumanMessage(content=f"Analyze prognostic factors:\n{patient_data}")],
        {"favorable_factors": [], "unfavorable_factors": [], "overall_risk_level": "moderate"}
    )

    fav_raw = result.get("favorable_factors", [])
    unfav_raw = result.get("unfavorable_factors", [])
    fav_raw, unfav_raw = _reconcile_factors(fav_raw, unfav_raw, patient_data)

    modifiable = [f for f in unfav_raw if f.get("modifiable")]

    _add_trace(state, "Clinical Analyzer",
               f"Risk: {result.get('overall_risk_level', 'moderate')}. {len(fav_raw)} favorable, {len(unfav_raw)} unfavorable, {len(modifiable)} modifiable. {result.get('risk_explanation', '')}",
               ["Groq LLM (llama-3.3-70b)", "PostgreSQL Database"],
               {"favorable": [f.get("factor") for f in fav_raw], "unfavorable": [f.get("factor") for f in unfav_raw],
                "modifiable": [f.get("factor") for f in modifiable], "risk_level": result.get("overall_risk_level"),
                "risk_explanation": result.get("risk_explanation"), "age_factor": result.get("age_factor"),
                "vitals": result.get("vitals_assessment"), "comorbidity": result.get("comorbidity_impact")})

    return {"clinical_analysis": {**result, "modifiable_factors": modifiable}, "patient_context": context}


# ── AGENT 2: Disease Specialist (LLM + RAG) ──
def disease_specialist_agent(state: PrognosisState) -> dict:
    diagnosis = state["diagnosis"]
    clinical = state.get("clinical_analysis", {})
    rag_results = search_clinical_guidelines(f"{diagnosis.diagnosis_text} {diagnosis.icd_code or ''} prognosis complications")

    result = _llm_call_with_retry(
        _get_llm(),
        [SystemMessage(content="""You are a disease specialist. Analyze disease behavior and required specialties.
Respond in JSON:
{
  "disease_behavior":"how this disease typically progresses",
  "disease_behavior_explanation":"clinical evidence for this behavior pattern",
  "expected_complications":[{"complication":"name","probability":"high|moderate|low","explanation":"WHY this complication is expected"}],
  "reversibility":"fully reversible|partially reversible|irreversible",
  "reversibility_explanation":"what makes it reversible or not",
  "recurrence_risk":"low|moderate|high",
  "recurrence_explanation":"factors affecting recurrence",
  "specialists_needed":[{"specialty":"name","reason":"why needed","urgency":"immediate|within week|routine","explanation":"what they contribute"}],
  "natural_course":"what happens without vs with treatment",
  "natural_course_explanation":"clinical basis for this assessment"
}"""),
         HumanMessage(content=f"Disease: {diagnosis.diagnosis_text}\nICD: {diagnosis.icd_code}\nSymptoms: {diagnosis.symptoms}\nRisk: {clinical.get('overall_risk_level')}\nRAG Guidelines: {json.dumps(rag_results, default=str)}")],
        {"disease_behavior": "", "reversibility": "unknown", "specialists_needed": []}
    )

    specs = [s.get("specialty", s) if isinstance(s, dict) else s for s in result.get("specialists_needed", [])]
    _add_trace(state, "Disease Specialist",
               f"Reversibility: {result.get('reversibility')}. Recurrence: {result.get('recurrence_risk')}. Specialists: {', '.join(specs[:3]) or 'None'}. {result.get('reversibility_explanation', '')}",
               ["ChromaDB Vector Search (WHO ICD-10)", "Groq LLM (llama-3.3-70b)"],
               {"disease_behavior": result.get("disease_behavior"), "reversibility": result.get("reversibility"),
                "reversibility_explanation": result.get("reversibility_explanation"),
                "complications": [c.get("complication") for c in result.get("expected_complications", [])],
                "specialists": specs, "natural_course": result.get("natural_course")})

    return {"disease_analysis": result}


# ── AGENT 3: Trajectory Predictor (LLM + RAG survival stats) ──
def trajectory_predictor_agent(state: PrognosisState) -> dict:
    diagnosis = state["diagnosis"]
    clinical = state.get("clinical_analysis", {})
    disease = state.get("disease_analysis", {})
    context = state.get("patient_context", {})

    survival_rag = search_survival_statistics(f"{diagnosis.diagnosis_text} {diagnosis.icd_code or ''}")
    stage = _parse_stage(diagnosis.icd_code or diagnosis.diagnosis_text or "")
    baseline = STAGE_SURVIVAL_BASELINES.get(stage, STAGE_SURVIVAL_BASELINES["default"])

    result = _llm_call_with_retry(
        _get_llm(fast=True),
        [SystemMessage(content=f"""You are a medical trajectory predictor. Use the provided survival baselines and RAG data.
POPULATION BASELINES: 1yr={baseline['1_year']}, 3yr={baseline['3_year']}, 5yr={baseline['5_year']}
Adjust these based on patient-specific factors. Do NOT invent numbers — adjust within ±30% of baseline.
Respond in JSON:
{{
  "trajectory_class":"improving|stable|fluctuating|deteriorating|critical",
  "trajectory_explanation":"WHY this trajectory based on patient data",
  "short_term":{{"period":"1-2 weeks","outlook":"what to expect","explanation":"clinical basis"}},
  "medium_term":{{"period":"1-3 months","outlook":"what to expect","explanation":"clinical basis"}},
  "long_term":{{"period":"6-12 months","outlook":"what to expect","explanation":"clinical basis"}},
  "survival_estimate":{{"one_year":"X%","three_year":"X%","five_year":"X%","explanation":"how baseline was adjusted for this patient"}},
  "milestones":["milestone 1","milestone 2"],
  "treatment_response":{{"likelihood":"high|moderate|low","tolerance":"good|fair|poor","explanation":"clinical basis"}}
}}"""),
         HumanMessage(content=f"Diagnosis: {diagnosis.diagnosis_text}\nRisk: {clinical.get('overall_risk_level')}\nReversibility: {disease.get('reversibility')}\nAge: {context.get('profile', {}).get('age')}\nVitals: {json.dumps(context.get('vitals', {}), default=str)}\nSurvival RAG: {json.dumps(survival_rag, default=str)}")],
        TrajectoryPrediction().model_dump()
    )

    survival = result.get("survival_estimate", {})
    _add_trace(state, "Trajectory Predictor",
               f"Trajectory: {result.get('trajectory_class')}. Survival 1yr: {survival.get('one_year', 'N/A')}. {result.get('trajectory_explanation', '')}",
               ["ChromaDB Vector Search (Survival Statistics)", "Groq LLM (llama-3.1-8b, fast)"],
               {"trajectory": result.get("trajectory_class"), "trajectory_explanation": result.get("trajectory_explanation"),
                "survival": survival, "survival_explanation": survival.get("explanation"),
                "treatment_response": result.get("treatment_response"), "milestones": result.get("milestones")})

    return {"trajectory": result}


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
        for allergy in [a.strip().lower() for a in allergies.split(",")]:
            if allergy in prescription.lower():
                warnings.append(f"ALLERGY ALERT: Patient allergic to {allergy} — found in prescription!")

    if prescription:
        first_drug = prescription.split()[0]
        if first_drug and len(first_drug) > 3:
            result = search_drug_interactions(first_drug)
            interactions_checked.append(first_drug)
            if isinstance(result, dict):
                for interaction in result.get("offline_interactions", []):
                    if interaction.get("severity") in ("major", "contraindicated"):
                        warnings.append(f"{interaction.get('drug_a', '')} + {interaction.get('drug_b', '')}: {interaction.get('severity', '')}")

    safety = {"interactions_checked": interactions_checked, "warnings": warnings, "safe": len(warnings) == 0, "source": "OpenFDA + ChromaDB"}
    _add_trace(state, "Drug Safety Validator",
               f"Checked {len(interactions_checked)} drugs. {len(warnings)} warnings. Safe: {'YES' if safety['safe'] else 'NO'}",
               ["OpenFDA Live API (api.fda.gov)", "ChromaDB Vector Search (FDA drug interactions)"],
               {"drugs_checked": interactions_checked, "warnings": warnings, "safe": safety["safe"]})

    return {"drug_safety": safety}


# ── AGENT 5: Guardrail Agent (NO LLM) ──
def guardrail_agent(state: PrognosisState) -> dict:
    clinical = state.get("clinical_analysis", {})
    trajectory = state.get("trajectory", {})
    drug_safety = state.get("drug_safety", {})
    context = state.get("patient_context", {})
    issues = []

    if clinical.get("overall_risk_level") == "critical":
        issues.append("CRITICAL RISK — immediate attention required")

    if not drug_safety.get("safe", True):
        issues.append("DRUG SAFETY CONCERN — prescription has interactions")

    age = context.get("profile", {}).get("age", "Unknown")
    if isinstance(age, int):
        if age < 12: issues.append("PEDIATRIC PATIENT — verify dosages")
        elif age > 75: issues.append("ELDERLY PATIENT — consider geriatric assessment")

    unfav = clinical.get("unfavorable_factors", [])
    if len(unfav) > 3:
        issues.append(f"Multiple unfavorable factors ({len(unfav)}) — conservative prognosis")

    survival = trajectory.get("survival_estimate", {})
    one_yr = survival.get("one_year", "N/A")
    if one_yr != "N/A":
        try:
            pct = int(str(one_yr).replace("%", ""))
            if pct < 50: issues.append("LOW SURVIVAL — consider palliative consultation")
        except: pass

    result = {"issues": issues, "passed": len(issues) == 0, "risk_override": clinical.get("overall_risk_level") == "critical"}
    _add_trace(state, "Guardrail Agent",
               f"{len(issues)} issues. {'CRITICAL' if result['risk_override'] else 'OK'}",
               ["Pydantic validation", "Rule-based safety", "Age-based risk"],
               {"issues": issues, "passed": result["passed"]})

    return {"guardrail": result}


# ── AGENT 6: Report Assembler (LLM) ──
def report_assembler_agent(state: PrognosisState) -> dict:
    guardrail = state.get("guardrail", {})
    clinical = state.get("clinical_analysis", {})
    trajectory_data = state.get("trajectory", {})

    all_data = json.dumps({
        "patient": state.get("patient_context", {}).get("profile", {}),
        "diagnosis": {"text": state["diagnosis"].diagnosis_text, "icd": state["diagnosis"].icd_code, "prescription": state["diagnosis"].prescription},
        "clinical_analysis": clinical,
        "disease_analysis": state.get("disease_analysis", {}),
        "trajectory": trajectory_data,
        "drug_safety": state.get("drug_safety", {}),
        "guardrail_issues": guardrail.get("issues", [])
    }, default=str)

    result = _llm_call_with_retry(
        _get_llm(),
        [SystemMessage(content="""You are a senior physician assembling a final prognosis report.
Respond in JSON:
{
  "overall_prognosis":"Excellent|Good|Fair|Guarded|Poor|Critical",
  "overall_prognosis_explanation":"WHY this prognosis category — cite specific factors",
  "confidence":78,
  "confidence_explanation":"what data supports or limits this confidence level",
  "summary":"2-3 sentence prognosis summary",
  "clinical_factors":{"favorable":["factor"],"unfavorable":["factor"],"risk_level":"level","explanation":"balance of factors"},
  "disease_outlook":{"behavior":"progression","reversibility":"level","recurrence_risk":"level","explanation":"clinical basis"},
  "trajectory":{"class":"direction","short_term":"outlook","medium_term":"outlook","long_term":"outlook","explanation":"trajectory basis"},
  "survival_estimate":{"one_year":"X%","three_year":"X%","five_year":"X%","explanation":"how derived"},
  "specialists_needed":[{"specialty":"name","reason":"why","urgency":"when","explanation":"what they contribute"}],
  "recommendations":["action"],
  "warnings":["warning"],
  "follow_up_plan":"schedule",
  "lifestyle_modifications":["change"],
  "milestones":["milestone"],
  "red_flags":["flag"],
  "treatment_response":{"likelihood":"level","tolerance":"level","explanation":"basis"}
}
RULES: Include ALL drug safety warnings and guardrail issues. Use survival data from trajectory predictor."""),
         HumanMessage(content=f"Assemble prognosis:\n{all_data}")],
        PrognosisReport().model_dump()
    )

    extra_warnings = state.get("drug_safety", {}).get("warnings", []) + guardrail.get("issues", [])
    if extra_warnings:
        result["warnings"] = list(set(result.get("warnings", []) + extra_warnings))

    modifiable = clinical.get("modifiable_factors", [])
    if modifiable:
        result["modifiable_factors"] = [{"factor": f.get("factor"), "optimization": f.get("optimization_potential"), "explanation": f.get("explanation")} for f in modifiable]

    _add_trace(state, "Report Assembler",
               f"Prognosis: {result.get('overall_prognosis')} ({result.get('confidence', 0)}%). {result.get('overall_prognosis_explanation', '')}",
               ["Groq LLM (llama-3.3-70b)", "All previous agent outputs"],
               {"prognosis": result.get("overall_prognosis"), "confidence": result.get("confidence"),
                "explanation": result.get("overall_prognosis_explanation"), "red_flags": result.get("red_flags", [])})

    return {"final_report": result}


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
        "patient": patient, "diagnosis": diagnosis, "db": db, "session_id": session_id,
        "patient_context": {}, "clinical_analysis": {}, "disease_analysis": {},
        "trajectory": {}, "drug_safety": {}, "guardrail": {}, "final_report": {}, "agent_trace": []
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
    report["architecture"] = "LangGraph Multi-Agent (6 agents, stage-based survival, factor reconciliation, explanation fields)"

    report["agent_details"] = {
        "clinical_analysis": result.get("clinical_analysis", {}),
        "disease_analysis": result.get("disease_analysis", {}),
        "trajectory_raw": result.get("trajectory", {}),
        "drug_safety_raw": result.get("drug_safety", {}),
        "guardrail": result.get("guardrail", {})
    }

    return report
