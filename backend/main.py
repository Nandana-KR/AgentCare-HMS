from fastapi import FastAPI, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import engine, Base, get_db
from routers import user_router
from routers.user_router import build_user_response

from models import user, patient, appointment, diagnosis, prognosis, department, vitals
from fastapi.middleware.cors import CORSMiddleware
from routers import user_router, auth_router,patient_router,appointment_router,diagnosis_router,prognosis_router,vitals_router,department_router
from dependencies import get_current_user
from models.user import User

from alembic.config import Config
from alembic import command
import os

os.environ.setdefault("LANGSMITH_TRACING", os.getenv("LANGSMITH_TRACING", "false"))
os.environ.setdefault("LANGSMITH_API_KEY", os.getenv("LANGSMITH_API_KEY", ""))
os.environ.setdefault("LANGSMITH_PROJECT", os.getenv("LANGSMITH_PROJECT", "Hospital_Agentic_System"))

def run_migrations():
    try:
        alembic_cfg = Config(os.path.join(os.path.dirname(__file__), "alembic.ini"))
        command.upgrade(alembic_cfg, "head")
        print("Alembic migrations applied successfully")
    except Exception as e:
        print(f"Migration warning: {e}")

run_migrations()

# This line scans all models (table definitions) and creates
# matching tables in PostgreSQL if they don't exist yet
# Right now we have no models — so no tables are created
# But this line also TESTS the connection
# If your .env or docker-compose has a typo, this crashes here
# with a clear error rather than silently failing later


ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "https://hospital-ms-nandana.vercel.app"
]

app = FastAPI(
    title="Hospital Management System API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    origin = request.headers.get("origin", "")
    headers = {}
    if origin in ALLOWED_ORIGINS:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    return JSONResponse(
        status_code=500,
        content={"detail": f"Server error: {str(exc)}"},
        headers=headers
    )
# Register the user router with the app
app.include_router(user_router.router)
app.include_router(auth_router.router)
app.include_router(patient_router.router)
app.include_router(appointment_router.router)
app.include_router(diagnosis_router.router)
app.include_router(prognosis_router.router)
app.include_router(vitals_router.router)
app.include_router(department_router.router)

@app.get("/")
def read_root():
    return {"message": "Hospital Management System is running!"}


# Test route — confirms FastAPI can talk to PostgreSQL
# Depends(get_db) tells FastAPI: before running this function,
# call get_db() and pass its result as the db parameter
# If the database is unreachable, this returns an error here
# instead of crashing somewhere unexpected later
@app.get("/test-db")
def test_db_connection(db: Session = Depends(get_db)):
    return {"message": "Database connection successful!"}


# This route is protected — you must send a valid token to access it
@app.get("/me")
def get_my_profile(current_user: User = Depends(get_current_user)):
    return build_user_response(current_user)