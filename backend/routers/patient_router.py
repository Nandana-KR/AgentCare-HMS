from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models.patient import Patient
from schemas.patient_schema import PatientCreate, PatientUpdate, PatientResponse
from dependencies import get_current_user, require_role
from models.user import User
from typing import List

router = APIRouter(
    prefix="/api/v1/patients",
    tags=["patients"]
)


# Register a new patient
# Only receptionists and admins can register patients
@router.post(
    "/",
    response_model=PatientResponse,
    status_code=status.HTTP_201_CREATED
)
def register_patient(
    patient_data: PatientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("receptionist"))
):
    new_patient = Patient(**patient_data.model_dump())
    db.add(new_patient)
    db.commit()
    db.refresh(new_patient)
    return new_patient


# Get all patients
# Only doctors and admins can view patient list
@router.get(
    "/",
    response_model=List[PatientResponse]
)
def get_all_patients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    patients = db.query(Patient).all()
    return patients


# Get one patient by ID
@router.get(
    "/{patient_id}",
    response_model=PatientResponse
)
def get_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    patient = db.query(Patient).filter(
        Patient.id == patient_id
    ).first()

    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )

    return patient


# Update patient details
@router.patch(
    "/{patient_id}",
    response_model=PatientResponse
)
def update_patient(
    patient_id: str,
    update_data: PatientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("receptionist"))
):
    patient = db.query(Patient).filter(
        Patient.id == patient_id
    ).first()

    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )

    update_fields = update_data.model_dump(exclude_unset=True)

    for field, value in update_fields.items():
        setattr(patient, field, value)

    db.commit()
    db.refresh(patient)
    return patient