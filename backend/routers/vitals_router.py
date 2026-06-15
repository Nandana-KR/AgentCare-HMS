from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models.vitals import Vitals
from models.patient import Patient
from models.user import User
from schemas.vitals_schema import VitalsCreate, VitalsResponse
from dependencies import get_current_user, require_role

router = APIRouter(
    prefix="/api/v1/vitals",
    tags=["vitals"]
)


# Record vitals for a patient
# Nurses and doctors can both record vitals
@router.post(
    "/",
    response_model=VitalsResponse,
    status_code=status.HTTP_201_CREATED
)
def record_vitals(
    vitals_data: VitalsCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["nurse", "doctor"]))
):
    patient = db.query(Patient).filter(
        Patient.id == vitals_data.patient_id
    ).first()

    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )

    new_vitals = Vitals(
        patient_id=vitals_data.patient_id,
        recorded_by=current_user.id,
        temperature=vitals_data.temperature,
        heart_rate=vitals_data.heart_rate,
        blood_pressure_systolic=vitals_data.blood_pressure_systolic,
        blood_pressure_diastolic=vitals_data.blood_pressure_diastolic,
        respiratory_rate=vitals_data.respiratory_rate,
        oxygen_saturation=vitals_data.oxygen_saturation,
        weight_kg=vitals_data.weight_kg,
        height_cm=vitals_data.height_cm
    )

    db.add(new_vitals)
    db.commit()
    db.refresh(new_vitals)
    return new_vitals


# Get all vitals recorded for a patient, most recent first
@router.get(
    "/patient/{patient_id}",
    response_model=List[VitalsResponse]
)
def get_patient_vitals(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Vitals).filter(
        Vitals.patient_id == patient_id
    ).order_by(Vitals.recorded_at.desc()).all()
