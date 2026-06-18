from groq import Groq
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import os

from models.diagnosis import Diagnosis
from models.patient import Patient

load_dotenv()

# Initialize Groq client with your API key
client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def gather_patient_context(
    patient: Patient,
    current_diagnosis: Diagnosis,
    db: Session
) -> str:
    # Get patient's last 5 diagnoses for context
    # This is the agentic part — AI gets full history
    past_diagnoses = db.query(Diagnosis).filter(
        Diagnosis.patient_id == patient.id,
        Diagnosis.id != current_diagnosis.id
    ).order_by(
        Diagnosis.diagnosed_at.desc()
    ).limit(5).all()

    # Calculate patient age from date of birth
    age = "Unknown"
    if patient.date_of_birth:
        from datetime import date
        today = date.today()
        age = today.year - patient.date_of_birth.year

    # Build the context string
    context = f"""
PATIENT INFORMATION:
Name: {patient.full_name}
Age: {age}
Gender: {patient.gender or 'Not specified'}
Blood Group: {patient.blood_group or 'Not specified'}

CURRENT DIAGNOSIS:
Symptoms: {current_diagnosis.symptoms}
Diagnosis: {current_diagnosis.diagnosis_text}
ICD Code: {current_diagnosis.icd_code or 'Not specified'}
Current Prescription: {current_diagnosis.prescription or 'None'}

MEDICAL HISTORY (Last 5 diagnoses):
"""

    if past_diagnoses:
        for i, diag in enumerate(past_diagnoses, 1):
            context += f"""
{i}. Date: {diag.diagnosed_at.strftime('%Y-%m-%d')}
   Symptoms: {diag.symptoms}
   Diagnosis: {diag.diagnosis_text}
   Treatment: {diag.prescription or 'None'}
"""
    else:
        context += "No previous diagnoses on record.\n"

    return context


def generate_prognosis(
    patient: Patient,
    current_diagnosis: Diagnosis,
    db: Session
) -> str:
    # Step 1 — gather all patient context automatically
    context = gather_patient_context(
        patient, current_diagnosis, db
    )

    # Step 2 — build the prompt for the AI
    prompt = f"""
You are an experienced medical AI assistant helping doctors
make informed prognosis decisions.

Based on the following patient information and medical history,
provide a detailed prognosis including:
1. Likely progression of the current condition
2. Potential complications to watch for
3. Recommended treatment adjustments if any
4. Follow-up timeline and tests recommended
5. Lifestyle recommendations for the patient

Always remind that this is an AI suggestion and the doctor
should use their clinical judgment.

{context}

Please provide a clear, structured prognosis:
"""

    # Step 3 — send to Groq AI and get response
    chat_completion = client.chat.completions.create(
        messages=[
            {
                "role": "system",
                "content": """You are a medical AI assistant.
                Provide helpful, structured prognosis suggestions
                based on patient data. Always be clear that
                suggestions should be reviewed by the doctor."""
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        model="llama-3.3-70b-versatile",
        temperature=0.3,
        max_tokens=1000
    )

    # Step 4 — extract and return the response
    return chat_completion.choices[0].message.content


def generate_diagnosis_suggestion(
    patient: Patient,
    symptoms: str,
    db: Session
) -> dict:
    past_diagnoses = db.query(Diagnosis).filter(
        Diagnosis.patient_id == patient.id
    ).order_by(Diagnosis.diagnosed_at.desc()).limit(5).all()

    age = "Unknown"
    if patient.date_of_birth:
        from datetime import date
        today = date.today()
        age = today.year - patient.date_of_birth.year

    history = ""
    if past_diagnoses:
        for i, d in enumerate(past_diagnoses, 1):
            history += f"{i}. {d.diagnosed_at.strftime('%Y-%m-%d')} — {d.diagnosis_text} (Rx: {d.prescription or 'None'})\n"
    else:
        history = "No previous diagnoses.\n"

    prompt = f"""You are a medical AI assistant helping doctors with clinical diagnosis.

PATIENT: {patient.full_name}, Age: {age}, Gender: {patient.gender or 'N/A'}, Blood Group: {patient.blood_group or 'N/A'}

PRESENTING SYMPTOMS: {symptoms}

MEDICAL HISTORY:
{history}

Based on the symptoms and history, provide a JSON response with exactly these fields:
{{
  "diagnosis_text": "most likely diagnosis in 1-2 sentences",
  "icd_code": "ICD-10 code (e.g. J06.9)",
  "prescription": "recommended medication and dosage",
  "follow_up": "follow-up plan and timeline"
}}

Respond ONLY with valid JSON, no explanation or markdown."""

    chat_completion = client.chat.completions.create(
        messages=[
            {
                "role": "system",
                "content": "You are a medical AI. Respond ONLY with valid JSON. No markdown, no explanation."
            },
            {"role": "user", "content": prompt}
        ],
        model="llama-3.3-70b-versatile",
        temperature=0.2,
        max_tokens=500
    )

    import json
    raw = chat_completion.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw)