"""
Seed demo data so recruiters see a populated app on first login.
Idempotent — skips if data already exists.
"""
import uuid
from datetime import datetime, timedelta, timezone, date

import bcrypt

from database import SessionLocal
from models.user import User
from models.patient import Patient
from models.appointment import Appointment
from models.diagnosis import Diagnosis
from models.vitals import Vitals


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


DEMO_USERS = [
    {"email": "admin@hms.com", "password": "Admin@123", "full_name": "System Admin", "role": "admin"},
    {"email": "doctor@hms.com", "password": "Doctor@123", "full_name": "Dr. Smith", "role": "doctor"},
    {"email": "reception@hms.com", "password": "Reception@123", "full_name": "Jane Receptionist", "role": "receptionist"},
    {"email": "nurse@hms.com", "password": "Nurse@123", "full_name": "Mary Nurse", "role": "nurse"},
]


def seed_users(db):
    """Create demo users if they don't exist."""
    for u in DEMO_USERS:
        existing = db.query(User).filter(User.email == u["email"]).first()
        if not existing:
            user = User(
                id=uuid.uuid4(),
                email=u["email"],
                hashed_password=hash_password(u["password"]),
                full_name=u["full_name"],
                role=u["role"],
                is_active=True,
                created_at=datetime.now(timezone.utc)
            )
            db.add(user)
            print(f"  Seed: Created user {u['email']} ({u['role']})")
    db.commit()


