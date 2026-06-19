from sqlalchemy import Column, String, Date, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from database import Base
import uuid
from datetime import datetime


class Patient(Base):
    __tablename__ = "patients"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    # Optional link to a user account
    # nullable=True means a patient does not need
    # a login account to exist in the system
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True
    )

    full_name = Column(String, nullable=False)

    date_of_birth = Column(Date, nullable=True)

    gender = Column(String, nullable=True)

    phone = Column(String, nullable=True)

    address = Column(String, nullable=True)

    blood_group = Column(String, nullable=True)

    allergies = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )