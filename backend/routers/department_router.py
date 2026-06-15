from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models.department import Department
from models.user import User
from schemas.department_schema import DepartmentResponse
from dependencies import get_current_user

router = APIRouter(
    prefix="/api/v1/departments",
    tags=["departments"]
)


@router.get("/", response_model=List[DepartmentResponse])
def get_all_departments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Department).order_by(Department.name).all()
