"""
API endpoint tests for Hospital Management System.
Tests core functionality: auth, patients, appointments, diagnoses.
"""
import pytest
from fastapi.testclient import TestClient
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["SECRET_KEY"] = "test-secret-key"
os.environ["GROQ_API_KEY"] = "test"

from database import engine, Base
from main import app

client = TestClient(app)


@pytest.fixture(autouse=True, scope="module")
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


# ── Auth Tests ──

class TestAuth:
    token = None
    user_id = None

    def test_register_admin(self):
        res = client.post("/api/v1/users/register", json={
            "email": "testadmin@hms.com",
            "password": "admin123",
            "full_name": "Test Admin",
            "role": "admin"
        })
        assert res.status_code == 201
        assert res.json()["email"] == "testadmin@hms.com"
        TestAuth.user_id = res.json()["id"]

    def test_register_doctor(self):
        res = client.post("/api/v1/users/register", json={
            "email": "testdoc@hms.com",
            "password": "doctor123",
            "full_name": "Smith",
            "role": "doctor"
        })
        assert res.status_code == 201

    def test_register_duplicate_email(self):
        res = client.post("/api/v1/users/register", json={
            "email": "testadmin@hms.com",
            "password": "test123",
            "full_name": "Duplicate",
            "role": "admin"
        })
        assert res.status_code == 400

    def test_login_success(self):
        res = client.post("/api/v1/auth/login", data={
            "username": "testadmin@hms.com",
            "password": "admin123"
        })
        assert res.status_code == 200
        assert "access_token" in res.json()
        TestAuth.token = res.json()["access_token"]

    def test_login_wrong_password(self):
        res = client.post("/api/v1/auth/login", data={
            "username": "testadmin@hms.com",
            "password": "wrongpassword"
        })
        assert res.status_code == 401

    def test_login_nonexistent_user(self):
        res = client.post("/api/v1/auth/login", data={
            "username": "nobody@hms.com",
            "password": "test123"
        })
        assert res.status_code == 401

    def test_get_profile(self):
        res = client.get("/me", headers={"Authorization": f"Bearer {TestAuth.token}"})
        assert res.status_code == 200
        assert res.json()["email"] == "testadmin@hms.com"

    def test_unauthorized_access(self):
        res = client.get("/me")
        assert res.status_code == 401


# ── Patient Tests ──

class TestPatients:
    patient_id = None

    def test_create_patient(self):
        res = client.post("/api/v1/patients/", json={
            "full_name": "Test Patient",
            "date_of_birth": "2000-01-15",
            "gender": "male",
            "phone": "9876543210",
            "address": "Test City"
        }, headers={"Authorization": f"Bearer {TestAuth.token}"})
        assert res.status_code == 201
        assert res.json()["full_name"] == "Test Patient"
        TestPatients.patient_id = res.json()["id"]

    def test_get_patients(self):
        res = client.get("/api/v1/patients/", headers={"Authorization": f"Bearer {TestAuth.token}"})
        assert res.status_code == 200
        assert len(res.json()) >= 1

    def test_get_patient_count(self):
        res = client.get("/api/v1/patients/count", headers={"Authorization": f"Bearer {TestAuth.token}"})
        assert res.status_code == 200
        assert res.json()["total"] >= 1

    def test_get_patient_by_id(self):
        res = client.get(f"/api/v1/patients/{TestPatients.patient_id}",
                         headers={"Authorization": f"Bearer {TestAuth.token}"})
        assert res.status_code == 200
        assert res.json()["full_name"] == "Test Patient"

    def test_search_patient(self):
        res = client.get("/api/v1/patients/?search=Test",
                         headers={"Authorization": f"Bearer {TestAuth.token}"})
        assert res.status_code == 200
        assert len(res.json()) >= 1


# ── Appointment Tests ──

