from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional


class PrognosisGenerate(BaseModel):
    # Doctor sends only the diagnosis_id
    # System gathers everything else automatically
    diagnosis_id: UUID


class PrognosisSave(BaseModel):
    # Doctor's edited final version
    final_prognosis: str


class PrognosisResponse(BaseModel):
    id: UUID
    diagnosis_id: UUID
    patient_id: UUID
    doctor_id: UUID
    ai_suggestion: str
    final_prognosis: Optional[str] = None
    model_used: str
    created_at: datetime

    class Config:
        from_attributes = True