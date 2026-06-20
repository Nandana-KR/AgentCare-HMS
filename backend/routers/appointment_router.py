from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List
from datetime import timedelta

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

# Minimum gap between two appointments for the same doctor
APPOINTMENT_BUFFER_MINUTES = 30


def has_conflicting_appointment(db, doctor_id, scheduled_at, exclude_id=None):
    buffer = timedelta(minutes=APPOINTMENT_BUFFER_MINUTES)
    query = db.query(Appointment).filter(
        Appointment.doctor_id == doctor_id,
        Appointment.status == "scheduled",
        Appointment.scheduled_at > scheduled_at - buffer,
        Appointment.scheduled_at < scheduled_at + buffer
    )
    if exclude_id:
        query = query.filter(Appointment.id != exclude_id)
    return db.query(query.exists()).scalar()


def build_appointment_response(apt):
    return {
        "id": apt.id,
        "patient_id": apt.patient_id,
        "doctor_id": apt.doctor_id,
        "patient_name": apt.patient.full_name,
        "patient_phone": apt.patient.phone or "N/A",
        "doctor_name": apt.doctor.full_name,
        "scheduled_at": apt.scheduled_at,
        "status": apt.status,
        "notes": apt.notes,
        "created_at": apt.created_at
    }
router = APIRouter(
    prefix="/api/v1/appointments",
    tags=["appointments"]
)


# Book a new appointment
@router.post(
    "/",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED
)
def book_appointment(
    appointment_data: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "receptionist", "doctor", "nurse"]))
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

    existing = db.query(Appointment).filter(
        Appointment.patient_id == appointment_data.patient_id,
        Appointment.status == "scheduled"
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This patient already has a scheduled appointment. Complete or cancel it first."
        )

    if has_conflicting_appointment(
        db, appointment_data.doctor_id, appointment_data.scheduled_at
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Doctor already has an appointment within "
                f"{APPOINTMENT_BUFFER_MINUTES} minutes of this time"
            )
        )

    new_appointment = Appointment(
        **appointment_data.model_dump()
    )

    db.add(new_appointment)
    db.commit()
    db.refresh(new_appointment)
    return build_appointment_response(new_appointment)


@router.post("/cleanup")
def cleanup_duplicate_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    from sqlalchemy import func
    patients = db.query(Appointment.patient_id).group_by(Appointment.patient_id).having(func.count() > 1).all()
    deleted = 0
    for (pid,) in patients:
        apts = db.query(Appointment).filter(Appointment.patient_id == pid).order_by(Appointment.created_at.desc()).all()
        for apt in apts[1:]:
            db.delete(apt)
            deleted += 1
    db.commit()
    return {"message": f"Cleaned up {deleted} duplicate appointments"}


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
    query = db.query(Appointment).options(joinedload(Appointment.patient), joinedload(Appointment.doctor))
    if current_user.role == 'doctor':
        query = query.filter(Appointment.doctor_id == current_user.id)
    elif current_user.role == 'nurse':
        query = query.filter(Appointment.doctor_id == current_user.supervisor_id) if current_user.supervisor_id else query
    appointments = query.all()
    return [build_appointment_response(apt) for apt in appointments]


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
    return [build_appointment_response(apt) for apt in appointments]


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

    final_status = update_fields.get("status", appointment.status)
    final_time = update_fields.get("scheduled_at", appointment.scheduled_at)

    if final_status == "scheduled" and (
        "scheduled_at" in update_fields or "status" in update_fields
    ):
        if has_conflicting_appointment(
            db, appointment.doctor_id, final_time, exclude_id=appointment.id
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Doctor already has an appointment within "
                    f"{APPOINTMENT_BUFFER_MINUTES} minutes of this time"
                )
            )

    for field, value in update_fields.items():
        setattr(appointment, field, value)

    db.commit()
    db.refresh(appointment)
    return build_appointment_response(appointment)


# Cancel an appointment
@router.delete(
    "/{appointment_id}",
    status_code=status.HTTP_200_OK
)
def cancel_appointment(
    appointment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "receptionist", "doctor", "nurse"]))
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