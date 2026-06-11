from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from database import engine, Base, get_db
from routers import user_router
# Import the User model
# This line is critical — it makes SQLAlchemy "aware" of the User class
# When Base.metadata.create_all() runs below,
# it looks at everything that inherits from Base
# If User is never imported, SQLAlchemy doesn't know it exists
# and the users table never gets created
from models import user
from fastapi.middleware.cors import CORSMiddleware
from routers import user_router, auth_router,patient_router,appointment_router,diagnosis_router,prognosis_router
from dependencies import get_current_user
from models.user import User

# This line scans all models (table definitions) and creates
# matching tables in PostgreSQL if they don't exist yet
# Right now we have no models — so no tables are created
# But this line also TESTS the connection
# If your .env or docker-compose has a typo, this crashes here
# with a clear error rather than silently failing later
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Hospital Management System API",
    version="1.0.0"
)

# Add this CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Register the user router with the app
app.include_router(user_router.router)
app.include_router(auth_router.router)
app.include_router(patient_router.router)
app.include_router(appointment_router.router)
app.include_router(diagnosis_router.router)
app.include_router(prognosis_router.router)

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
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "is_active": current_user.is_active
    }