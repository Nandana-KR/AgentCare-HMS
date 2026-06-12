import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axiosInstance from '../api/axiosInstance'

function PatientDetail() {
    const { id } = useParams()
    const navigate = useNavigate()

    const [patient, setPatient] = useState(null)
    const [appointments, setAppointments] = useState([])
    const [diagnoses, setDiagnoses] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [activeTab, setActiveTab] = useState('info')

    useEffect(() => {
        fetchPatientData()
    }, [id])

    const fetchPatientData = async () => {
        setLoading(true)
        try {
            // Fetch all three simultaneously
            const [patientRes, appointmentsRes, diagnosesRes] = 
                await Promise.all([
                    axiosInstance.get(`/api/v1/patients/${id}`),
                    axiosInstance.get(
                        `/api/v1/appointments/patient/${id}`
                    ),
                    axiosInstance.get(
                        `/api/v1/diagnoses/patient/${id}`
                    )
                ])

            setPatient(patientRes.data)
            setAppointments(appointmentsRes.data)
            setDiagnoses(diagnosesRes.data)
        } catch (err) {
            setError('Failed to load patient data')
        } finally {
            setLoading(false)
        }
    }

    if (loading) return <p style={styles.loading}>Loading...</p>
    if (error) return <p style={styles.error}>{error}</p>
    if (!patient) return <p style={styles.error}>Patient not found</p>

    return (
        <div style={styles.container}>

            {/* Header */}
            <div style={styles.header}>
                <button
                    style={styles.backBtn}
                    onClick={() => navigate('/patients')}
                >
                    ← Back to Patients
                </button>
                <h2 style={styles.name}>{patient.full_name}</h2>
            </div>

            {/* Patient Info Card */}
            <div style={styles.infoCard}>
                <div style={styles.infoGrid}>
                    <div style={styles.infoItem}>
                        <span style={styles.label}>Gender</span>
                        <span style={styles.value}>
                            {patient.gender || '-'}
                        </span>
                    </div>
                    <div style={styles.infoItem}>
                        <span style={styles.label}>Blood Group</span>
                        <span style={styles.value}>
                            {patient.blood_group || '-'}
                        </span>
                    </div>
                    <div style={styles.infoItem}>
                        <span style={styles.label}>Phone</span>
                        <span style={styles.value}>
                            {patient.phone || '-'}
                        </span>
                    </div>
                    <div style={styles.infoItem}>
                        <span style={styles.label}>Date of Birth</span>
                        <span style={styles.value}>
                            {patient.date_of_birth || '-'}
                        </span>
                    </div>
                    <div style={styles.infoItem}>
                        <span style={styles.label}>Address</span>
                        <span style={styles.value}>
                            {patient.address || '-'}
                        </span>
                    </div>
                    <div style={styles.infoItem}>
                        <span style={styles.label}>Registered</span>
                        <span style={styles.value}>
                            {new Date(patient.created_at)
                                .toLocaleDateString()}
                        </span>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div style={styles.tabs}>
                <button
                    style={{
                        ...styles.tab,
                        ...(activeTab === 'appointments'
                            ? styles.activeTab : {})
                    }}
                    onClick={() => setActiveTab('appointments')}
                >
                    Appointments ({appointments.length})
                </button>
                <button
                    style={{
                        ...styles.tab,
                        ...(activeTab === 'diagnoses'
                            ? styles.activeTab : {})
                    }}
                    onClick={() => setActiveTab('diagnoses')}
                >
                    Diagnoses ({diagnoses.length})
                </button>
            </div>

            {/* Appointments Tab */}
            {activeTab === 'appointments' && (
                <div style={styles.tabContent}>
                    {appointments.length === 0 ? (
                        <p style={styles.empty}>
                            No appointments found
                        </p>
                    ) : (
                        appointments.map(apt => (
                            <div key={apt.id} style={styles.card}>
                                <div style={styles.cardRow}>
                                    <span style={styles.label}>
                                        Scheduled
                                    </span>
                                    <span style={styles.value}>
                                        {new Date(apt.scheduled_at)
                                            .toLocaleString()}
                                    </span>
                                </div>
                                <div style={styles.cardRow}>
                                    <span style={styles.label}>
                                        Status
                                    </span>
                                    <span style={{
                                        ...styles.badge,
                                        backgroundColor:
                                            apt.status === 'completed'
                                                ? '#c6f6d5'
                                            : apt.status === 'cancelled'
                                                ? '#fed7d7'
                                                : '#bee3f8'
                                    }}>
                                        {apt.status}
                                    </span>
                                </div>
                                {apt.notes && (
                                    <div style={styles.cardRow}>
                                        <span style={styles.label}>
                                            Notes
                                        </span>
                                        <span style={styles.value}>
                                            {apt.notes}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Diagnoses Tab */}
            {activeTab === 'diagnoses' && (
                <div style={styles.tabContent}>
                    <button
                        style={styles.addBtn}
                        onClick={() => navigate(
                            `/patients/${id}/diagnosis/new`
                        )}
                    >
                        + Add Diagnosis
                    </button>
                    {diagnoses.length === 0 ? (
                        <p style={styles.empty}>
                            No diagnoses found
                        </p>
                    ) : (
                        diagnoses.map(diag => (
                            <div key={diag.id} style={styles.card}>
                                <div style={styles.cardRow}>
                                    <span style={styles.label}>
                                        Date
                                    </span>
                                    <span style={styles.value}>
                                        {new Date(diag.diagnosed_at)
                                            .toLocaleDateString()}
                                    </span>
                                </div>
                                <div style={styles.cardRow}>
                                    <span style={styles.label}>
                                        Symptoms
                                    </span>
                                    <span style={styles.value}>
                                        {diag.symptoms}
                                    </span>
                                </div>
                                <div style={styles.cardRow}>
                                    <span style={styles.label}>
                                        Diagnosis
                                    </span>
                                    <span style={styles.value}>
                                        {diag.diagnosis_text}
                                    </span>
                                </div>
                                {diag.icd_code && (
                                    <div style={styles.cardRow}>
                                        <span style={styles.label}>
                                            ICD Code
                                        </span>
                                        <span style={styles.value}>
                                            {diag.icd_code}
                                        </span>
                                    </div>
                                )}
                                {diag.prescription && (
                                    <div style={styles.cardRow}>
                                        <span style={styles.label}>
                                            Prescription
                                        </span>
                                        <span style={styles.value}>
                                            {diag.prescription}
                                        </span>
                                    </div>
                                )}
                                <button
                                    style={styles.prognosisBtn}
                                    onClick={() => navigate(
                                        `/prognosis/${diag.id}`
                                    )}
                                >
                                    View / Generate Prognosis
                                </button>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    )
}

const styles = {
    container: { padding: '24px', maxWidth: '900px', margin: '0 auto' },
    header: {
        display: 'flex', alignItems: 'center',
        gap: '16px', marginBottom: '24px'
    },
    backBtn: {
        padding: '8px 16px', backgroundColor: '#e2e8f0',
        border: 'none', borderRadius: '6px', cursor: 'pointer'
    },
    name: { color: '#1a365d', margin: 0 },
    infoCard: {
        backgroundColor: 'white', padding: '24px',
        borderRadius: '12px', marginBottom: '24px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)'
    },
    infoGrid: {
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px'
    },
    infoItem: { display: 'flex', flexDirection: 'column', gap: '4px' },
    label: { fontSize: '12px', color: '#718096', fontWeight: '600' },
    value: { fontSize: '14px', color: '#2d3748' },
    tabs: { display: 'flex', gap: '8px', marginBottom: '16px' },
    tab: {
        padding: '10px 20px', border: '2px solid #e2e8f0',
        borderRadius: '8px', cursor: 'pointer',
        backgroundColor: 'white', color: '#4a5568'
    },
    activeTab: {
        backgroundColor: '#2b6cb0',
        borderColor: '#2b6cb0', color: 'white'
    },
    tabContent: { display: 'flex', flexDirection: 'column', gap: '12px' },
    card: {
        backgroundColor: 'white', padding: '16px',
        borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
    },
    cardRow: {
        display: 'flex', gap: '12px',
        alignItems: 'flex-start', marginBottom: '8px'
    },
    badge: {
        padding: '2px 10px', borderRadius: '12px',
        fontSize: '12px', fontWeight: '600'
    },
    addBtn: {
        padding: '10px 20px', backgroundColor: '#38a169',
        color: 'white', border: 'none',
        borderRadius: '6px', cursor: 'pointer',
        alignSelf: 'flex-start', marginBottom: '8px'
    },
    prognosisBtn: {
        padding: '6px 14px', backgroundColor: '#805ad5',
        color: 'white', border: 'none',
        borderRadius: '4px', cursor: 'pointer', marginTop: '8px'
    },
    loading: { textAlign: 'center', padding: '40px', color: '#718096' },
    error: { textAlign: 'center', padding: '40px', color: '#e53e3e' },
    empty: { textAlign: 'center', padding: '20px', color: '#a0aec0' }
}

export default PatientDetail