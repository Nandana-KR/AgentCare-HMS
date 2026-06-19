from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models.diagnosis import Diagnosis
from models.patient import Patient
from models.user import User
from models.appointment import Appointment
from schemas.diagnosis_schema import (
    DiagnosisCreate,
    DiagnosisUpdate,
    DiagnosisResponse
)
from dependencies import get_current_user, require_role
from services.langgraph_diagnosis import run_diagnosis_agent
from pydantic import BaseModel

router = APIRouter(
    prefix="/api/v1/diagnoses",
    tags=["diagnoses"]
)


class AIDiagnoseRequest(BaseModel):
    patient_id: str
    symptoms: str


@router.post("/ai-diagnose")
def ai_diagnose(
    data: AIDiagnoseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("doctor"))
):
    patient = db.query(Patient).filter(Patient.id == data.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    try:
        report = run_diagnosis_agent(patient, data.symptoms, db)
        return report
    except Exception as e:
        msg = str(e)
        if "rate_limit" in msg.lower() or "429" in msg:
            raise HTTPException(status_code=429, detail="AI model rate limit reached (free tier). Please try again in a few minutes.")
        raise HTTPException(status_code=500, detail=f"AI agent error: {msg}")


# Create a new diagnosis
# Only doctors can enter diagnoses
@router.post(
    "/",
    response_model=DiagnosisResponse,
    status_code=status.HTTP_201_CREATED
)
def create_diagnosis(
    diagnosis_data: DiagnosisCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("doctor"))
):
    # Verify patient exists
    patient = db.query(Patient).filter(
        Patient.id == diagnosis_data.patient_id
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Verify appointment exists, belongs to this patient, and is not cancelled
    appointment = db.query(Appointment).filter(
        Appointment.id == diagnosis_data.appointment_id,
        Appointment.patient_id == diagnosis_data.patient_id,
        Appointment.status != "cancelled"
    ).first()
    if not appointment:
        raise HTTPException(
            status_code=400,
            detail="No valid appointment found for this patient. A non-cancelled appointment is required to record a diagnosis."
        )

    new_diagnosis = Diagnosis(
        patient_id=diagnosis_data.patient_id,
        doctor_id=current_user.id,
        appointment_id=diagnosis_data.appointment_id,
        symptoms=diagnosis_data.symptoms,
        diagnosis_text=diagnosis_data.diagnosis_text,
        icd_code=diagnosis_data.icd_code,
        prescription=diagnosis_data.prescription,
        follow_up=diagnosis_data.follow_up,
        diagnosed_at=appointment.scheduled_at
    )

    db.add(new_diagnosis)

    db.commit()
    db.refresh(new_diagnosis)
    return new_diagnosis


# Get all diagnoses for a specific patient
@router.get(
    "/patient/{patient_id}",
    response_model=List[DiagnosisResponse]
)
def get_patient_diagnoses(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    diagnoses = db.query(Diagnosis).filter(
        Diagnosis.patient_id == patient_id
    ).all()
    return diagnoses


# Get a single diagnosis by ID
@router.get(
    "/{diagnosis_id}",
    response_model=DiagnosisResponse
)
def get_diagnosis(
    diagnosis_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    diagnosis = db.query(Diagnosis).filter(
        Diagnosis.id == diagnosis_id
    ).first()

    if not diagnosis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diagnosis not found"
        )

    return diagnosis


# Update a diagnosis
# Only the doctor who created it should update it
@router.patch(
    "/{diagnosis_id}",
    response_model=DiagnosisResponse
)
def update_diagnosis(
    diagnosis_id: str,
    update_data: DiagnosisUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("doctor"))
):
    diagnosis = db.query(Diagnosis).filter(
        Diagnosis.id == diagnosis_id
    ).first()

    if not diagnosis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diagnosis not found"
        )

    # Make sure only the doctor who created it can update it
    if diagnosis.doctor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own diagnoses"
        )

    update_fields = update_data.model_dump(exclude_unset=True)

    for field, value in update_fields.items():
        setattr(diagnosis, field, value)

    if "diagnosis_text" in update_fields and update_fields["diagnosis_text"] != "Pending AI analysis":
        if diagnosis.appointment_id:
            appointment = db.query(Appointment).filter(
                Appointment.id == diagnosis.appointment_id
            ).first()
            if appointment and appointment.status != "completed":
                appointment.status = "completed"

    db.commit()
    db.refresh(diagnosis)
    return diagnosis