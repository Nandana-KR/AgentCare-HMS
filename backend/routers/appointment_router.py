from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models.appointment import Appointment
from models.patient import Patient
from models.user import User
from schemas.appointment_schema import (
    AppointmentCreate,
    AppointmentUpdate,
    AppointmentResponse
)
from dependencies import get_current_user, require_role

router = APIRouter(
    prefix="/api/v1/appointments",
    tags=["appointments"]
)


# Book a new appointment
# Only receptionists can book appointments
@router.post(
    "/",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED
)
def book_appointment(
    appointment_data: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("receptionist"))
):
    # Verify patient exists
    patient = db.query(Patient).filter(
        Patient.id == appointment_data.patient_id
    ).first()

    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )

    # Verify doctor exists and is actually a doctor
    doctor = db.query(User).filter(
        User.id == appointment_data.doctor_id,
        User.role == "doctor"
    ).first()

    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor not found"
        )

    new_appointment = Appointment(
        **appointment_data.model_dump()
    )

    db.add(new_appointment)
    db.commit()
    db.refresh(new_appointment)
    return new_appointment


# Get all appointments
# Doctors and receptionists can view
@router.get(
    "/",
    response_model=List[AppointmentResponse]
)
def get_all_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    appointments = db.query(Appointment).all()
    return appointments


# Get all appointments for a specific patient
@router.get(
    "/patient/{patient_id}",
    response_model=List[AppointmentResponse]
)
def get_patient_appointments(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    appointments = db.query(Appointment).filter(
        Appointment.patient_id == patient_id
    ).all()
    return appointments


# Update appointment status or reschedule
@router.patch(
    "/{appointment_id}",
    response_model=AppointmentResponse
)
def update_appointment(
    appointment_id: str,
    update_data: AppointmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    appointment = db.query(Appointment).filter(
        Appointment.id == appointment_id
    ).first()

    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found"
        )

    update_fields = update_data.model_dump(exclude_unset=True)

    for field, value in update_fields.items():
        setattr(appointment, field, value)

    db.commit()
    db.refresh(appointment)
    return appointment


# Cancel an appointment
@router.delete(
    "/{appointment_id}",
    status_code=status.HTTP_200_OK
)
def cancel_appointment(
    appointment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("receptionist"))
):
    appointment = db.query(Appointment).filter(
        Appointment.id == appointment_id
    ).first()

    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found"
        )

    appointment.status = "cancelled"
    db.commit()

    return {"message": "Appointment cancelled successfully"}