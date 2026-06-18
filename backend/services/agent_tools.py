"""
Tools that the Diagnosis Agent can call.
Each tool queries the database or computes something.
The agent DECIDES which tools to use based on its reasoning.
"""
from sqlalchemy.orm import Session
from datetime import date, datetime

from models.patient import Patient
from models.diagnosis import Diagnosis
from models.vitals import Vital


def get_patient_profile(patient: Patient) -> dict:
    age = "Unknown"
    if patient.date_of_birth:
        today = date.today()
        age = today.year - patient.date_of_birth.year
    return {
        "name": patient.full_name,
        "age": age,
        "gender": patient.gender or "not specified",
        "blood_group": patient.blood_group or "not specified",
        "phone": patient.phone or "not specified"
    }


def get_medical_history(patient_id, db: Session) -> list:
    diagnoses = db.query(Diagnosis).filter(
        Diagnosis.patient_id == patient_id
    ).order_by(Diagnosis.diagnosed_at.desc()).limit(10).all()

    return [{
        "date": d.diagnosed_at.strftime("%Y-%m-%d") if d.diagnosed_at else "unknown",
        "diagnosis": d.diagnosis_text,
        "symptoms": d.symptoms,
        "icd_code": d.icd_code,
        "prescription": d.prescription,
        "follow_up": d.follow_up
    } for d in diagnoses]


def get_current_medications(patient_id, db: Session) -> list:
    recent = db.query(Diagnosis).filter(
        Diagnosis.patient_id == patient_id,
        Diagnosis.prescription.isnot(None)
    ).order_by(Diagnosis.diagnosed_at.desc()).limit(5).all()

    meds = []
    conditions = []
    for d in recent:
        if d.prescription:
            meds.append({
                "medication": d.prescription,
                "for_condition": d.diagnosis_text,
                "prescribed_date": d.diagnosed_at.strftime("%Y-%m-%d") if d.diagnosed_at else "unknown"
            })
        conditions.append(d.diagnosis_text)
    return {"active_medications": meds, "known_conditions": conditions}


def get_latest_vitals(patient_id, db: Session) -> dict:
    v = db.query(Vital).filter(
        Vital.patient_id == patient_id
    ).order_by(Vital.recorded_at.desc()).first()

    if not v:
        return {"status": "no vitals recorded"}

    result = {"recorded_at": v.recorded_at.strftime("%Y-%m-%d %H:%M") if v.recorded_at else "unknown"}
    anomalies = []

    if v.temperature is not None:
        result["temperature_c"] = v.temperature
        if v.temperature > 38.0:
            anomalies.append(f"FEVER: {v.temperature}°C (normal: 36.1-37.2)")
        elif v.temperature < 35.5:
            anomalies.append(f"HYPOTHERMIA: {v.temperature}°C")

    if v.heart_rate is not None:
        result["heart_rate_bpm"] = v.heart_rate
        if v.heart_rate > 100:
            anomalies.append(f"TACHYCARDIA: {v.heart_rate} bpm (normal: 60-100)")
        elif v.heart_rate < 60:
            anomalies.append(f"BRADYCARDIA: {v.heart_rate} bpm")

    if v.blood_pressure_systolic is not None:
        result["bp"] = f"{v.blood_pressure_systolic}/{v.blood_pressure_diastolic or '?'} mmHg"
        if v.blood_pressure_systolic > 140:
            anomalies.append(f"HYPERTENSION: {v.blood_pressure_systolic}/{v.blood_pressure_diastolic} mmHg")
        elif v.blood_pressure_systolic < 90:
            anomalies.append(f"HYPOTENSION: {v.blood_pressure_systolic}/{v.blood_pressure_diastolic} mmHg")

    if v.oxygen_saturation is not None:
        result["spo2_percent"] = v.oxygen_saturation
        if v.oxygen_saturation < 95:
            anomalies.append(f"LOW SpO2: {v.oxygen_saturation}% (normal: 95-100)")

    if v.respiratory_rate is not None:
        result["respiratory_rate"] = v.respiratory_rate
        if v.respiratory_rate > 20:
            anomalies.append(f"TACHYPNEA: {v.respiratory_rate}/min (normal: 12-20)")

    if v.weight_kg and v.height_cm:
        bmi = round(v.weight_kg / ((v.height_cm / 100) ** 2), 1)
        result["bmi"] = bmi
        if bmi > 30:
            anomalies.append(f"OBESE: BMI {bmi}")
        elif bmi > 25:
            anomalies.append(f"OVERWEIGHT: BMI {bmi}")
        elif bmi < 18.5:
            anomalies.append(f"UNDERWEIGHT: BMI {bmi}")

    result["anomalies"] = anomalies
    return result


