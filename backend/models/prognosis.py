from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from database import Base
import uuid
from datetime import datetime


class Prognosis(Base):
    __tablename__ = "prognoses"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    # Which diagnosis triggered this prognosis
    diagnosis_id = Column(
        UUID(as_uuid=True),
        ForeignKey("diagnoses.id"),
        nullable=False
    )

    # Which patient this belongs to
    patient_id = Column(
        UUID(as_uuid=True),
        ForeignKey("patients.id"),
        nullable=False
    )

    # Which doctor requested this
    doctor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )

    # What the AI generated
    ai_suggestion = Column(Text, nullable=False)

    # What the doctor saved after editing
    # Initially same as ai_suggestion
    # Doctor can modify before saving
    final_prognosis = Column(Text, nullable=True)

    # Which AI model was used
    # Important for audit trail
    model_used = Column(
        String,
        nullable=False,
        default="llama3-8b-8192"
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    # Relationships
    diagnosis = relationship("Diagnosis", backref="prognoses")
    patient = relationship("Patient", backref="prognoses")
    doctor = relationship("User", backref="prognoses")