import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axiosInstance from '../api/axiosInstance'
import { useAuth } from '../context/AuthContext'

const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
const fmtDateTime = (d) => new Date(d).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

function PatientDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()

    const [patient, setPatient] = useState(null)
    const [appointments, setAppointments] = useState([])
    const [diagnoses, setDiagnoses] = useState([])
    const [vitals, setVitals] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [activeTab, setActiveTab] = useState('appointments')

    const canRecordVitals = ['nurse', 'doctor'].includes(user?.role)
    const canSeeDiagnoses = ['doctor', 'nurse'].includes(user?.role)
    const canAddDiagnosis = user?.role === 'doctor'

    useEffect(() => {
        setLoading(true)
        Promise.all([
            axiosInstance.get(`/api/v1/patients/${id}`),
            axiosInstance.get(`/api/v1/appointments/patient/${id}`),
            axiosInstance.get(`/api/v1/diagnoses/patient/${id}`),
            axiosInstance.get(`/api/v1/vitals/patient/${id}`)
        ]).then(([p, a, d, v]) => {
            setPatient(p.data)
            setAppointments(a.data)
            setDiagnoses(d.data)
            setVitals(v.data)
        }).catch(() => setError('Failed to load patient data'))
          .finally(() => setLoading(false))
    }, [id])

    if (loading) return <p style={s.centerText}>Loading...</p>
    if (error) return <p style={{ ...s.centerText, color: '#e53e3e' }}>{error}</p>
    if (!patient) return <p style={{ ...s.centerText, color: '#e53e3e' }}>Patient not found</p>

    const navItems = [
        { key: 'appointments', label: 'Appointments', count: appointments.length },
        ...(canSeeDiagnoses ? [{ key: 'diagnoses', label: 'Diagnoses', count: diagnoses.length }] : []),
        { key: 'vitals', label: 'Vitals', count: vitals.length }
    ]

    const statusColor = (st) => ({
        backgroundColor: st === 'completed' ? '#c6f6d5' : st === 'cancelled' ? '#fed7d7' : '#bee3f8',
        color: st === 'completed' ? '#276749' : st === 'cancelled' ? '#9b2c2c' : '#2b6cb0'
    })

    return (
        <div style={s.page}>

            {/* Page header */}
            <div style={s.pageHeader}>
                <button style={s.backBtn} onClick={() => navigate('/patients')}>
                    ← Back to Patients
                </button>
                <h2 style={s.patientName}>{patient.full_name}</h2>
            </div>

            {/* Info card — full width */}
            <div style={s.infoCard}>
                <div style={s.infoGrid}>
                    <InfoItem label="Gender" value={patient.gender} />
                    <InfoItem label="Blood Group" value={patient.blood_group} />
                    <InfoItem label="Phone" value={patient.phone} />
                    <InfoItem label="Date of Birth" value={patient.date_of_birth ? fmtDate(patient.date_of_birth) : null} />
                    <InfoItem label="Address" value={patient.address} />
                    <InfoItem label="Registered" value={fmtDate(patient.created_at)} />
                </div>
            </div>

            {/* Two-column layout: left nav + right content */}
            <div style={s.body}>

                {/* Left section nav */}
                <div style={s.sectionNav}>
                    {navItems.map(item => (
                        <button
                            key={item.key}
                            style={{
                                ...s.navBtn,
                                ...(activeTab === item.key ? s.navBtnActive : {})
                            }}
                            onClick={() => setActiveTab(item.key)}
                        >
                            <span>{item.label}</span>
                            <span style={{
                                ...s.navCount,
                                ...(activeTab === item.key ? s.navCountActive : {})
                            }}>
                                {item.count}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Right content panel */}
                <div style={s.content}>

                    {/* APPOINTMENTS */}
                    {activeTab === 'appointments' && (
                        <div style={s.cardList}>
                            {appointments.length === 0 ? (
                                <div style={s.emptyState}>No appointments recorded</div>
                            ) : (
                                appointments.map(apt => (
                                    <div key={apt.id} style={s.historyCard}>
                                        <div style={s.historyCardHeader}>
                                            <span style={s.historyDate}>{fmtDateTime(apt.scheduled_at)}</span>
                                            <span style={{ ...s.badge, ...statusColor(apt.status) }}>
                                                {apt.status}
                                            </span>
                                        </div>
                                        {apt.notes && (
                                            <p style={s.historyNote}>{apt.notes}</p>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* DIAGNOSES */}
                    {activeTab === 'diagnoses' && canSeeDiagnoses && (
                        <div style={s.cardList}>
                            {canAddDiagnosis && (
                                <button style={s.addBtn}
                                    onClick={() => navigate(`/patients/${id}/diagnosis/new`)}>
                                    + Add Diagnosis
                                </button>
                            )}
                            {diagnoses.length === 0 ? (
                                <div style={s.emptyState}>No diagnoses recorded</div>
                            ) : (
                                diagnoses.map(diag => (
                                    <div key={diag.id} style={s.historyCard}>
                                        <div style={s.historyCardHeader}>
                                            <span style={s.historyDate}>{fmtDate(diag.diagnosed_at)}</span>
                                        </div>
                                        <div style={s.diagBody}>
                                            <div style={s.diagRow}>
                                                <span style={s.diagLabel}>Symptoms</span>
                                                <span style={s.diagValue}>{diag.symptoms}</span>
                                            </div>
                                            <div style={s.diagRow}>
                                                <span style={s.diagLabel}>Diagnosis</span>
                                                <span style={s.diagValue}>{diag.diagnosis_text}</span>
                                            </div>
                                            {diag.icd_code && (
                                                <div style={s.diagRow}>
                                                    <span style={s.diagLabel}>ICD Code</span>
                                                    <span style={s.diagValue}>{diag.icd_code}</span>
                                                </div>
                                            )}
                                            {diag.prescription && (
                                                <div style={s.diagRow}>
                                                    <span style={s.diagLabel}>Prescription</span>
                                                    <span style={s.diagValue}>{diag.prescription}</span>
                                                </div>
                                            )}
                                        </div>
                                        <button style={s.prognosisBtn}
                                            onClick={() => navigate(`/prognosis/${diag.id}`)}>
                                            View / Generate Prognosis
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* VITALS */}
                    {activeTab === 'vitals' && (
                        <div style={s.cardList}>
                            {canRecordVitals && (
                                <button style={s.addBtn}
                                    onClick={() => navigate(`/patients/${id}/vitals/new`)}>
                                    + Record Vitals
                                </button>
                            )}
                            {vitals.length === 0 ? (
                                <div style={s.emptyState}>No vitals recorded</div>
                            ) : (
                                vitals.map(v => (
                                    <div key={v.id} style={s.historyCard}>
                                        <div style={s.historyCardHeader}>
                                            <span style={s.historyDate}>{fmtDateTime(v.recorded_at)}</span>
                                        </div>
                                        <div style={s.vitalsGrid}>
                                            {v.temperature != null && <VitalItem label="Temperature" value={`${v.temperature} °C`} />}
                                            {v.heart_rate != null && <VitalItem label="Heart Rate" value={`${v.heart_rate} bpm`} />}
                                            {(v.blood_pressure_systolic != null || v.blood_pressure_diastolic != null) && (
                                                <VitalItem label="Blood Pressure" value={`${v.blood_pressure_systolic ?? '-'}/${v.blood_pressure_diastolic ?? '-'} mmHg`} />
                                            )}
                                            {v.respiratory_rate != null && <VitalItem label="Respiratory Rate" value={`${v.respiratory_rate} /min`} />}
                                            {v.oxygen_saturation != null && <VitalItem label="SpO2" value={`${v.oxygen_saturation}%`} />}
                                            {v.weight_kg != null && <VitalItem label="Weight" value={`${v.weight_kg} kg`} />}
                                            {v.height_cm != null && <VitalItem label="Height" value={`${v.height_cm} cm`} />}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                </div>
            </div>
        </div>
    )
}

function InfoItem({ label, value }) {
    return (
        <div style={s.infoItem}>
            <span style={s.infoLabel}>{label}</span>
            <span style={s.infoValue}>{value || '-'}</span>
        </div>
    )
}

function VitalItem({ label, value }) {
    return (
        <div style={s.vitalItem}>
            <span style={s.vitalLabel}>{label}</span>
            <span style={s.vitalValue}>{value}</span>
        </div>
    )
}

const s = {
    page: { maxWidth: '1000px', margin: '0 auto' },
    centerText: { textAlign: 'center', padding: '40px', color: '#718096' },

    pageHeader: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' },
    backBtn: {
        padding: '8px 16px', backgroundColor: '#e2e8f0',
        border: 'none', borderRadius: '6px', cursor: 'pointer',
        fontSize: '14px', color: '#4a5568', whiteSpace: 'nowrap'
    },
    patientName: { color: '#1a365d', margin: 0, fontSize: '24px' },

    infoCard: {
        backgroundColor: 'white', padding: '20px 24px',
        borderRadius: '12px', marginBottom: '20px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.07)'
    },
    infoGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' },
    infoItem: { display: 'flex', flexDirection: 'column', gap: '3px' },
    infoLabel: { fontSize: '11px', color: '#a0aec0', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' },
    infoValue: { fontSize: '14px', color: '#2d3748' },

    body: { display: 'flex', gap: '20px', alignItems: 'flex-start' },

    sectionNav: {
        width: '160px',
        flexShrink: 0,
        backgroundColor: 'white',
        borderRadius: '10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
        overflow: 'hidden',
        position: 'sticky',
        top: '24px'
    },
    navBtn: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        width: '100%', padding: '12px 16px',
        backgroundColor: 'transparent', border: 'none',
        borderBottom: '1px solid #f0f4f8',
        cursor: 'pointer', fontSize: '14px',
        color: '#4a5568', fontWeight: '500',
        textAlign: 'left'
    },
    navBtnActive: {
        backgroundColor: '#ebf4ff', color: '#2b6cb0',
        borderLeft: '3px solid #2b6cb0'
    },
    navCount: {
        fontSize: '12px', fontWeight: '700',
        backgroundColor: '#f0f4f8', color: '#718096',
        borderRadius: '10px', padding: '1px 7px'
    },
    navCountActive: { backgroundColor: '#bee3f8', color: '#2b6cb0' },

    content: { flex: 1, minWidth: 0 },
    cardList: { display: 'flex', flexDirection: 'column', gap: '12px' },

    historyCard: {
        backgroundColor: 'white', borderRadius: '10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden'
    },
    historyCardHeader: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 16px', backgroundColor: '#f7fafc',
        borderBottom: '1px solid #e2e8f0'
    },
    historyDate: { fontSize: '14px', fontWeight: '700', color: '#2d3748' },
    badge: {
        padding: '2px 10px', borderRadius: '12px',
        fontSize: '12px', fontWeight: '600'
    },
    historyNote: { padding: '10px 16px', margin: 0, fontSize: '13px', color: '#4a5568' },

    diagBody: { padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' },
    diagRow: { display: 'flex', gap: '12px', alignItems: 'flex-start' },
    diagLabel: { fontSize: '12px', color: '#a0aec0', fontWeight: '700', minWidth: '90px', paddingTop: '1px', textTransform: 'uppercase', letterSpacing: '0.03em' },
    diagValue: { fontSize: '13px', color: '#2d3748', flex: 1 },

    vitalsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', padding: '12px 16px' },
    vitalItem: { display: 'flex', flexDirection: 'column', gap: '2px' },
    vitalLabel: { fontSize: '11px', color: '#a0aec0', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' },
    vitalValue: { fontSize: '14px', color: '#2d3748', fontWeight: '600' },

    addBtn: {
        padding: '9px 18px', backgroundColor: '#2b6cb0',
        color: 'white', border: 'none', borderRadius: '6px',
        cursor: 'pointer', fontSize: '14px', alignSelf: 'flex-start',
        marginBottom: '4px'
    },
    prognosisBtn: {
        margin: '0 16px 12px', padding: '6px 14px',
        backgroundColor: '#805ad5', color: 'white',
        border: 'none', borderRadius: '4px',
        cursor: 'pointer', fontSize: '13px'
    },
    emptyState: {
        backgroundColor: 'white', borderRadius: '10px',
        padding: '32px', textAlign: 'center',
        color: '#a0aec0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
    }
}

export default PatientDetail
