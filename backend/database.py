from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

# Load values from your .env file into Python's environment
load_dotenv()

# Read the database connection string from .env
DATABASE_URL = os.getenv("DATABASE_URL")

# Create the engine — the bridge between Python and PostgreSQL
# This doesn't open a connection yet — it just stores the config
engine = create_engine(DATABASE_URL)

# Session factory — each request gets its own session
# Think of a session as one conversation with the database
# autocommit=False means nothing saves until you say db.commit()
# This protects you from half-finished operations being saved
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class — every table model you write will inherit from this
# This is how SQLAlchemy knows a Python class = a database table
Base = declarative_base()


# This function hands a database session to any route that needs one
# FastAPI calls this automatically via Depends() — you'll see this soon
# The try/finally guarantees the session always closes
# even if your route crashes halfway through
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()