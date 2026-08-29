from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from core.config import settings

# Read the database connection string from the centralized settings object.
DATABASE_URL = settings.database_url

# Create the engine — the bridge between Python and PostgreSQL
# This doesn't open a connection yet — it just stores the config
# Use SSL when available for non-local databases (e.g. managed Postgres
# providers). "prefer" negotiates SSL if the server offers it but won't
# fail the connection if the server doesn't require/support it — this
# works for both Render's internal network and externally-proxied DBs.
# connect_timeout: fail fast (10s) if the database is unreachable
# instead of hanging the request/worker indefinitely on a dead or
# stuck database. This bounds the worst-case wait when the DB is down.
connect_args = {"connect_timeout": 10}
if "localhost" not in DATABASE_URL and "127.0.0.1" not in DATABASE_URL:
    connect_args["sslmode"] = "prefer"

engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)

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
