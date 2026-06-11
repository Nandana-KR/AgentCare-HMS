# Import Column — used to define each column in the table
from sqlalchemy import Column, String, Boolean, DateTime

# Import UUID type specifically for PostgreSQL
# PostgreSQL has a native UUID type which is more efficient
# than storing UUIDs as plain strings
from sqlalchemy.dialects.postgresql import UUID

# Import Base from our database.py
# Every model MUST inherit from Base
# This is how SQLAlchemy knows this class = a database table
from database import Base

# Python's built-in uuid library — generates random UUID values
import uuid

# Python's built-in datetime library — for timestamps
from datetime import datetime


# This class defines the "users" table in PostgreSQL
# Every class that inherits from Base becomes a table
class User(Base):

    # __tablename__ tells SQLAlchemy what to name the table in PostgreSQL
    # Convention: lowercase, plural, underscored
    # If you remove this, SQLAlchemy raises an error — it's required
    __tablename__ = "users"

    # PRIMARY KEY — every table must have one
    # It uniquely identifies each row — like a row number that never repeats
    # UUID(as_uuid=True) — store as a real UUID type, not a string
    # default=uuid.uuid4 — automatically generate a new UUID
    # when a new user is created (notice: uuid.uuid4 not uuid.uuid4()
    # — we pass the function itself, not its result,
    # so it generates a NEW uuid for each user, not the same one)
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    # Email — the login identifier
    # String — text data
    # unique=True — no two users can have the same email
    #   (the database enforces this, not just your Python code)
    # nullable=False — this field is required, cannot be left empty
    # index=True — creates a database index on this column
    #   An index is like a book's index — instead of reading
    #   every page to find "email: thomas@...", the database
    #   jumps directly to the right row. Makes lookups fast.
    email = Column(
        String,
        unique=True,
        nullable=False,
        index=True
    )

    # The scrambled password — NEVER the original
    # nullable=False — required field
    # No unique constraint — two users could theoretically
    # have the same hashed password (very unlikely but allowed)
    hashed_password = Column(
        String,
        nullable=False
    )

    # Display name — just a regular text field
    full_name = Column(
        String,
        nullable=False
    )

    # Role — controls what this user can access
    # Stored as a plain string: "admin", "doctor", "receptionist"
    # default="doctor" — if no role is specified when creating a user,
    # they get "doctor" by default
    role = Column(
        String,
        nullable=False,
        default="doctor"
    )

    # Boolean — True or False only
    # default=True — new accounts are active by default
    # Set to False when a staff member leaves instead of deleting their account
    is_active = Column(
        Boolean,
        default=True
    )

    # Timestamp — records exactly when this account was created
    # datetime.utcnow — use UTC time (not local time)
    # UTC is the global standard in backend systems
    # so data from servers in different timezones is consistent
    # Notice: datetime.utcnow not datetime.utcnow()
    # — same reason as uuid.uuid4, we pass the function itself
    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )