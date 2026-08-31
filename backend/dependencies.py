from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from typing import List, Union

from core.config import settings
from database import get_db
from models.user import User

# This tells FastAPI where to look for the token
# tokenUrl is the login route that issues the token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm],
        )
        email: str = payload.get("sub")
        role: str = payload.get("role")
        token_version = payload.get("ver")

        if email is None:
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()

    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated"
        )

    # Token invalidation check: the token carries the version it was issued
    # with. If it doesn't match the user's current token_version, the token
    # is stale (e.g. the password was changed after this token was issued),
    # so reject it. Tokens issued before this feature existed have no "ver"
    # claim (None) and are treated as stale, forcing a one-time re-login.
    if token_version != user.token_version:
        raise credentials_exception

    return user


def require_role(required_role: Union[str, List[str]]):
    allowed_roles = (
        [required_role] if isinstance(required_role, str) else required_role
    )

    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {' or '.join(allowed_roles)}"
            )
        return current_user
    return role_checker