def get_vitals_trend(patient_id, db: Session) -> list:
    vitals = db.query(Vital).filter(
        Vital.patient_id == patient_id
    ).order_by(Vital.recorded_at.desc()).limit(5).all()

    if not vitals:
        return []

    return [{
        "date": v.recorded_at.strftime("%Y-%m-%d") if v.recorded_at else "?",
        "temp": v.temperature,
        "hr": v.heart_rate,
        "bp": f"{v.blood_pressure_systolic or '?'}/{v.blood_pressure_diastolic or '?'}",
        "spo2": v.oxygen_saturation
    } for v in vitals]


def find_similar_past_cases(patient_id, symptoms: str, db: Session) -> list:
    all_diag = db.query(Diagnosis).filter(
        Diagnosis.patient_id == patient_id
    ).order_by(Diagnosis.diagnosed_at.desc()).all()

    keywords = set(symptoms.lower().split())
    similar = []
    for d in all_diag:
        past_keywords = set(d.symptoms.lower().split())
        overlap = keywords & past_keywords
        if len(overlap) >= 2:
            similar.append({
                "date": d.diagnosed_at.strftime("%Y-%m-%d") if d.diagnosed_at else "?",
                "symptoms_then": d.symptoms,
                "diagnosis_then": d.diagnosis_text,
                "treatment_then": d.prescription,
                "matching_keywords": list(overlap)
            })
    return similar[:3]


def detect_emergency(symptoms: str) -> dict:
    symptoms_lower = symptoms.lower()
    red_flags = []

    emergency_patterns = [
        (["chest pain", "chest tightness", "crushing chest"], "Possible cardiac event"),
        (["difficulty breathing", "cannot breathe", "breathless", "severe dyspnea"], "Respiratory emergency"),
        (["sudden severe headache", "worst headache", "thunderclap headache"], "Possible stroke/aneurysm"),
        (["loss of consciousness", "unconscious", "unresponsive", "fainted"], "Syncope - urgent evaluation"),
        (["seizure", "convulsion", "fitting"], "Seizure activity"),
        (["severe bleeding", "hemorrhage", "blood loss"], "Hemorrhage"),
        (["suicidal", "self harm", "wanting to die"], "Psychiatric emergency"),
        (["sudden weakness one side", "facial droop", "slurred speech"], "Possible stroke - CODE STROKE"),
        (["anaphylaxis", "throat swelling", "severe allergic"], "Anaphylaxis"),
        (["severe abdominal pain", "rigid abdomen"], "Possible surgical abdomen")
    ]

    for patterns, warning in emergency_patterns:
        for p in patterns:
            if p in symptoms_lower:
                red_flags.append(warning)
                break

    return {
        "is_emergency": len(red_flags) > 0,
        "red_flags": red_flags,
        "triage_level": "EMERGENCY" if red_flags else "ROUTINE"
    }


TOOL_REGISTRY = {
    "get_patient_profile": {
        "description": "Get patient demographics: age, gender, blood group",
        "params": "none"
    },
    "get_medical_history": {
        "description": "Get last 10 diagnoses with symptoms, treatment, ICD codes",
        "params": "none"
    },
    "get_current_medications": {
        "description": "Get active medications and known conditions",
        "params": "none"
    },
    "get_latest_vitals": {
        "description": "Get latest vitals with anomaly detection (fever, hypertension, etc.)",
        "params": "none"
    },
    "get_vitals_trend": {
        "description": "Get last 5 vitals readings to spot trends",
        "params": "none"
    },
    "find_similar_past_cases": {
        "description": "Find past visits with similar symptoms for this patient",
        "params": "requires current symptoms"
    },
    "detect_emergency": {
        "description": "Check for emergency red flags in symptoms",
        "params": "requires current symptoms"
    }
}


def execute_tool(tool_name: str, patient: Patient, symptoms: str, db: Session):
    if tool_name == "get_patient_profile":
        return get_patient_profile(patient)
    elif tool_name == "get_medical_history":
        return get_medical_history(patient.id, db)
    elif tool_name == "get_current_medications":
        return get_current_medications(patient.id, db)
    elif tool_name == "get_latest_vitals":
        return get_latest_vitals(patient.id, db)
    elif tool_name == "get_vitals_trend":
        return get_vitals_trend(patient.id, db)
    elif tool_name == "find_similar_past_cases":
        return find_similar_past_cases(patient.id, symptoms, db)
    elif tool_name == "detect_emergency":
        return detect_emergency(symptoms)
    else:
        return {"error": f"Unknown tool: {tool_name}"}
