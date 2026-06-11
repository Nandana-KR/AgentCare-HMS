from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional


class DiagnosisCreate(BaseModel):
    patient_id: UUID
    symptoms: str
    diagnosis_text: str
    icd_code: Optional[str] = None
    prescription: Optional[str] = None
    follow_up: Optional[str] = None


class DiagnosisUpdate(BaseModel):
    symptoms: Optional[str] = None
    diagnosis_text: Optional[str] = None
    icd_code: Optional[str] = None
    prescription: Optional[str] = None
    follow_up: Optional[str] = None


class DiagnosisResponse(BaseModel):
    id: UUID
    patient_id: UUID
    doctor_id: UUID
    symptoms: str
    diagnosis_text: str
    icd_code: Optional[str] = None
    prescription: Optional[str] = None
    follow_up: Optional[str] = None
    diagnosed_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True