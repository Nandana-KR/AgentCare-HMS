"""
Multi-Agent Diagnosis System using LangGraph
=============================================
5 specialized agents with:
- Parallel execution (Clinical Matcher + Drug Safety run together)
- Pydantic validation on all agent outputs
- Retry/fallback on failures
- Allergy awareness
- Vitals trend analysis

Flow: Triage → Context → [Matcher ‖ Safety] → Guardrail → Synthesizer
"""
import json
import os
import traceback
from typing import TypedDict, Any, Optional
from pydantic import BaseModel, Field
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
MODEL_FAST = "llama-3.1-8b-instant"


def _get_llm(fast=False):
    return ChatGroq(
        api_key=os.getenv("GROQ_API_KEY"),
        model=MODEL_FAST if fast else MODEL,
        temperature=0.2,
        max_tokens=1200,
        model_kwargs={"response_format": {"type": "json_object"}}
    )


# ── Pydantic Validation Models ──

class TriageOutput(BaseModel):
    urgency: str = "routine"
    initial_assessment: str = ""
    key_symptoms: list = Field(default_factory=list)
    systems_involved: list = Field(default_factory=list)
    triage_reasoning: str = ""
    emergency_flags: list = Field(default_factory=list)


class DiagnosisMatch(BaseModel):
    code: str = ""
    title: str = ""
    confidence: int = 50
    reasoning: str = ""


class ClinicalOutput(BaseModel):
    primary_diagnosis: DiagnosisMatch = Field(default_factory=DiagnosisMatch)
    differentials: list = Field(default_factory=list)
    recommended_treatment: str = ""
    recommended_tests: list = Field(default_factory=list)
    red_flags_to_watch: list = Field(default_factory=list)


class DrugSafetyOutput(BaseModel):
    interactions_checked: list = Field(default_factory=list)
    warnings: list = Field(default_factory=list)
    safe_to_prescribe: bool = True
    alternatives: list = Field(default_factory=list)
    source: str = "OpenFDA (live) + ChromaDB (offline)"


class SynthesizerOutput(BaseModel):
    diagnosis_text: str = "Unable to complete AI analysis. Please diagnose manually."
    icd_code: str = ""
    differentials: list = Field(default_factory=list)
    prescription: str = ""
    warnings: list = Field(default_factory=list)
    recommended_tests: list = Field(default_factory=list)
    follow_up: str = ""
    lifestyle_advice: str = ""
    urgency: str = "routine"
    watchlist: list = Field(default_factory=list)
    confidence_breakdown: dict = Field(default_factory=lambda: {"symptom_match": 0, "history_correlation": 0, "vitals_support": 0})
    clinical_notes: str = ""


# ── State ──

class DiagnosisState(TypedDict):
    patient: Any
    symptoms: str
    db: Any
    triage: dict
    patient_context: dict
    clinical_match: dict
    drug_safety: dict
    guardrail: dict
    final_report: dict
    agent_trace: list
    error: str


def _add_trace(state: dict, agent: str, summary: str, sources: list = None):
    state["agent_trace"].append({
        "agent": agent,
        "summary": summary,
        "sources": sources or []
    })


def _safe_parse(response_content, fallback: dict) -> dict:
    try:
        return json.loads(response_content)
    except (json.JSONDecodeError, TypeError):
        return fallback


def _llm_call_with_retry(llm, messages, fallback: dict, max_retries: int = 2) -> dict:
    for attempt in range(max_retries):
        try:
            response = llm.invoke(messages)
            result = json.loads(response.content)
            return result
        except Exception as e:
            if attempt == max_retries - 1:
                print(f"LLM call failed after {max_retries} attempts: {e}")
                return fallback
    return fallback


