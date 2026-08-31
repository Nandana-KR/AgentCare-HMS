from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional


class VitalsCreate(BaseModel):
    # Each vital has a wide but medically-plausible range. These reject
    # clearly impossible/typo values (e.g. a temperature of 500) while
    # still accepting any genuinely possible human reading. Ranges are
    # intentionally generous to avoid rejecting real, unusual readings.
    patient_id: UUID
    temperature: Optional[float] = Field(default=None, ge=25, le=45)          # deg C
    heart_rate: Optional[int] = Field(default=None, ge=20, le=300)            # bpm
    blood_pressure_systolic: Optional[int] = Field(default=None, ge=40, le=300)
    blood_pressure_diastolic: Optional[int] = Field(default=None, ge=20, le=200)
    respiratory_rate: Optional[int] = Field(default=None, ge=4, le=80)        # breaths/min
    oxygen_saturation: Optional[float] = Field(default=None, ge=0, le=100)    # %
    weight_kg: Optional[float] = Field(default=None, ge=0.3, le=650)          # kg
    height_cm: Optional[float] = Field(default=None, ge=20, le=280)           # cm


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