class TestAppointments:
    appointment_id = None
    doctor_id = None

    def test_get_doctor_id(self):
        doc_res = client.post("/api/v1/auth/login", data={
            "username": "testdoc@hms.com",
            "password": "doctor123"
        })
        doc_token = doc_res.json()["access_token"]
        profile = client.get("/me", headers={"Authorization": f"Bearer {doc_token}"})
        TestAppointments.doctor_id = profile.json()["id"]

    def test_book_appointment(self):
        res = client.post("/api/v1/appointments/", json={
            "patient_id": TestPatients.patient_id,
            "doctor_id": TestAppointments.doctor_id,
            "scheduled_at": "2026-12-25T10:00:00",
            "notes": "Test appointment"
        }, headers={"Authorization": f"Bearer {TestAuth.token}"})
        assert res.status_code == 201
        assert res.json()["status"] == "scheduled"
        TestAppointments.appointment_id = res.json()["id"]

    def test_get_appointments(self):
        res = client.get("/api/v1/appointments/",
                         headers={"Authorization": f"Bearer {TestAuth.token}"})
        assert res.status_code == 200
        assert len(res.json()) >= 1

    def test_get_patient_appointments(self):
        res = client.get(f"/api/v1/appointments/patient/{TestPatients.patient_id}",
                         headers={"Authorization": f"Bearer {TestAuth.token}"})
        assert res.status_code == 200
        assert len(res.json()) >= 1


# ── Diagnosis Tests ──

class TestDiagnosis:
    diagnosis_id = None

    def test_create_diagnosis(self):
        doc_res = client.post("/api/v1/auth/login", data={
            "username": "testdoc@hms.com",
            "password": "doctor123"
        })
        doc_token = doc_res.json()["access_token"]

        res = client.post("/api/v1/diagnoses/", json={
            "patient_id": TestPatients.patient_id,
            "appointment_id": TestAppointments.appointment_id,
            "symptoms": "fever, cough"
        }, headers={"Authorization": f"Bearer {doc_token}"})
        assert res.status_code == 201
        assert res.json()["symptoms"] == "fever, cough"
        assert res.json()["diagnosis_text"] == "Pending AI analysis"
        TestDiagnosis.diagnosis_id = res.json()["id"]

    def test_get_patient_diagnoses(self):
        res = client.get(f"/api/v1/diagnoses/patient/{TestPatients.patient_id}",
                         headers={"Authorization": f"Bearer {TestAuth.token}"})
        assert res.status_code == 200
        assert len(res.json()) >= 1

    def test_update_diagnosis(self):
        doc_res = client.post("/api/v1/auth/login", data={
            "username": "testdoc@hms.com",
            "password": "doctor123"
        })
        doc_token = doc_res.json()["access_token"]

        res = client.patch(f"/api/v1/diagnoses/{TestDiagnosis.diagnosis_id}", json={
            "diagnosis_text": "Acute upper respiratory infection",
            "icd_code": "J06.9",
            "prescription": "Acetaminophen 500mg",
            "follow_up": "Return in 5 days"
        }, headers={"Authorization": f"Bearer {doc_token}"})
        assert res.status_code == 200
        assert res.json()["diagnosis_text"] == "Acute upper respiratory infection"


# ── RAG Tests ──

class TestRAG:
    def test_clinical_guidelines_search(self):
        from services.rag_service import search_clinical_guidelines
        result = search_clinical_guidelines("fever cough")
        assert "guidelines" in result
        assert len(result["guidelines"]) > 0

    def test_drug_interaction_search(self):
        from services.rag_service import search_drug_interactions
        result = search_drug_interactions("warfarin")
        assert "offline_interactions" in result

    def test_survival_statistics_search(self):
        from services.rag_service import search_survival_statistics
        result = search_survival_statistics("pneumonia")
        assert "statistics" in result
        assert len(result["statistics"]) > 0


# ── Cache Tests ──

class TestCache:
    def test_cache_set_get(self):
        from services.cache_service import set, get, stats
        set("test", "key1", {"data": "value"})
        result = get("test", "key1")
        assert result == {"data": "value"}

    def test_cache_miss(self):
        from services.cache_service import get
        result = get("test", "nonexistent")
        assert result is None

    def test_cache_stats(self):
        from services.cache_service import stats
        result = stats()
        assert "total_entries" in result
        assert "active" in result


# ── Health Check ──

class TestHealth:
    def test_root_endpoint(self):
        res = client.get("/")
        assert res.status_code == 200
        assert "running" in res.json()["message"].lower()

    def test_cache_stats_endpoint(self):
        res = client.get("/cache-stats")
        assert res.status_code == 200
        assert "total_entries" in res.json()
