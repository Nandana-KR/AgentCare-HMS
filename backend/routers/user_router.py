from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models.user import User
from schemas.user_schema import UserCreate, UserResponse, UserUpdate
from dependencies import get_current_user, require_role
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

router = APIRouter(
    prefix="/api/v1/users",
    tags=["users"]
)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def build_user_response(u):
    return {
        "id": str(u.id),
        "email": u.email,
        "full_name": u.full_name,
        "role": u.role,
        "is_active": u.is_active,
        "created_at": u.created_at,
        "department_id": u.department_id,
        "department_name": u.department.name if u.department else None,
        "supervisor_id": u.supervisor_id,
        "supervisor_name": u.supervisor.full_name if u.supervisor else None
    }
@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED
)
def register_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    existing_user = db.query(User).filter(
        User.email == user_data.email
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    hashed_pw = hash_password(user_data.password)

    new_user = User(
        email=user_data.email,
        hashed_password=hashed_pw,
        full_name=user_data.full_name,
        role=user_data.role,
        department_id=user_data.department_id,
        supervisor_id=user_data.supervisor_id
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return build_user_response(new_user)


# Get all doctors
# Used for appointment booking dropdown
@router.get(
    "/doctors",
    response_model=List[UserResponse]
)
def get_all_doctors(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    doctors = db.query(User).filter(
        User.role == "doctor",
        User.is_active == True
    ).all()
    return [build_user_response(d) for d in doctors]


# Get all staff
# Admin-only — used for the staff management page
@router.get(
    "/",
    response_model=List[UserResponse]
)
def get_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "receptionist"]))
):
    users = db.query(User).order_by(User.full_name).all()
    return [build_user_response(u) for u in users]


# Update a staff member's role, department, supervisor, or active status
# Admin-only
@router.patch(
    "/{user_id}",
    response_model=UserResponse
)
def update_user(
    user_id: str,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    update_data = user_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(target_user, field, value)

    db.commit()
    db.refresh(target_user)
    return build_user_response(target_user)