import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import axiosInstance from '../api/axiosInstance'
import { useAuth } from '../context/AuthContext'

const fmtDate     = d => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
const fmtDateTime = d => new Date(d).toLocaleString('en-GB',     { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

const SECTION = {
    appointments: { accent: '#3b82f6', light: 'rgba(59,130,246,0.07)',  badge: 'rgba(59,130,246,0.12)',  badgeText: '#1d4ed8'  },
    diagnoses:    { accent: '#8b5cf6', light: 'rgba(139,92,246,0.07)',  badge: 'rgba(139,92,246,0.12)',  badgeText: '#6d28d9'  },
    vitals:       { accent: '#10b981', light: 'rgba(16,185,129,0.07)',  badge: 'rgba(16,185,129,0.12)',  badgeText: '#065f46'  },
    prognosis:    { accent: '#f59e0b', light: 'rgba(245,158,11,0.07)',  badge: 'rgba(245,158,11,0.12)',  badgeText: '#92400e'  }
}

const STATUS_COLOR = {
    completed: { bg: '#dcfce7', text: '#166534' },
    cancelled:  { bg: '#fee2e2', text: '#991b1b' },
    scheduled:  { bg: '#dbeafe', text: '#1e40af' }
}

const glass = {
    background: 'rgba(255,255,255,0.78)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.6)',
    borderRadius: '16px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.06)'
}

function PatientDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const { user } = useAuth()

    const activeTab = searchParams.get('tab') || 'appointments'
    const sec = SECTION[activeTab] || SECTION.appointments

    const [patient,      setPatient]      = useState(null)
    const [appointments, setAppointments] = useState([])
    const [diagnoses,    setDiagnoses]    = useState([])
    const [vitals,       setVitals]       = useState([])
    const [loading,      setLoading]      = useState(true)
    const [error,        setError]        = useState(null)
    const [sortOrder,    setSortOrder]    = useState('desc')

    // Edit patient state
    const [editMode,   setEditMode]   = useState(false)
    const [editData,   setEditData]   = useState({})
    const [editSaving, setEditSaving] = useState(false)
    const [editError,  setEditError]  = useState(null)

    const canEditPatient  = ['admin', 'receptionist'].includes(user?.role)
    const canRecordVitals = ['nurse', 'doctor'].includes(user?.role)
    const canSeeDiagnoses = ['doctor', 'nurse'].includes(user?.role)
    const canAddDiagnosis = user?.role === 'doctor'
    const canSeePrognosis = ['doctor', 'nurse'].includes(user?.role)

    const sortedBy = (arr, field) =>
        [...arr].sort((a, b) =>
            sortOrder === 'desc'
                ? new Date(b[field]) - new Date(a[field])
                : new Date(a[field]) - new Date(b[field])
        )

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

    const startEdit = () => {
        setEditData({
            full_name:     patient.full_name     || '',
            gender:        patient.gender        || '',
            phone:         patient.phone         || '',
            blood_group:   patient.blood_group   || '',
            address:       patient.address       || '',
            date_of_birth: patient.date_of_birth ? patient.date_of_birth.split('T')[0] : ''
        })
        setEditError(null)
        setEditMode(true)
    }

    const handleEditSave = async () => {
        setEditSaving(true)
        setEditError(null)
        try {
            const clean = {}
            Object.keys(editData).forEach(k => { clean[k] = editData[k] || null })
            clean.full_name = editData.full_name
            const res = await axiosInstance.patch(`/api/v1/patients/${id}`, clean)
            setPatient(res.data)
            setEditMode(false)
        } catch {
            setEditError('Failed to save changes')
        } finally {
            setEditSaving(false)
        }
    }

    const handleCompleteAppointment = async (aptId) => {
        try {
            const res = await axiosInstance.patch(`/api/v1/appointments/${aptId}`, { status: 'completed' })
            setAppointments(prev => prev.map(a => a.id === aptId ? res.data : a))
        } catch {
            alert('Failed to mark appointment as completed')
        }
    }

    if (loading) return <p style={s.centerText}>Loading...</p>
    if (error)   return <p style={{ ...s.centerText, color: '#ef4444' }}>{error}</p>
    if (!patient) return null

    return (
        <div style={s.page}>

            <div style={s.pageHeader}>
                <h2 style={s.patientName}>{patient.full_name}</h2>
                {canEditPatient && !editMode && (
                    <button style={s.editBtn} onClick={startEdit}>Edit Patient</button>
                )}
            </div>

            {/* Info card — view or edit mode */}
            <div style={s.infoCard}>
                {editMode ? (
                    <>
                        <div style={s.editGrid}>
                            <EditField label="Full Name"     value={editData.full_name}     onChange={v => setEditData(p => ({ ...p, full_name: v }))} />
                            <EditField label="Phone"         value={editData.phone}         onChange={v => setEditData(p => ({ ...p, phone: v }))} />
                            <EditField label="Date of Birth" value={editData.date_of_birth} onChange={v => setEditData(p => ({ ...p, date_of_birth: v }))} type="date" />
                            <EditSelect label="Gender" value={editData.gender} onChange={v => setEditData(p => ({ ...p, gender: v }))}
                                options={[['', 'Select'], ['male', 'Male'], ['female', 'Female'], ['other', 'Other']]} />
                            <EditSelect label="Blood Group" value={editData.blood_group} onChange={v => setEditData(p => ({ ...p, blood_group: v }))}
                                options={[['', 'Select'], ...['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(x => [x, x])]} />
                            <EditField label="Address" value={editData.address} onChange={v => setEditData(p => ({ ...p, address: v }))} />
                        </div>
                        {editError && <p style={{ color: '#ef4444', fontSize: '13px', margin: '8px 0 0' }}>{editError}</p>}
                        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                            <button style={s.saveBtn} onClick={handleEditSave} disabled={editSaving}>
                                {editSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                            <button style={s.cancelEditBtn} onClick={() => setEditMode(false)}>Cancel</button>
                        </div>
                    </>
                ) : (
                    <div style={s.infoGrid}>
                        <InfoItem label="Gender"        value={patient.gender} />
                        <InfoItem label="Blood Group"   value={patient.blood_group} />
                        <InfoItem label="Phone"         value={patient.phone} />
                        <InfoItem label="Date of Birth" value={patient.date_of_birth ? fmtDate(patient.date_of_birth) : null} />
                        <InfoItem label="Address"       value={patient.address} />
                        <InfoItem label="Registered"    value={fmtDate(patient.created_at)} />
                    </div>
                )}
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
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {apt.status === 'scheduled' && canAddDiagnosis && (
                                                    <button
                                                        style={s.completeBtn}
                                                        onClick={() => handleCompleteAppointment(apt.id)}
                                                    >
                                                        ✓ Complete
                                                    </button>
                                                )}
                                                <span style={{ ...s.statusBadge, backgroundColor: sc.bg, color: sc.text }}>
                                                    {apt.status}
                                                </span>
                                            </div>
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
                                        <span style={{ ...s.statusBadge, backgroundColor: sec.badge, color: sec.badgeText }}>Diagnosis</span>
                                    </div>
                                    <div style={s.diagBody}>
                                        <DiagRow label="Symptoms"     value={diag.symptoms} />
                                        <DiagRow label="Diagnosis"    value={diag.diagnosis_text} />
                                        {diag.icd_code     && <DiagRow label="ICD Code"    value={diag.icd_code} />}
                                        {diag.prescription && <DiagRow label="Prescription" value={diag.prescription} />}
                                        {diag.follow_up    && <DiagRow label="Follow Up"   value={diag.follow_up} />}
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
                                        <span style={{ ...s.statusBadge, backgroundColor: sec.badge, color: sec.badgeText }}>Vitals</span>
                                    </div>
                                    <div style={s.vitalsGrid}>
                                        {v.temperature              != null && <VitalItem label="Temperature"      value={`${v.temperature} °C`}                                                                  color={sec.accent} />}
                                        {v.heart_rate               != null && <VitalItem label="Heart Rate"       value={`${v.heart_rate} bpm`}                                                                  color={sec.accent} />}
                                        {(v.blood_pressure_systolic != null || v.blood_pressure_diastolic != null) && <VitalItem label="Blood Pressure" value={`${v.blood_pressure_systolic ?? '-'}/${v.blood_pressure_diastolic ?? '-'} mmHg`} color={sec.accent} />}
                                        {v.respiratory_rate         != null && <VitalItem label="Respiratory Rate" value={`${v.respiratory_rate} /min`}                                                           color={sec.accent} />}
                                        {v.oxygen_saturation        != null && <VitalItem label="SpO2"             value={`${v.oxygen_saturation}%`}                                                              color={sec.accent} />}
                                        {v.weight_kg                != null && <VitalItem label="Weight"           value={`${v.weight_kg} kg`}                                                                    color={sec.accent} />}
                                        {v.height_cm                != null && <VitalItem label="Height"           value={`${v.height_cm} cm`}                                                                    color={sec.accent} />}
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
                                <p style={{ ...s.hint, color: sec.accent }}>Select a diagnosis to view or generate an AI prognosis.</p>
                                {sortedBy(diagnoses, 'diagnosed_at').map(diag => (
                                    <div key={diag.id} style={{ ...s.card, borderLeft: `4px solid ${sec.accent}` }}>
                                        <div style={{ ...s.cardHead, background: sec.light }}>
                                            <span style={s.cardDate}>{fmtDate(diag.diagnosed_at)}</span>
                                            <span style={{ ...s.statusBadge, backgroundColor: sec.badge, color: sec.badgeText }}>AI Prognosis</span>
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

// ── Sub-components ───────────────────────────────────────────────

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
                    <button onClick={onToggleSort} style={{ ...s.sortBtn, borderColor: accent, color: accent }}>
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

function EditField({ label, value, onChange, type = 'text' }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={s.infoLabel}>{label}</span>
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                style={s.editInput}
            />
        </div>
    )
}

function EditSelect({ label, value, onChange, options }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={s.infoLabel}>{label}</span>
            <select value={value} onChange={e => onChange(e.target.value)} style={s.editInput}>
                {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
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

// ── Styles ───────────────────────────────────────────────────────

const s = {
    page:       { maxWidth: '920px', margin: '0 auto' },
    centerText: { textAlign: 'center', padding: '60px', color: '#94a3b8' },

    pageHeader: { marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '16px' },
    patientName:{ color: '#0f172a', margin: 0, fontSize: '26px', fontWeight: '700', flex: 1 },
    editBtn: {
        padding: '7px 16px', background: 'rgba(255,255,255,0.7)',
        border: '1.5px solid #e2e8f0', borderRadius: '8px',
        fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer'
    },

    infoCard:  { ...glass, padding: '20px 24px', marginBottom: '22px' },
    infoGrid:  { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '18px' },
    editGrid:  { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' },
    infoItem:  { display: 'flex', flexDirection: 'column', gap: '4px' },
    infoLabel: { fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' },
    infoValue: { fontSize: '14px', color: '#1e293b', fontWeight: '500' },
    editInput: {
        padding: '7px 10px', border: '1.5px solid #e2e8f0', borderRadius: '8px',
        fontSize: '13px', color: '#1e293b', background: 'white',
        outline: 'none', boxSizing: 'border-box', width: '100%'
    },
    saveBtn: {
        padding: '8px 20px', background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
        color: 'white', border: 'none', borderRadius: '8px',
        fontSize: '13px', fontWeight: '700', cursor: 'pointer'
    },
    cancelEditBtn: {
        padding: '8px 16px', background: 'transparent',
        border: '1.5px solid #e2e8f0', borderRadius: '8px',
        fontSize: '13px', fontWeight: '600', color: '#64748b', cursor: 'pointer'
    },

    content: { flex: 1 },

    sectionHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' },
    sectionAccentBar: { width: '4px', height: '22px', borderRadius: '2px', flexShrink: 0 },
    sectionTitle: { margin: 0, fontSize: '18px', fontWeight: '700' },
    sectionCount: { fontSize: '12px', fontWeight: '600', borderRadius: '20px', padding: '3px 10px', marginLeft: 'auto' },
    sortBtn: {
        padding: '4px 12px', background: 'transparent',
        border: '1.5px solid', borderRadius: '20px',
        cursor: 'pointer', fontSize: '12px', fontWeight: '600',
        marginLeft: '8px', whiteSpace: 'nowrap'
    },

    cardList: { display: 'flex', flexDirection: 'column', gap: '12px' },
    card:     { ...glass, overflow: 'hidden' },
    cardHead: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 16px'
    },
    cardDate:    { fontSize: '14px', fontWeight: '700', color: '#1e293b' },
    statusBadge: { padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
    completeBtn: {
        padding: '4px 10px', background: '#dcfce7', color: '#166534',
        border: '1px solid #bbf7d0', borderRadius: '6px',
        fontSize: '11px', fontWeight: '700', cursor: 'pointer'
    },
    cardNote: { padding: '10px 16px', margin: 0, fontSize: '13px', color: '#475569' },
    cardMeta: { padding: '8px 16px 12px', display: 'flex', gap: '8px', flexWrap: 'wrap' },
    metaChip: { fontSize: '12px', color: '#64748b', backgroundColor: '#f1f5f9', borderRadius: '6px', padding: '3px 10px' },

    diagBody: { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' },
    diagRow:  { display: 'flex', gap: '12px', alignItems: 'flex-start' },
    diagLabel: { fontSize: '11px', color: '#94a3b8', fontWeight: '700', minWidth: '92px', paddingTop: '2px', textTransform: 'uppercase', letterSpacing: '0.04em' },
    diagValue: { fontSize: '13px', color: '#334155', flex: 1, lineHeight: '1.55' },

    vitalsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', padding: '14px 16px' },
    vitalItem:  { display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px 0 4px' },
    vitalLabel: { fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' },
    vitalValue: { fontSize: '18px', fontWeight: '700' },

    addBtn: {
        padding: '9px 18px', color: 'white', border: 'none',
        borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
        fontWeight: '600', marginBottom: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
    },

    hint:           { fontSize: '13px', marginBottom: '14px', marginTop: 0, fontWeight: '500' },
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
    emptyDot: { width: '40px', height: '40px', borderRadius: '50%' }
}

export default PatientDetail
