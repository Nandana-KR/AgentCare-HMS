from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from database import Base
import uuid
from datetime import datetime


class Diagnosis(Base):
    __tablename__ = "diagnoses"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    patient_id = Column(
        UUID(as_uuid=True),
        ForeignKey("patients.id"),
        nullable=False
    )

    doctor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )

    # What the patient complained about
    symptoms = Column(Text, nullable=False)

    # Doctor's conclusion
    diagnosis_text = Column(Text, nullable=False)

    # International Classification of Diseases code
    # Optional — not every diagnosis has a formal code
    icd_code = Column(String, nullable=True)

    # Medicines and treatment recommended
    prescription = Column(Text, nullable=True)

    # Next steps — follow up visits, tests, referrals
    follow_up = Column(Text, nullable=True)

    # When the doctor made this diagnosis
    diagnosed_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    # Relationships
    patient = relationship("Patient", backref="diagnoses")
    doctor = relationship("User", backref="diagnoses")