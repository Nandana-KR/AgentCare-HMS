from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from database import Base
import uuid
from datetime import datetime


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    # Links to patients table
    # Which patient is this appointment for
    patient_id = Column(
        UUID(as_uuid=True),
        ForeignKey("patients.id"),
        nullable=False
    )

    # Links to users table
    # Which doctor is seeing this patient
    doctor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )

    # Date and time of the appointment
    scheduled_at = Column(DateTime, nullable=False)

    # Current status of the appointment
    # Three possible values:
    # "scheduled"  → booked, not yet happened
    # "completed"  → doctor has seen the patient
    # "cancelled"  → appointment was cancelled
    status = Column(
        String,
        nullable=False,
        default="scheduled"
    )

    # Optional notes from receptionist or doctor
    notes = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships — lets you access related objects directly
    # patient.appointments gives all appointments for a patient
    # appointment.patient gives the patient object
    patient = relationship("Patient", backref="appointments")
    doctor = relationship("User", backref="appointments")