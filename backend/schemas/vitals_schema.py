from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional


class VitalsCreate(BaseModel):
    patient_id: UUID
    temperature: Optional[float] = None
    heart_rate: Optional[int] = None
    blood_pressure_systolic: Optional[int] = None
    blood_pressure_diastolic: Optional[int] = None
    respiratory_rate: Optional[int] = None
    oxygen_saturation: Optional[float] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None


class VitalsResponse(BaseModel):
    id: UUID
    patient_id: UUID
    recorded_by: UUID
    temperature: Optional[float] = None
    heart_rate: Optional[int] = None
    blood_pressure_systolic: Optional[int] = None
    blood_pressure_diastolic: Optional[int] = None
    respiratory_rate: Optional[int] = None
    oxygen_saturation: Optional[float] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    recorded_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True