def seed():
    db = SessionLocal()

    # Ensure demo users exist
    seed_users(db)

    # Check if demo data already exists
    existing_patients = db.query(Patient).count()
    if existing_patients > 0:
        print("Seed: Demo data already exists, skipping.")
        db.close()
        return

    # Get doctor user
    doctor = db.query(User).filter(User.email == "doctor@hms.com").first()
    nurse = db.query(User).filter(User.email == "nurse@hms.com").first()
    if not doctor:
        print("Seed: No doctor user found. Run user seeding first.")
        db.close()
        return

    now = datetime.now(timezone.utc)
    today_9am = now.replace(hour=9, minute=0, second=0, microsecond=0)

    # ── Demo Patients ──
    patients_data = [
        {
            "full_name": "Rajesh Kumar",
            "date_of_birth": date(1985, 3, 15),
            "gender": "male",
            "phone": "+91 98765 43210",
            "blood_group": "B+",
            "allergies": "Penicillin",
            "address": "42 MG Road, Bangalore"
        },
        {
            "full_name": "Priya Sharma",
            "date_of_birth": date(1992, 7, 22),
            "gender": "female",
            "phone": "+91 87654 32109",
            "blood_group": "O+",
            "allergies": None,
            "address": "15 Anna Nagar, Chennai"
        },
        {
            "full_name": "Mohammed Farooq",
            "date_of_birth": date(1978, 11, 8),
            "gender": "male",
            "phone": "+91 76543 21098",
            "blood_group": "A-",
            "allergies": "Sulfa drugs, Aspirin",
            "address": "78 Jubilee Hills, Hyderabad"
        },
        {
            "full_name": "Ananya Patel",
            "date_of_birth": date(2001, 1, 30),
            "gender": "female",
            "phone": "+91 65432 10987",
            "blood_group": "AB+",
            "allergies": None,
            "address": "23 SG Highway, Ahmedabad"
        },
        {
            "full_name": "Suresh Reddy",
            "date_of_birth": date(1965, 5, 12),
            "gender": "male",
            "phone": "+91 54321 09876",
            "blood_group": "O-",
            "allergies": "Ibuprofen",
            "address": "56 Koramangala, Bangalore"
        },
    ]

    patients = []
    for pd in patients_data:
        p = Patient(id=uuid.uuid4(), created_at=now - timedelta(days=30), updated_at=now - timedelta(days=30), **pd)
        db.add(p)
        patients.append(p)

    db.flush()

    # ── Demo Appointments ──
    appointments_data = [
        # Today scheduled (will show on doctor's dashboard)
        {"patient": patients[0], "offset_hours": 1, "status": "scheduled", "notes": "Follow-up for fever"},
        {"patient": patients[1], "offset_hours": 2, "status": "scheduled", "notes": "Routine checkup"},
        {"patient": patients[3], "offset_hours": 3, "status": "scheduled", "notes": "Headache and dizziness"},
        # Today completed
        {"patient": patients[4], "offset_hours": -2, "status": "completed", "notes": "Chest pain evaluation"},
        # Past completed
        {"patient": patients[0], "offset_hours": -48, "status": "completed", "notes": "Initial consultation - fever"},
        {"patient": patients[2], "offset_hours": -72, "status": "completed", "notes": "Diabetes follow-up"},
        # Upcoming (future days)
        {"patient": patients[2], "offset_hours": 26, "status": "scheduled", "notes": "Lab results review"},
        {"patient": patients[4], "offset_hours": 50, "status": "scheduled", "notes": "Cardiology referral follow-up"},
    ]

    appointments = []
    for ad in appointments_data:
        apt = Appointment(
            id=uuid.uuid4(),
            patient_id=ad["patient"].id,
            doctor_id=doctor.id,
            scheduled_at=now + timedelta(hours=ad["offset_hours"]),
            status=ad["status"],
            notes=ad["notes"],
            created_at=now - timedelta(days=7)
        )
        db.add(apt)
        appointments.append(apt)

    db.flush()

    # ── Demo Vitals ──
    recorder_id = nurse.id if nurse else doctor.id
    vitals_data = [
        {"patient": patients[0], "temperature": 38.2, "heart_rate": 88, "bp_s": 130, "bp_d": 85, "rr": 18, "spo2": 97.0, "weight": 72.5, "height": 175.0, "hours_ago": 2},
        {"patient": patients[0], "temperature": 37.8, "heart_rate": 82, "bp_s": 125, "bp_d": 82, "rr": 16, "spo2": 98.0, "weight": 72.5, "height": 175.0, "hours_ago": 50},
        {"patient": patients[1], "temperature": 36.8, "heart_rate": 72, "bp_s": 118, "bp_d": 76, "rr": 15, "spo2": 99.0, "weight": 58.0, "height": 162.0, "hours_ago": 1},
        {"patient": patients[2], "temperature": 37.0, "heart_rate": 78, "bp_s": 145, "bp_d": 92, "rr": 17, "spo2": 96.5, "weight": 85.0, "height": 170.0, "hours_ago": 74},
        {"patient": patients[4], "temperature": 36.9, "heart_rate": 95, "bp_s": 155, "bp_d": 98, "rr": 20, "spo2": 95.0, "weight": 90.0, "height": 168.0, "hours_ago": 3},
    ]

    for vd in vitals_data:
        v = Vitals(
            id=uuid.uuid4(),
            patient_id=vd["patient"].id,
            recorded_by=recorder_id,
            temperature=vd["temperature"],
            heart_rate=vd["heart_rate"],
            blood_pressure_systolic=vd["bp_s"],
            blood_pressure_diastolic=vd["bp_d"],
            respiratory_rate=vd["rr"],
            oxygen_saturation=vd["spo2"],
            weight_kg=vd["weight"],
            height_cm=vd["height"],
            recorded_at=now - timedelta(hours=vd["hours_ago"]),
            created_at=now - timedelta(hours=vd["hours_ago"])
        )
        db.add(v)

    db.flush()

    # ── Demo Diagnoses ──
    # Completed diagnosis (with AI report) for past appointment
    completed_apt = appointments[4]  # past completed for patients[0]
    diag1 = Diagnosis(
        id=uuid.uuid4(),
        patient_id=patients[0].id,
        doctor_id=doctor.id,
        appointment_id=completed_apt.id,
        symptoms="High fever (38.5°C) for 3 days, body aches, sore throat, mild cough",
        diagnosis_text="Acute Upper Respiratory Tract Infection (URI) with secondary bacterial involvement",
        icd_code="J06.9",
        prescription="Amoxicillin 500mg TID x 7 days, Paracetamol 500mg QID PRN for fever, warm saline gargles",
        follow_up="Review in 5 days. If fever persists beyond 48 hours on antibiotics, consider blood culture.",
        ai_report=None,
        diagnosed_at=completed_apt.scheduled_at,
        created_at=completed_apt.scheduled_at
    )
    db.add(diag1)

    # Completed diagnosis for patients[2]
    completed_apt2 = appointments[5]  # past completed for patients[2]
    diag2 = Diagnosis(
        id=uuid.uuid4(),
        patient_id=patients[2].id,
        doctor_id=doctor.id,
        appointment_id=completed_apt2.id,
        symptoms="Increased thirst, frequent urination, fatigue, blurred vision, HbA1c 8.2%",
        diagnosis_text="Type 2 Diabetes Mellitus — poorly controlled. Patient on Metformin 500mg BD, needs dose adjustment.",
        icd_code="E11.9",
        prescription="Metformin 1000mg BD (increase from 500mg), Glimepiride 1mg OD before breakfast. Continue diet control.",
        follow_up="HbA1c recheck in 3 months. Fasting glucose weekly self-monitoring. Ophthalmology referral for retinal screening.",
        ai_report=None,
        diagnosed_at=completed_apt2.scheduled_at,
        created_at=completed_apt2.scheduled_at
    )
    db.add(diag2)

    # Completed diagnosis for patients[4] (today's completed)
    completed_apt3 = appointments[3]  # today completed for patients[4]
    diag3 = Diagnosis(
        id=uuid.uuid4(),
        patient_id=patients[4].id,
        doctor_id=doctor.id,
        appointment_id=completed_apt3.id,
        symptoms="Chest tightness on exertion, shortness of breath climbing stairs, occasional palpitations for 2 weeks",
        diagnosis_text="Stable Angina Pectoris — likely coronary artery disease given age (59), hypertension, and symptoms on exertion.",
        icd_code="I20.9",
        prescription="Aspirin 75mg OD, Atorvastatin 20mg HS, Metoprolol 25mg BD, GTN sublingual PRN for chest pain",
        follow_up="Urgent cardiology referral. ECG and stress test within 1 week. Lifestyle: stop smoking, low-salt diet.",
        ai_report=None,
        diagnosed_at=completed_apt3.scheduled_at,
        created_at=completed_apt3.scheduled_at
    )
    db.add(diag3)

    # Pending diagnosis (for today's scheduled patient — recruiter can try AI on this)
    pending_apt = appointments[0]  # today scheduled for patients[0]
    diag_pending = Diagnosis(
        id=uuid.uuid4(),
        patient_id=patients[0].id,
        doctor_id=doctor.id,
        appointment_id=pending_apt.id,
        symptoms="Recurring fever (37.8-38.2°C), persistent cough with yellow sputum, fatigue for 5 days",
        diagnosis_text="Pending AI analysis",
        icd_code=None,
        prescription=None,
        follow_up=None,
        ai_report=None,
        diagnosed_at=pending_apt.scheduled_at,
        created_at=now
    )
    db.add(diag_pending)

    db.commit()
    db.close()
    print("Seed: Demo data created successfully (5 patients, 8 appointments, 5 vitals, 4 diagnoses)")


if __name__ == "__main__":
    seed()