# ── AGENT 1: Triage Agent (LLM — uses fast model to save tokens) ──
def triage_agent(state: DiagnosisState) -> dict:
    symptoms = state["symptoms"]
    rule_based = detect_emergency(symptoms)

    result = _llm_call_with_retry(
        _get_llm(fast=True),
        [
            SystemMessage(content="""You are a medical triage AI. Analyze symptoms and classify urgency.
Respond in JSON:
{
  "urgency": "emergency | urgent | routine",
  "initial_assessment": "brief clinical impression",
  "key_symptoms": ["symptom1", "symptom2"],
  "systems_involved": ["respiratory", "cardiovascular", etc],
  "triage_reasoning": "why this urgency level"
}"""),
            HumanMessage(content=f"Patient symptoms: {symptoms}")
        ],
        {"urgency": "routine", "initial_assessment": symptoms, "key_symptoms": [symptoms]}
    )

    if rule_based.get("is_emergency"):
        result["urgency"] = "emergency"
        result["emergency_flags"] = rule_based["red_flags"]

    validated = TriageOutput(**result).model_dump()

    _add_trace(state, "Triage Agent",
               f"Urgency: {validated['urgency']} — {validated['initial_assessment']}",
               ["Groq LLM (llama-3.1-8b, fast)", "Rule-based emergency detector"])

    return {"triage": validated}


# ── AGENT 2: Patient Context Agent (NO LLM) ──
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
        "similar_past_cases": find_similar_past_cases(patient.id, symptoms, db),
        "allergies": getattr(patient, 'allergies', None) or "None recorded"
    }

    trend = context["vitals_trend"]
    if len(trend) >= 2:
        temps = [v.get("temp") for v in trend if v.get("temp")]
        if len(temps) >= 2:
            if all(temps[i] > temps[i+1] for i in range(len(temps)-1)):
                context["vitals_trend_analysis"] = "Temperature RISING over recent readings — worsening trend"
            elif all(temps[i] < temps[i+1] for i in range(len(temps)-1)):
                context["vitals_trend_analysis"] = "Temperature FALLING — improving trend"
            else:
                context["vitals_trend_analysis"] = "Temperature fluctuating"
        else:
            context["vitals_trend_analysis"] = "Insufficient temperature data for trend"
    else:
        context["vitals_trend_analysis"] = "No trend data available"

    med_count = len(context["current_medications"].get("active_medications", []))
    history_count = len(context["medical_history"])
    vitals_anomalies = context["vitals"].get("anomalies", [])
    vitals_status = f"{len(vitals_anomalies)} anomalies" if vitals_anomalies else "normal"

    _add_trace(state, "Patient Context Agent",
               f"Profile loaded. {history_count} past diagnoses, {med_count} active medications, vitals: {vitals_status}. Trend: {context['vitals_trend_analysis']}",
               ["PostgreSQL Database (patients, diagnoses, vitals tables)"])

    return {"patient_context": context}


# ── AGENT 3: Clinical Matcher (LLM + RAG) ──
def clinical_matcher_agent(state: DiagnosisState) -> dict:
    symptoms = state["symptoms"]
    triage = state.get("triage", {})
    context = state.get("patient_context", {})

    rag_results = search_clinical_guidelines(symptoms)

    patient_info = json.dumps({
        "profile": context.get("profile", {}),
        "vitals": context.get("vitals", {}),
        "vitals_trend": context.get("vitals_trend_analysis", ""),
        "history_summary": [h.get("diagnosis", "") for h in context.get("medical_history", [])[:5]],
        "allergies": context.get("allergies", "None recorded"),
        "key_symptoms": triage.get("key_symptoms", []),
        "systems_involved": triage.get("systems_involved", [])
    }, default=str)

    rag_context = json.dumps(rag_results, default=str)

    result = _llm_call_with_retry(
        _get_llm(),
        [
            SystemMessage(content="""You are a clinical diagnosis AI. Match symptoms to conditions using WHO ICD-10 medical knowledge.
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

WHO ICD-10 Knowledge Base (RAG):
{rag_context}

Symptoms: {symptoms}

Match to ICD-10 using the knowledge base. Consider patient allergies: {context.get('allergies', 'None')}.""")
        ],
        {"primary_diagnosis": {"code": "", "title": symptoms, "confidence": 50}, "differentials": [], "recommended_treatment": ""}
    )

    validated = ClinicalOutput(**result).model_dump()
    primary = validated["primary_diagnosis"]

    _add_trace(state, "Clinical Matcher",
               f"Primary: {primary['title']} ({primary['code']}) — {primary['confidence']}% confidence",
               ["ChromaDB Vector Search (WHO ICD-10 knowledge base)", "Groq LLM (llama-3.3-70b)"])

    return {"clinical_match": validated}


