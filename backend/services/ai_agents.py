import json
import os
from groq import Groq
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from datetime import date

from models.diagnosis import Diagnosis
from models.patient import Patient
from models.vitals import Vital

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL = "llama-3.3-70b-versatile"


def _call_llm(system_prompt, user_prompt, temperature=0.2, max_tokens=800):
    resp = client.chat.completions.create(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        model=MODEL,
        temperature=temperature,
        max_tokens=max_tokens
    )
    return resp.choices[0].message.content.strip()


def _parse_json(raw):
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text)


def _patient_age(patient):
    if patient.date_of_birth:
        today = date.today()
        return today.year - patient.date_of_birth.year
    return "Unknown"


# ── AGENT 1: Symptom Analyzer ─────────────────────────────────────

def symptom_agent(symptoms: str) -> dict:
    system = """You are a medical symptom analysis AI. Extract and structure symptoms.
Respond ONLY with valid JSON, no markdown or explanation."""

    prompt = f"""Analyze these symptoms: "{symptoms}"

Return JSON:
{{
  "primary_symptoms": ["list of main symptoms"],
  "severity": "mild | moderate | severe",
  "body_systems": ["affected body systems e.g. respiratory, cardiac, hepatic"],
  "duration_noted": "any duration mentioned or 'not specified'",
  "red_flags": ["any emergency/urgent indicators or empty list"]
}}"""

    return _parse_json(_call_llm(system, prompt))


# ── AGENT 2: History Agent ─────────────────────────────────────────

def history_agent(patient: Patient, db: Session) -> dict:
    age = _patient_age(patient)

    past_diagnoses = db.query(Diagnosis).filter(
        Diagnosis.patient_id == patient.id
    ).order_by(Diagnosis.diagnosed_at.desc()).limit(10).all()

    latest_vitals = db.query(Vital).filter(
        Vital.patient_id == patient.id
    ).order_by(Vital.recorded_at.desc()).first()

    history = []
    current_medications = []
    chronic_conditions = []

    for d in past_diagnoses:
        entry = {
            "date": d.diagnosed_at.strftime("%Y-%m-%d") if d.diagnosed_at else "unknown",
            "diagnosis": d.diagnosis_text,
            "symptoms": d.symptoms,
            "icd_code": d.icd_code,
            "prescription": d.prescription,
            "follow_up": d.follow_up
        }
        history.append(entry)
        if d.prescription:
            current_medications.append(d.prescription)

    vitals_data = None
    if latest_vitals:
        vitals_data = {
            "temperature": latest_vitals.temperature,
            "heart_rate": latest_vitals.heart_rate,
            "bp_systolic": latest_vitals.blood_pressure_systolic,
            "bp_diastolic": latest_vitals.blood_pressure_diastolic,
            "respiratory_rate": latest_vitals.respiratory_rate,
            "spo2": latest_vitals.oxygen_saturation,
            "weight_kg": latest_vitals.weight_kg,
            "height_cm": latest_vitals.height_cm
        }

    return {
        "patient_name": patient.full_name,
        "age": age,
        "gender": patient.gender or "not specified",
        "blood_group": patient.blood_group or "not specified",
        "past_diagnoses": history,
        "current_medications": current_medications,
        "latest_vitals": vitals_data,
        "total_visits": len(history)
    }


# ── AGENT 3: Differential Diagnosis Agent ──────────────────────────

def diagnosis_agent(symptom_profile: dict, patient_history: dict) -> dict:
    system = """You are a clinical differential diagnosis AI. Analyze symptoms against patient history.
Respond ONLY with valid JSON, no markdown or explanation."""

    prompt = f"""SYMPTOM PROFILE:
{json.dumps(symptom_profile, indent=2)}

PATIENT HISTORY:
- Age: {patient_history['age']}, Gender: {patient_history['gender']}, Blood: {patient_history['blood_group']}
- Past diagnoses: {json.dumps(patient_history['past_diagnoses'][:5], indent=2)}
- Current medications: {json.dumps(patient_history['current_medications'][:5])}
- Latest vitals: {json.dumps(patient_history['latest_vitals'])}

Generate differential diagnoses. Return JSON:
{{
  "differentials": [
    {{
      "diagnosis": "condition name",
      "icd_code": "ICD-10 code",
      "confidence": 85,
      "reasoning": "why this diagnosis fits"
    }}
  ],
  "recommended_tests": ["lab tests to confirm"],
  "urgency": "routine | urgent | emergency"
}}

Provide exactly 3 differentials ranked by confidence (highest first)."""

    return _parse_json(_call_llm(system, prompt, max_tokens=1000))


# ── AGENT 4: Treatment Agent ──────────────────────────────────────

def treatment_agent(diagnosis_result: dict, patient_history: dict) -> dict:
    system = """You are a clinical pharmacology AI. Generate safe treatment plans.
Check drug interactions and contraindications against patient history.
Respond ONLY with valid JSON, no markdown or explanation."""

    top_diagnosis = diagnosis_result["differentials"][0]

    prompt = f"""TOP DIAGNOSIS: {top_diagnosis['diagnosis']} (ICD: {top_diagnosis['icd_code']})

PATIENT:
- Age: {patient_history['age']}, Gender: {patient_history['gender']}
- Blood Group: {patient_history['blood_group']}
- Current medications: {json.dumps(patient_history['current_medications'][:5])}
- Past conditions: {json.dumps([d['diagnosis'] for d in patient_history['past_diagnoses'][:5]])}
- Latest vitals: {json.dumps(patient_history['latest_vitals'])}

Generate a safe treatment plan. CHECK for:
1. Drug-drug interactions with current medications
2. Contraindications based on past conditions
3. Dosage adjustments for age/organ function

Return JSON:
{{
  "prescription": "medication name, dosage, frequency, duration",
  "contraindications_checked": ["list of conditions checked against"],
  "warnings": ["critical warnings - drug interactions, allergies, organ risks"],
  "safe_alternatives": "if primary choice has risks, suggest safer option",
  "follow_up": "follow-up plan with timeline",
  "lifestyle": "diet/activity recommendations"
}}"""

    return _parse_json(_call_llm(system, prompt, max_tokens=1000))


# ── AGENT 5: Summary Agent (Orchestrator) ──────────────────────────

def summary_agent(
    symptom_profile: dict,
    patient_history: dict,
    diagnosis_result: dict,
    treatment_result: dict
) -> dict:
    system = """You are a medical report AI. Compile agent outputs into a final clinical summary.
Respond ONLY with valid JSON, no markdown or explanation."""

    prompt = f"""Compile this multi-agent analysis into a final report.

SYMPTOMS: {json.dumps(symptom_profile)}
DIFFERENTIALS: {json.dumps(diagnosis_result)}
TREATMENT: {json.dumps(treatment_result)}
PATIENT: {patient_history['patient_name']}, Age {patient_history['age']}, {patient_history['gender']}

Return JSON:
{{
  "diagnosis_text": "clear 1-2 sentence final diagnosis",
  "icd_code": "ICD-10 code of top diagnosis",
  "prescription": "final safe prescription with dosage",
  "follow_up": "follow-up plan",
  "differentials": [
    {{"diagnosis": "name", "icd_code": "code", "confidence": 85, "reasoning": "why"}}
  ],
  "warnings": ["critical safety warnings"],
  "recommended_tests": ["confirmatory tests"],
  "urgency": "routine | urgent | emergency",
  "lifestyle_advice": "lifestyle recommendations",
  "clinical_notes": "brief note for the doctor summarizing the AI reasoning"
}}"""

    return _parse_json(_call_llm(system, prompt, max_tokens=1200))


# ── PIPELINE ORCHESTRATOR ──────────────────────────────────────────

def run_diagnosis_pipeline(patient: Patient, symptoms: str, db: Session) -> dict:
    steps = []

    # Agent 1
    symptom_profile = symptom_agent(symptoms)
    steps.append({"agent": "Symptom Analyzer", "status": "done"})

    # Agent 2
    patient_history = history_agent(patient, db)
    steps.append({"agent": "History Agent", "status": "done"})

    # Agent 3
    diagnosis_result = diagnosis_agent(symptom_profile, patient_history)
    steps.append({"agent": "Differential Diagnosis", "status": "done"})

    # Agent 4
    treatment_result = treatment_agent(diagnosis_result, patient_history)
    steps.append({"agent": "Treatment Planner", "status": "done"})

    # Agent 5
    final_report = summary_agent(symptom_profile, patient_history, diagnosis_result, treatment_result)
    steps.append({"agent": "Summary Report", "status": "done"})

    final_report["agent_steps"] = steps
    final_report["model_used"] = MODEL

    return final_report
