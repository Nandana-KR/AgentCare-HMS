from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from database import get_db
from models.patient import Patient
from schemas.patient_schema import PatientCreate, PatientUpdate, PatientResponse
from dependencies import get_current_user, require_role
from models.user import User

router = APIRouter(
    prefix="/api/v1/patients",
    tags=["patients"]
)


# Count route MUST be before /{patient_id}
# Otherwise FastAPI treats "count" as a patient ID
@router.get("/count")
def get_patient_count(
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Patient)
    if search:
        query = query.filter(Patient.full_name.ilike(f"%{search}%"))
    return {"total": query.count()}


# Get all patients with pagination and sorting
@router.get(
    "/",
    response_model=List[PatientResponse]
)
def get_all_patients(
    skip: int = 0,
    limit: int = 10,
    sort_by: str = "full_name",
    order: str = "asc",
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Patient)

    if search:
        query = query.filter(Patient.full_name.ilike(f"%{search}%"))

    if sort_by == "full_name":
        if order == "asc":
            query = query.order_by(Patient.full_name.asc())
        else:
            query = query.order_by(Patient.full_name.desc())
    elif sort_by == "created_at":
        if order == "asc":
            query = query.order_by(Patient.created_at.asc())
        else:
            query = query.order_by(Patient.created_at.desc())

    patients = query.offset(skip).limit(limit).all()
    return patients


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


# Get one patient by ID
# This must come AFTER /count and /
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