from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models.prognosis import Prognosis
from models.diagnosis import Diagnosis
from models.patient import Patient
from models.user import User
from schemas.prognosis_schema import (
    PrognosisGenerate,
    PrognosisSave,
    PrognosisResponse
)
from dependencies import get_current_user, require_role
from services.ai_service import generate_prognosis

router = APIRouter(
    prefix="/api/v1/prognosis",
    tags=["prognosis"]
)


# Generate AI prognosis
# Only doctors can generate prognosis
@router.post(
    "/generate",
    response_model=PrognosisResponse,
    status_code=status.HTTP_201_CREATED
)
def generate_prognosis_endpoint(
    data: PrognosisGenerate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("doctor"))
):
    # Step 1 — find the diagnosis
    diagnosis = db.query(Diagnosis).filter(
        Diagnosis.id == data.diagnosis_id
    ).first()

    if not diagnosis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diagnosis not found"
        )

    # Step 2 — find the patient
    patient = db.query(Patient).filter(
        Patient.id == diagnosis.patient_id
    ).first()

    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )

    # Step 3 — generate AI prognosis
    # This calls Groq API with full patient context
    try:
        ai_suggestion = generate_prognosis(
            patient=patient,
            current_diagnosis=diagnosis,
            db=db
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI service error: {str(e)}"
        )

    # Step 4 — save to database
    new_prognosis = Prognosis(
        diagnosis_id=diagnosis.id,
        patient_id=patient.id,
        doctor_id=current_user.id,
        ai_suggestion=ai_suggestion,
        final_prognosis=ai_suggestion,
        model_used="llama3-8b-8192"
    )

    db.add(new_prognosis)
    db.commit()
    db.refresh(new_prognosis)
    return new_prognosis


# Doctor saves edited prognosis
@router.patch(
    "/{prognosis_id}/save",
    response_model=PrognosisResponse
)
def save_final_prognosis(
    prognosis_id: str,
    data: PrognosisSave,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("doctor"))
):
    prognosis = db.query(Prognosis).filter(
        Prognosis.id == prognosis_id
    ).first()

    if not prognosis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prognosis not found"
        )

    # Only the doctor who generated it can save it
    if prognosis.doctor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own prognosis"
        )

    prognosis.final_prognosis = data.final_prognosis
    db.commit()
    db.refresh(prognosis)
    return prognosis


# Get all prognoses for a patient
@router.get(
    "/patient/{patient_id}",
    response_model=List[PrognosisResponse]
)
def get_patient_prognoses(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    prognoses = db.query(Prognosis).filter(
        Prognosis.patient_id == patient_id
    ).all()
    return prognoses


# Get prognosis by diagnosis ID
@router.get(
    "/diagnosis/{diagnosis_id}",
    response_model=List[PrognosisResponse]
)
def get_diagnosis_prognosis(
    diagnosis_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    prognoses = db.query(Prognosis).filter(
        Prognosis.diagnosis_id == diagnosis_id
    ).all()
    return prognoses