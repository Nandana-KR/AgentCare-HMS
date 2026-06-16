import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import axiosInstance from '../api/axiosInstance'
import { useAuth } from '../context/AuthContext'

const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
const fmtDateTime = (d) => new Date(d).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

function PatientDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const { user } = useAuth()

    const activeTab = searchParams.get('tab') || 'appointments'

    const [patient, setPatient] = useState(null)
    const [appointments, setAppointments] = useState([])
    const [diagnoses, setDiagnoses] = useState([])
    const [vitals, setVitals] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const canRecordVitals = ['nurse', 'doctor'].includes(user?.role)
    const canSeeDiagnoses = ['doctor', 'nurse'].includes(user?.role)
    const canAddDiagnosis = user?.role === 'doctor'
    const canSeePrognosis = ['doctor', 'nurse'].includes(user?.role)

    useEffect(() => {
        setLoading(true)
        Promise.allSettled([
            axiosInstance.get(`/api/v1/patients/${id}`),
            axiosInstance.get(`/api/v1/appointments/patient/${id}`),
            axiosInstance.get(`/api/v1/diagnoses/patient/${id}`),
            axiosInstance.get(`/api/v1/vitals/patient/${id}`)
        ]).then(([p, a, d, v]) => {
            if (p.status === 'rejected') { setError('Failed to load patient'); return }
            setPatient(p.value.data)
            if (a.status === 'fulfilled') setAppointments(a.value.data)
            if (d.status === 'fulfilled') setDiagnoses(d.value.data)
            if (v.status === 'fulfilled') setVitals(v.value.data)
        }).finally(() => setLoading(false))
    }, [id])

    if (loading) return <p style={s.centerText}>Loading...</p>
    if (error) return <p style={{ ...s.centerText, color: '#e53e3e' }}>{error}</p>
    if (!patient) return <p style={{ ...s.centerText, color: '#e53e3e' }}>Patient not found</p>

    const statusColor = (st) => ({
        backgroundColor: st === 'completed' ? '#c6f6d5' : st === 'cancelled' ? '#fed7d7' : '#bee3f8',
        color: st === 'completed' ? '#276749' : st === 'cancelled' ? '#9b2c2c' : '#2b6cb0'
    })

    return (
        <div style={s.page}>

            {/* Patient name header */}
            <div style={s.pageHeader}>
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

            {/* Tab content — full width, tab selected via sidebar */}
            <div style={s.content}>

                {/* APPOINTMENTS */}
                {activeTab === 'appointments' && (
                    <Section title="Appointments" count={appointments.length}>
                        {appointments.length === 0 ? (
                            <EmptyState text="No appointments recorded" />
                        ) : (
                            appointments.map(apt => (
                                <div key={apt.id} style={s.historyCard}>
                                    <div style={s.cardHeader}>
                                        <span style={s.historyDate}>{fmtDateTime(apt.scheduled_at)}</span>
                                        <span style={{ ...s.badge, ...statusColor(apt.status) }}>
                                            {apt.status}
                                        </span>
                                    </div>
                                    {apt.notes && <p style={s.historyNote}>{apt.notes}</p>}
                                </div>
                            ))
                        )}
                    </Section>
                )}

                {/* DIAGNOSES */}
                {activeTab === 'diagnoses' && canSeeDiagnoses && (
                    <Section title="Diagnoses" count={diagnoses.length}>
                        {canAddDiagnosis && (
                            <button style={s.addBtn}
                                onClick={() => navigate(`/patients/${id}/diagnosis/new`)}>
                                + Add Diagnosis
                            </button>
                        )}
                        {diagnoses.length === 0 ? (
                            <EmptyState text="No diagnoses recorded" />
                        ) : (
                            diagnoses.map(diag => (
                                <div key={diag.id} style={s.historyCard}>
                                    <div style={s.cardHeader}>
                                        <span style={s.historyDate}>{fmtDate(diag.diagnosed_at)}</span>
                                    </div>
                                    <div style={s.diagBody}>
                                        <DiagRow label="Symptoms" value={diag.symptoms} />
                                        <DiagRow label="Diagnosis" value={diag.diagnosis_text} />
                                        {diag.icd_code && <DiagRow label="ICD Code" value={diag.icd_code} />}
                                        {diag.prescription && <DiagRow label="Prescription" value={diag.prescription} />}
                                        {diag.follow_up && <DiagRow label="Follow Up" value={diag.follow_up} />}
                                    </div>
                                </div>
                            ))
                        )}
                    </Section>
                )}

                {/* VITALS */}
                {activeTab === 'vitals' && (
                    <Section title="Vitals" count={vitals.length}>
                        {canRecordVitals && (
                            <button style={s.addBtn}
                                onClick={() => navigate(`/patients/${id}/vitals/new`)}>
                                + Record Vitals
                            </button>
                        )}
                        {vitals.length === 0 ? (
                            <EmptyState text="No vitals recorded" />
                        ) : (
                            vitals.map(v => (
                                <div key={v.id} style={s.historyCard}>
                                    <div style={s.cardHeader}>
                                        <span style={s.historyDate}>{fmtDateTime(v.recorded_at)}</span>
                                    </div>
                                    <div style={s.vitalsGrid}>
                                        {v.temperature != null && <VitalItem label="Temperature" value={`${v.temperature} °C`} />}
                                        {v.heart_rate != null && <VitalItem label="Heart Rate" value={`${v.heart_rate} bpm`} />}
                                        {(v.blood_pressure_systolic != null || v.blood_pressure_diastolic != null) && (
                                            <VitalItem label="Blood Pressure"
                                                value={`${v.blood_pressure_systolic ?? '-'}/${v.blood_pressure_diastolic ?? '-'} mmHg`} />
                                        )}
                                        {v.respiratory_rate != null && <VitalItem label="Respiratory Rate" value={`${v.respiratory_rate} /min`} />}
                                        {v.oxygen_saturation != null && <VitalItem label="SpO2" value={`${v.oxygen_saturation}%`} />}
                                        {v.weight_kg != null && <VitalItem label="Weight" value={`${v.weight_kg} kg`} />}
                                        {v.height_cm != null && <VitalItem label="Height" value={`${v.height_cm} cm`} />}
                                    </div>
                                </div>
                            ))
                        )}
                    </Section>
                )}

                {/* PROGNOSIS */}
                {activeTab === 'prognosis' && canSeePrognosis && (
                    <Section title="Prognosis" count={diagnoses.length}>
                        {diagnoses.length === 0 ? (
                            <EmptyState text="No diagnoses available — add a diagnosis before generating a prognosis" />
                        ) : (
                            <>
                                <p style={s.prognosisHint}>
                                    Select a diagnosis to view or generate an AI prognosis.
                                </p>
                                {diagnoses.map(diag => (
                                    <div key={diag.id} style={s.prognosisCard}>
                                        <div style={s.cardHeader}>
                                            <span style={s.historyDate}>{fmtDate(diag.diagnosed_at)}</span>
                                        </div>
                                        <div style={s.diagBody}>
                                            <DiagRow label="Diagnosis" value={diag.diagnosis_text} />
                                            <DiagRow label="Symptoms" value={diag.symptoms} />
                                        </div>
                                        <div style={s.prognosisActions}>
                                            <button
                                                style={s.generateBtn}
                                                onClick={() => navigate(`/prognosis/${diag.id}`)}
                                            >
                                                View / Generate Prognosis
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                    </Section>
                )}

            </div>
        </div>
    )
}

function Section({ title, count, children }) {
    return (
        <div>
            <div style={s.sectionHeader}>
                <h3 style={s.sectionTitle}>{title}</h3>
                <span style={s.sectionCount}>{count} record{count !== 1 ? 's' : ''}</span>
            </div>
            <div style={s.cardList}>{children}</div>
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

function DiagRow({ label, value }) {
    return (
        <div style={s.diagRow}>
            <span style={s.diagLabel}>{label}</span>
            <span style={s.diagValue}>{value}</span>
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

function EmptyState({ text }) {
    return <div style={s.emptyState}>{text}</div>
}

const s = {
    page: { maxWidth: '900px', margin: '0 auto' },
    centerText: { textAlign: 'center', padding: '40px', color: '#718096' },

    pageHeader: { marginBottom: '16px' },
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

    content: { flex: 1 },
    sectionHeader: {
        display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '14px'
    },
    sectionTitle: { color: '#1a365d', margin: 0, fontSize: '18px' },
    sectionCount: { fontSize: '13px', color: '#a0aec0' },

    cardList: { display: 'flex', flexDirection: 'column', gap: '12px' },

    historyCard: {
        backgroundColor: 'white', borderRadius: '10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden'
    },
    prognosisCard: {
        backgroundColor: 'white', borderRadius: '10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden',
        borderLeft: '4px solid #805ad5'
    },
    cardHeader: {
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
    diagLabel: {
        fontSize: '11px', color: '#a0aec0', fontWeight: '700',
        minWidth: '90px', paddingTop: '2px',
        textTransform: 'uppercase', letterSpacing: '0.03em'
    },
    diagValue: { fontSize: '13px', color: '#2d3748', flex: 1, lineHeight: '1.5' },

    vitalsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', padding: '12px 16px' },
    vitalItem: { display: 'flex', flexDirection: 'column', gap: '2px' },
    vitalLabel: { fontSize: '11px', color: '#a0aec0', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' },
    vitalValue: { fontSize: '15px', color: '#2d3748', fontWeight: '600' },

    addBtn: {
        padding: '9px 18px', backgroundColor: '#2b6cb0',
        color: 'white', border: 'none', borderRadius: '6px',
        cursor: 'pointer', fontSize: '14px', marginBottom: '12px',
        display: 'inline-block'
    },
    prognosisHint: { color: '#718096', fontSize: '13px', marginBottom: '12px', marginTop: 0 },
    prognosisActions: { padding: '0 16px 12px' },
    generateBtn: {
        padding: '8px 16px', backgroundColor: '#805ad5',
        color: 'white', border: 'none', borderRadius: '6px',
        cursor: 'pointer', fontSize: '13px', fontWeight: '600'
    },
    emptyState: {
        backgroundColor: 'white', borderRadius: '10px',
        padding: '32px', textAlign: 'center',
        color: '#a0aec0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        fontSize: '14px'
    }
}

export default PatientDetail