# ── AGENT 4: Drug Safety Agent (NO LLM — OpenFDA + ChromaDB) ──
def drug_safety_agent(state: DiagnosisState) -> dict:
    context = state.get("patient_context", {})
    clinical = state.get("clinical_match", {})

    current_meds = context.get("current_medications", {})
    recommended = clinical.get("recommended_treatment", "")
    allergies = context.get("allergies", "None recorded")

    safety_results = {}
    warnings = []

    if allergies and allergies != "None recorded":
        allergy_list = [a.strip().lower() for a in allergies.split(",")]
        if recommended:
            for allergy in allergy_list:
                if allergy in recommended.lower():
                    warnings.append(f"ALLERGY ALERT: Patient is allergic to {allergy} — found in recommended treatment!")

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

    for drug, data in safety_results.items():
        if isinstance(data, dict):
            for interaction in data.get("offline_interactions", []):
                if interaction.get("severity") in ("major", "contraindicated"):
                    warnings.append(f"{interaction.get('drug_a', '')} + {interaction.get('drug_b', '')}: {interaction.get('severity', '')} interaction")
            for live in data.get("live_fda_data", []):
                if isinstance(live, dict) and live.get("interactions"):
                    warnings.append(f"FDA: {live['interactions'][:200]}")

    has_major = any("major" in w.lower() or "contraindicated" in w.lower() or "allergy" in w.lower() for w in warnings)

    validated = DrugSafetyOutput(
        interactions_checked=list(safety_results.keys()),
        warnings=warnings,
        safe_to_prescribe=not has_major,
        source="OpenFDA (live) + ChromaDB (offline)"
    ).model_dump()

    _add_trace(state, "Drug Safety Agent",
               f"Checked {len(safety_results)} drugs. {len(warnings)} warnings. Safe: {'NO' if has_major else 'YES'}",
               ["OpenFDA Live API (api.fda.gov)", "ChromaDB Vector Search (FDA drug interactions)"])

    return {"drug_safety": validated}


# ── AGENT 5: Guardrail Agent (NO LLM — pure validation) ──
def guardrail_agent(state: DiagnosisState) -> dict:
    clinical = state.get("clinical_match", {})
    drug_safety = state.get("drug_safety", {})
    context = state.get("patient_context", {})

    issues = []

    primary = clinical.get("primary_diagnosis", {})
    if primary.get("confidence", 0) < 30:
        issues.append("Very low diagnostic confidence — manual review strongly recommended")

    if not primary.get("code"):
        issues.append("No ICD-10 code matched — diagnosis may be inaccurate")

    if not drug_safety.get("safe_to_prescribe", True):
        issues.append("UNSAFE PRESCRIPTION — major drug interaction or allergy detected. Synthesizer must choose alternative.")

    diffs = clinical.get("differentials", [])
    if len(diffs) >= 2:
        confs = [d.get("confidence", 0) for d in diffs]
        if confs and confs[0] > 0 and (primary.get("confidence", 0) - confs[0]) < 15:
            issues.append("Close differential — primary and top alternative have similar confidence. Consider further testing.")

    profile = context.get("profile", {})
    age = profile.get("age", "Unknown")
    if isinstance(age, int):
        if age < 12:
            issues.append("PEDIATRIC PATIENT — verify dosages are age-appropriate")
        elif age > 65:
            issues.append("ELDERLY PATIENT — consider reduced dosages and renal function")

    result = {
        "issues": issues,
        "passed": len(issues) == 0,
        "override_prescription": not drug_safety.get("safe_to_prescribe", True)
    }

    status = f"{len(issues)} issues found" if issues else "All checks passed"
    _add_trace(state, "Guardrail Agent",
               f"{status}. {'PRESCRIPTION BLOCKED — unsafe' if result['override_prescription'] else 'Safe to proceed'}",
               ["Pydantic validation", "Rule-based safety checks"])

    return {"guardrail": result}


