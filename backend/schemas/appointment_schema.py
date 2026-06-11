from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional


class AppointmentCreate(BaseModel):
    patient_id: UUID
    doctor_id: UUID
    scheduled_at: datetime
    notes: Optional[str] = None


class AppointmentUpdate(BaseModel):
    scheduled_at: Optional[datetime] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class AppointmentResponse(BaseModel):
    id: UUID
    patient_id: UUID
    doctor_id: UUID
    scheduled_at: datetime
    status: str
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True