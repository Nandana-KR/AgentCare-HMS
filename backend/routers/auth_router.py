from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import jwt
from datetime import UTC, datetime, timedelta
from pydantic import BaseModel

from core.config import settings
from database import get_db
from models.user import User
from dependencies import get_current_user

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

router = APIRouter(
    prefix="/api/v1/auth",
    tags=["auth"]
)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


# A precomputed dummy bcrypt hash used to defend against timing attacks.
# When a login is attempted for an email that doesn't exist, we still run
# a bcrypt verification against this dummy hash so that the response time
# is the same whether the email exists or not. Without this, a missing
# email returns instantly (no hash check) while a wrong password takes
# longer (real hash check), letting an attacker distinguish registered
# emails by measuring response time (user enumeration via timing).
_DUMMY_PASSWORD_HASH = pwd_context.hash("timing_attack_dummy_password")


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(UTC) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    to_encode.update({"exp": expire})
    token = jwt.encode(
        to_encode,
        settings.secret_key,
        algorithm=settings.algorithm,
    )
    return token


@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.email == form_data.username
    ).first()

    # Timing-attack defense: always perform a bcrypt verification, even
    # when the user does not exist, so both cases take the same amount of
    # time. If the user is missing, verify against a dummy hash (which
    # will always fail). This keeps the "invalid email or password"
    # response time constant regardless of whether the email is registered.
    password_hash_to_check = user.hashed_password if user else _DUMMY_PASSWORD_HASH
    password_valid = verify_password(form_data.password, password_hash_to_check)

    if not user or not password_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated"
        )

    access_token = create_access_token(
        data={
            "sub": user.email,
            "role": user.role,
            # Embed the current token version. On each request this is
            # compared against the user's current token_version; a
            # mismatch (e.g. after a password change) rejects the token.
            "ver": user.token_version,
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/change-password")
def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    if len(data.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters"
        )
    current_user.hashed_password = pwd_context.hash(data.new_password)
    # Invalidate all existing tokens for this user by bumping the version.
    # Any token issued before this change now carries an outdated version
    # and will be rejected on its next request — so a password change logs
    # the user out everywhere, including any attacker holding an old token.
    current_user.token_version = (current_user.token_version or 1) + 1
    db.commit()
    return {"message": "Password changed successfully"}