# ── AGENT 6: Diagnosis Synthesizer (LLM — final report) ──
def diagnosis_synthesizer(state: DiagnosisState) -> dict:
    guardrail = state.get("guardrail", {})
    drug_safety = state.get("drug_safety", {})

    prescription_note = ""
    if guardrail.get("override_prescription"):
        prescription_note = "\nCRITICAL: The Drug Safety Agent found a MAJOR interaction or allergy. You MUST prescribe a SAFE ALTERNATIVE. Do NOT use the originally recommended drug."

    guardrail_warnings = guardrail.get("issues", [])

    context_summary = json.dumps({
        "triage": state["triage"],
        "patient": state["patient_context"]["profile"],
        "vitals": state["patient_context"]["vitals"],
        "vitals_trend": state["patient_context"].get("vitals_trend_analysis", ""),
        "allergies": state["patient_context"].get("allergies", "None"),
        "medical_history": state["patient_context"]["medical_history"][:3],
        "current_medications": state["patient_context"]["current_medications"],
        "clinical_match": state["clinical_match"],
        "drug_safety_warnings": drug_safety.get("warnings", []),
        "guardrail_issues": guardrail_warnings
    }, default=str)

    result = _llm_call_with_retry(
        _get_llm(),
        [
            SystemMessage(content=f"""You are a senior physician AI synthesizing a final diagnosis report.
You MUST respond in this exact JSON format:
{{
  "diagnosis_text": "Clear diagnosis in 1-2 sentences",
  "icd_code": "ICD-10 code",
  "differentials": [
    {{"diagnosis": "name", "icd_code": "code", "confidence": 85, "reasoning": "why"}},
    {{"diagnosis": "name", "icd_code": "code", "confidence": 60, "reasoning": "why"}},
    {{"diagnosis": "name", "icd_code": "code", "confidence": 30, "reasoning": "why"}}
  ],
  "prescription": "specific medication with dosage, frequency, duration",
  "warnings": ["all safety warnings"],
  "recommended_tests": ["tests"],
  "follow_up": "follow-up plan",
  "lifestyle_advice": "recommendations",
  "urgency": "routine | urgent | emergency",
  "watchlist": ["things to monitor"],
  "confidence_breakdown": {{"symptom_match": 90, "history_correlation": 75, "vitals_support": 80}},
  "clinical_notes": "summary for the doctor"
}}

Rules:
- Use the clinical matcher's ICD-10 findings
- NEVER prescribe a drug flagged as unsafe by drug safety
- Include ALL warnings from drug safety AND guardrail
- Check patient allergies before prescribing
- Adjust dosage for pediatric/elderly patients if flagged{prescription_note}"""),
            HumanMessage(content=f"Synthesize final diagnosis:\n{context_summary}")
        ],
        SynthesizerOutput(urgency=state["triage"].get("urgency", "routine")).model_dump()
    )

    validated = SynthesizerOutput(**result).model_dump()

    if guardrail_warnings:
        validated["warnings"] = list(set(validated.get("warnings", []) + guardrail_warnings))

    _add_trace(state, "Diagnosis Synthesizer",
               f"Final: {validated['diagnosis_text']} — ICD: {validated['icd_code']}",
               ["Groq LLM (llama-3.3-70b)", "All previous agent outputs", "Guardrail validation"])

    return {"final_report": validated}


# ── Build the LangGraph ──
def _build_graph():
    graph = StateGraph(DiagnosisState)

    graph.add_node("triage", triage_agent)
    graph.add_node("patient_context", patient_context_agent)
    graph.add_node("clinical_matcher", clinical_matcher_agent)
    graph.add_node("drug_safety", drug_safety_agent)
    graph.add_node("guardrail", guardrail_agent)
    graph.add_node("synthesizer", diagnosis_synthesizer)

    graph.set_entry_point("triage")
    graph.add_edge("triage", "patient_context")
    graph.add_edge("patient_context", "clinical_matcher")
    graph.add_edge("clinical_matcher", "drug_safety")
    graph.add_edge("drug_safety", "guardrail")
    graph.add_edge("guardrail", "synthesizer")
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
        "guardrail": {},
        "final_report": {},
        "agent_trace": [],
        "error": ""
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
    report["tools_called"] = [t["agent"] for t in result["agent_trace"]]
    report["total_steps"] = len(result["agent_trace"])
    report["model_used"] = MODEL
    report["architecture"] = "LangGraph Multi-Agent (6 agents: Triage, Context, Matcher, Safety, Guardrail, Synthesizer)"

    return report
