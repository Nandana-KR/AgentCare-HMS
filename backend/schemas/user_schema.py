from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import datetime
from typing import Optional, Literal


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: Optional[Literal["admin", "doctor", "receptionist", "nurse"]] = "doctor"
    department_id: Optional[UUID] = None
    supervisor_id: Optional[UUID] = None


class UserUpdate(BaseModel):
    role: Optional[Literal["admin", "doctor", "receptionist", "nurse"]] = None
    department_id: Optional[UUID] = None
    supervisor_id: Optional[UUID] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    department_id: Optional[UUID] = None
    department_name: Optional[str] = None
    supervisor_id: Optional[UUID] = None
    supervisor_name: Optional[str] = None

    class Config:
        from_attributes = True