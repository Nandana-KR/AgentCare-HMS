import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import axiosInstance from '../api/axiosInstance'
import { useAuth } from '../context/AuthContext'

const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
const fmtDateTime = (d) => new Date(d).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

const SECTION = {
    appointments: { accent: '#3b82f6', light: 'rgba(59,130,246,0.07)',  badge: 'rgba(59,130,246,0.12)',  badgeText: '#1d4ed8',  border: 'rgba(59,130,246,0.18)'  },
    diagnoses:    { accent: '#8b5cf6', light: 'rgba(139,92,246,0.07)',  badge: 'rgba(139,92,246,0.12)',  badgeText: '#6d28d9',  border: 'rgba(139,92,246,0.18)'  },
    vitals:       { accent: '#10b981', light: 'rgba(16,185,129,0.07)',  badge: 'rgba(16,185,129,0.12)',  badgeText: '#065f46',  border: 'rgba(16,185,129,0.18)'  },
    prognosis:    { accent: '#f59e0b', light: 'rgba(245,158,11,0.07)',  badge: 'rgba(245,158,11,0.12)',  badgeText: '#92400e',  border: 'rgba(245,158,11,0.18)'  }
}

const STATUS_COLOR = {
    completed:  { bg: '#dcfce7', text: '#166534' },
    cancelled:  { bg: '#fee2e2', text: '#991b1b' },
    scheduled:  { bg: '#dbeafe', text: '#1e40af' }
}

function PatientDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const { user } = useAuth()

    const activeTab = searchParams.get('tab') || 'appointments'
    const sec = SECTION[activeTab] || SECTION.appointments

    const [patient, setPatient] = useState(null)
    const [appointments, setAppointments] = useState([])
    const [diagnoses, setDiagnoses] = useState([])
    const [vitals, setVitals] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [sortOrder, setSortOrder] = useState('desc')

    const sortedBy = (arr, field) =>
        [...arr].sort((a, b) =>
            sortOrder === 'desc'
                ? new Date(b[field]) - new Date(a[field])
                : new Date(a[field]) - new Date(b[field])
        )

    const canRecordVitals  = ['nurse', 'doctor'].includes(user?.role)
    const canSeeDiagnoses  = ['doctor', 'nurse'].includes(user?.role)
    const canAddDiagnosis  = user?.role === 'doctor'
    const canSeePrognosis  = ['doctor', 'nurse'].includes(user?.role)

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
    if (error)   return <p style={{ ...s.centerText, color: '#ef4444' }}>{error}</p>
    if (!patient) return null

    return (
        <div style={s.page}>

            {/* Patient name + meta */}
            <div style={s.pageHeader}>
                <h2 style={s.patientName}>{patient.full_name}</h2>
            </div>

            {/* Info card */}
            <div style={s.infoCard}>
                <div style={s.infoGrid}>
                    <InfoItem label="Gender"       value={patient.gender} />
                    <InfoItem label="Blood Group"  value={patient.blood_group} />
                    <InfoItem label="Phone"        value={patient.phone} />
                    <InfoItem label="Date of Birth" value={patient.date_of_birth ? fmtDate(patient.date_of_birth) : null} />
                    <InfoItem label="Address"      value={patient.address} />
                    <InfoItem label="Registered"   value={fmtDate(patient.created_at)} />
                </div>
            </div>

            {/* Section content */}
            <div style={s.content}>

                {/* APPOINTMENTS */}
                {activeTab === 'appointments' && (
                    <Section title="Appointments" count={appointments.length} accent={sec.accent} sortOrder={sortOrder} onToggleSort={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}>
                        <button style={{ ...s.addBtn, backgroundColor: sec.accent }}
                            onClick={() => navigate(`/appointments/new?patient=${id}`)}>
                            + Book Appointment
                        </button>
                        {appointments.length === 0 ? <EmptyState text="No appointments recorded" color={sec.accent} /> : (
                            sortedBy(appointments, 'scheduled_at').map(apt => {
                                const sc = STATUS_COLOR[apt.status] || STATUS_COLOR.scheduled
                                return (
                                    <div key={apt.id} style={{ ...s.card, borderLeft: `4px solid ${sec.accent}` }}>
                                        <div style={{ ...s.cardHead, background: sec.light }}>
                                            <span style={s.cardDate}>{fmtDateTime(apt.scheduled_at)}</span>
                                            <span style={{ ...s.statusBadge, backgroundColor: sc.bg, color: sc.text }}>
                                                {apt.status}
                                            </span>
                                        </div>
                                        {apt.notes && <p style={s.cardNote}>{apt.notes}</p>}
                                        <div style={s.cardMeta}>
                                            <span style={s.metaChip}>Doctor: {apt.doctor_name}</span>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </Section>
                )}

                {/* DIAGNOSES */}
                {activeTab === 'diagnoses' && canSeeDiagnoses && (
                    <Section title="Diagnoses" count={diagnoses.length} accent={sec.accent} sortOrder={sortOrder} onToggleSort={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}>
                        {canAddDiagnosis && (
                            <button style={{ ...s.addBtn, backgroundColor: sec.accent }}
                                onClick={() => navigate(`/patients/${id}/diagnosis/new`)}>
                                + Add Diagnosis
                            </button>
                        )}
                        {diagnoses.length === 0 ? <EmptyState text="No diagnoses recorded" color={sec.accent} /> : (
                            sortedBy(diagnoses, 'diagnosed_at').map(diag => (
                                <div key={diag.id} style={{ ...s.card, borderLeft: `4px solid ${sec.accent}` }}>
                                    <div style={{ ...s.cardHead, background: sec.light }}>
                                        <span style={s.cardDate}>{fmtDate(diag.diagnosed_at)}</span>
                                        <span style={{ ...s.statusBadge, backgroundColor: sec.badge, color: sec.badgeText }}>
                                            Diagnosis
                                        </span>
                                    </div>
                                    <div style={s.diagBody}>
                                        <DiagRow label="Symptoms"    value={diag.symptoms} />
                                        <DiagRow label="Diagnosis"   value={diag.diagnosis_text} />
                                        {diag.icd_code    && <DiagRow label="ICD Code"    value={diag.icd_code} />}
                                        {diag.prescription && <DiagRow label="Prescription" value={diag.prescription} />}
                                        {diag.follow_up   && <DiagRow label="Follow Up"   value={diag.follow_up} />}
                                    </div>
                                </div>
                            ))
                        )}
                    </Section>
                )}

                {/* VITALS */}
                {activeTab === 'vitals' && (
                    <Section title="Vitals" count={vitals.length} accent={sec.accent} sortOrder={sortOrder} onToggleSort={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}>
                        {canRecordVitals && (
                            <button style={{ ...s.addBtn, backgroundColor: sec.accent }}
                                onClick={() => navigate(`/patients/${id}/vitals/new`)}>
                                + Record Vitals
                            </button>
                        )}
                        {vitals.length === 0 ? <EmptyState text="No vitals recorded" color={sec.accent} /> : (
                            sortedBy(vitals, 'recorded_at').map(v => (
                                <div key={v.id} style={{ ...s.card, borderLeft: `4px solid ${sec.accent}` }}>
                                    <div style={{ ...s.cardHead, background: sec.light }}>
                                        <span style={s.cardDate}>{fmtDateTime(v.recorded_at)}</span>
                                        <span style={{ ...s.statusBadge, backgroundColor: sec.badge, color: sec.badgeText }}>
                                            Vitals
                                        </span>
                                    </div>
                                    <div style={s.vitalsGrid}>
                                        {v.temperature           != null && <VitalItem label="Temperature"      value={`${v.temperature} °C`} color={sec.accent} />}
                                        {v.heart_rate            != null && <VitalItem label="Heart Rate"       value={`${v.heart_rate} bpm`} color={sec.accent} />}
                                        {(v.blood_pressure_systolic != null || v.blood_pressure_diastolic != null) && (
                                            <VitalItem label="Blood Pressure" value={`${v.blood_pressure_systolic ?? '-'}/${v.blood_pressure_diastolic ?? '-'} mmHg`} color={sec.accent} />
                                        )}
                                        {v.respiratory_rate      != null && <VitalItem label="Respiratory Rate" value={`${v.respiratory_rate} /min`} color={sec.accent} />}
                                        {v.oxygen_saturation     != null && <VitalItem label="SpO2"             value={`${v.oxygen_saturation}%`} color={sec.accent} />}
                                        {v.weight_kg             != null && <VitalItem label="Weight"           value={`${v.weight_kg} kg`} color={sec.accent} />}
                                        {v.height_cm             != null && <VitalItem label="Height"           value={`${v.height_cm} cm`} color={sec.accent} />}
                                    </div>
                                </div>
                            ))
                        )}
                    </Section>
                )}

                {/* PROGNOSIS */}
                {activeTab === 'prognosis' && canSeePrognosis && (
                    <Section title="Prognosis" count={diagnoses.length} accent={sec.accent} sortOrder={sortOrder} onToggleSort={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}>
                        {diagnoses.length === 0 ? (
                            <EmptyState text="No diagnoses available — add a diagnosis first" color={sec.accent} />
                        ) : (
                            <>
                                <p style={{ ...s.hint, color: sec.accent }}>
                                    Select a diagnosis to view or generate an AI prognosis.
                                </p>
                                {sortedBy(diagnoses, 'diagnosed_at').map(diag => (
                                    <div key={diag.id} style={{ ...s.card, borderLeft: `4px solid ${sec.accent}` }}>
                                        <div style={{ ...s.cardHead, background: sec.light }}>
                                            <span style={s.cardDate}>{fmtDate(diag.diagnosed_at)}</span>
                                            <span style={{ ...s.statusBadge, backgroundColor: sec.badge, color: sec.badgeText }}>
                                                AI Prognosis
                                            </span>
                                        </div>
                                        <div style={s.diagBody}>
                                            <DiagRow label="Diagnosis" value={diag.diagnosis_text} />
                                            <DiagRow label="Symptoms"  value={diag.symptoms} />
                                        </div>
                                        <div style={s.prognosisActions}>
                                            <button
                                                style={{ ...s.prognosisBtn, backgroundColor: sec.accent }}
                                                onClick={() => navigate(`/prognosis/${diag.id}`)}
                                            >
                                                {canAddDiagnosis ? 'View / Generate Prognosis' : 'View Prognosis'}
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

function Section({ title, count, accent, sortOrder, onToggleSort, children }) {
    return (
        <div>
            <div style={s.sectionHeader}>
                <div style={{ ...s.sectionAccentBar, backgroundColor: accent }} />
                <h3 style={{ ...s.sectionTitle, color: accent }}>{title}</h3>
                <span style={{ ...s.sectionCount, backgroundColor: `${accent}18`, color: accent }}>
                    {count} record{count !== 1 ? 's' : ''}
                </span>
                {count > 1 && (
                    <button
                        onClick={onToggleSort}
                        style={{ ...s.sortBtn, borderColor: accent, color: accent }}
                    >
                        {sortOrder === 'desc' ? '↓ Newest First' : '↑ Oldest First'}
                    </button>
                )}
            </div>
            <div style={s.cardList}>{children}</div>
        </div>
    )
}

function InfoItem({ label, value }) {
    return (
        <div style={s.infoItem}>
            <span style={s.infoLabel}>{label}</span>
            <span style={s.infoValue}>{value || '—'}</span>
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

function VitalItem({ label, value, color }) {
    return (
        <div style={{ ...s.vitalItem, borderTop: `2px solid ${color}20` }}>
            <span style={s.vitalLabel}>{label}</span>
            <span style={{ ...s.vitalValue, color }}>{value}</span>
        </div>
    )
}

function EmptyState({ text, color }) {
    return (
        <div style={{ ...s.emptyState, borderColor: `${color}25` }}>
            <div style={{ ...s.emptyDot, backgroundColor: `${color}20` }} />
            <p style={{ color: '#94a3b8', margin: 0, fontSize: '14px' }}>{text}</p>
        </div>
    )
}

const glass = {
    background: 'rgba(255,255,255,0.78)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.6)',
    borderRadius: '16px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.06)'
}

const s = {
    page:         { maxWidth: '920px', margin: '0 auto' },
    centerText:   { textAlign: 'center', padding: '60px', color: '#94a3b8' },
    pageHeader:   { marginBottom: '16px' },
    patientName:  { color: '#0f172a', margin: 0, fontSize: '26px', fontWeight: '700' },

    infoCard: {
        ...glass,
        padding: '20px 24px',
        marginBottom: '22px'
    },
    infoGrid:  { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '18px' },
    infoItem:  { display: 'flex', flexDirection: 'column', gap: '4px' },
    infoLabel: { fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' },
    infoValue: { fontSize: '14px', color: '#1e293b', fontWeight: '500' },

    content:   { flex: 1 },

    sectionHeader: {
        display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px'
    },
    sectionAccentBar: {
        width: '4px', height: '22px', borderRadius: '2px', flexShrink: 0
    },
    sectionTitle: { margin: 0, fontSize: '18px', fontWeight: '700' },
    sectionCount: {
        fontSize: '12px', fontWeight: '600', borderRadius: '20px',
        padding: '3px 10px', marginLeft: 'auto'
    },
    sortBtn: {
        padding: '4px 12px', background: 'transparent',
        border: '1.5px solid', borderRadius: '20px',
        cursor: 'pointer', fontSize: '12px', fontWeight: '600',
        marginLeft: '8px', whiteSpace: 'nowrap'
    },

    cardList: { display: 'flex', flexDirection: 'column', gap: '12px' },

    card: {
        ...glass,
        overflow: 'hidden'
    },
    cardHead: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 16px'
    },
    cardDate: { fontSize: '14px', fontWeight: '700', color: '#1e293b' },
    statusBadge: {
        padding: '3px 10px', borderRadius: '20px',
        fontSize: '12px', fontWeight: '600'
    },
    cardNote: { padding: '10px 16px', margin: 0, fontSize: '13px', color: '#475569' },
    cardMeta: { padding: '8px 16px 12px', display: 'flex', gap: '8px', flexWrap: 'wrap' },
    metaChip: {
        fontSize: '12px', color: '#64748b', backgroundColor: '#f1f5f9',
        borderRadius: '6px', padding: '3px 10px'
    },

    diagBody: { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' },
    diagRow:  { display: 'flex', gap: '12px', alignItems: 'flex-start' },
    diagLabel: {
        fontSize: '11px', color: '#94a3b8', fontWeight: '700',
        minWidth: '92px', paddingTop: '2px',
        textTransform: 'uppercase', letterSpacing: '0.04em'
    },
    diagValue: { fontSize: '13px', color: '#334155', flex: 1, lineHeight: '1.55' },

    vitalsGrid: {
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px', padding: '14px 16px'
    },
    vitalItem: {
        display: 'flex', flexDirection: 'column', gap: '4px',
        padding: '10px 0 4px', borderRadius: '0'
    },
    vitalLabel: { fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' },
    vitalValue: { fontSize: '18px', fontWeight: '700' },

    addBtn: {
        padding: '9px 18px', color: 'white', border: 'none',
        borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
        fontWeight: '600', marginBottom: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
    },

    hint: { fontSize: '13px', marginBottom: '14px', marginTop: 0, fontWeight: '500' },

    prognosisActions: { padding: '0 16px 14px' },
    prognosisBtn: {
        padding: '9px 18px', color: 'white', border: 'none',
        borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
    },

    emptyState: {
        ...glass,
        padding: '36px', textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
        border: '1.5px dashed'
    },
    emptyDot: {
        width: '40px', height: '40px', borderRadius: '50%'
    }
}

export default PatientDetail
