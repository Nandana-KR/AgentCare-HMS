from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from database import get_db
from models.user import User
from schemas.user_schema import UserCreate, UserResponse


# CryptContext tells passlib which algorithm to use
# bcrypt is the industry standard for password hashing
# deprecated="auto" means old hash formats are
# automatically upgraded when users log in
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# APIRouter is like a mini FastAPI app
# It holds a group of related routes
# We register it in main.py with a prefix
router = APIRouter(
    prefix="/api/v1/users",
    tags=["users"]
)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED
)
def register_user(user_data: UserCreate, db: Session = Depends(get_db)):

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
        role=user_data.role
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user