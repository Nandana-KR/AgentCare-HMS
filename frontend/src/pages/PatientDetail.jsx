import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import axiosInstance from '../api/axiosInstance'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/ConfirmModal'
import { glass } from '../styles/glass'

const fmtDate     = d => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
const fmtDateTime = d => new Date(d).toLocaleString('en-GB',     { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

const SECTION = {
    appointments: { accent: '#3b82f6', label: 'Appointments' },
    diagnoses:    { accent: '#8b5cf6', label: 'Diagnoses' },
    vitals:       { accent: '#10b981', label: 'Vitals' },
    prognosis:    { accent: '#14b8a6', label: 'Prognosis' }
}

const STATUS_COLOR = {
    completed: { bg: '#dcfce7', text: '#166534' },
    cancelled:  { bg: '#fee2e2', text: '#991b1b' },
    scheduled:  { bg: '#dbeafe', text: '#1e40af' }
}

const PAGE_SIZE = 5

function usePaged(items, sortField, defaultDir = 'desc') {
    const [page,    setPage]    = useState(1)
    const [sortDir, setSortDir] = useState(defaultDir)

    const sorted = useMemo(() =>
        [...items].sort((a, b) => sortDir === 'desc'
            ? new Date(b[sortField]) - new Date(a[sortField])
            : new Date(a[sortField]) - new Date(b[sortField])
        )
    , [items, sortDir, sortField])

    const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
    const paginated  = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

    return { paginated, sorted, page, setPage, sortDir, setSortDir, totalPages }
}

function PatientDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const { user } = useAuth()

    const activeTab = searchParams.get('tab') || 'appointments'
    const sec = SECTION[activeTab] || SECTION.appointments

    const [patient,      setPatient]      = useState(null)
    const [appointments, setAppointments] = useState([])
    const [diagnoses,    setDiagnoses]    = useState([])
    const [vitals,       setVitals]       = useState([])
    const [loading,      setLoading]      = useState(true)
    const [error,        setError]        = useState(null)
    const toast = useToast()
    const confirm = useConfirm()

    const [editMode,   setEditMode]   = useState(false)
    const [editData,   setEditData]   = useState({})
    const [editSaving, setEditSaving] = useState(false)
    const [editError,  setEditError]  = useState(null)

    const canEditPatient  = ['admin', 'receptionist'].includes(user?.role)
    const canRecordVitals = ['nurse', 'doctor'].includes(user?.role)
    const canSeeDiagnoses = ['doctor', 'nurse'].includes(user?.role)
    const canAddDiagnosis = user?.role === 'doctor'
    const canSeePrognosis = ['doctor', 'nurse'].includes(user?.role)

    const apptPaged  = usePaged(appointments, 'scheduled_at')
    const diagPaged  = usePaged(diagnoses,    'diagnosed_at')
    const vitalPaged = usePaged(vitals,       'recorded_at')

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
            allergies:     patient.allergies     || '',
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
            toast('Patient details updated', 'success')
        } catch {
            setEditError('Failed to save changes')
        } finally {
            setEditSaving(false)
        }
    }

    const handleCompleteAppointment = async aptId => {
        try {
            const res = await axiosInstance.patch(`/api/v1/appointments/${aptId}`, { status: 'completed' })
            setAppointments(prev => prev.map(a => a.id === aptId ? res.data : a))
            toast('Appointment marked complete', 'success')
        } catch {
            toast('Failed to mark appointment as completed', 'error')
        }
    }

    const setTab = tab => setSearchParams({ tab })

    if (loading) return <p style={s.centerText}>Loading...</p>
    if (error)   return <p style={{ ...s.centerText, color: '#ef4444' }}>{error}</p>
    if (!patient) return null

    return (
        <div style={s.page}>

            {/* Patient header */}
            <div style={s.pageHeader}>
                <h2 style={s.patientName}>{patient.full_name}</h2>
                {canEditPatient && !editMode && (
                    <button style={s.editBtn} onClick={startEdit}>Edit Patient</button>
                )}
            </div>

            {/* Info card */}
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
                            <EditField label="Allergies" value={editData.allergies} onChange={v => setEditData(p => ({ ...p, allergies: v }))} />
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
                        <InfoItem label="Age" value={patient.date_of_birth ? `${Math.floor((new Date() - new Date(patient.date_of_birth)) / (365.25 * 86400000))} years` : null} />
                        <InfoItem label="Allergies"     value={patient.allergies} />
                        <InfoItem label="Address"       value={patient.address} />
                        <InfoItem label="Registered"    value={fmtDate(patient.created_at)} />
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div style={s.tabs}>
                {Object.entries(SECTION).map(([key, { accent, label }]) => (
                    <button key={key}
                        style={{ ...s.tab, ...(activeTab === key ? { ...s.tabActive, borderBottomColor: accent, color: accent } : {}) }}
                        onClick={() => setTab(key)}>
                        {label}
                        <span style={{ ...s.tabBadge, background: activeTab === key ? `${accent}18` : '#f1f5f9', color: activeTab === key ? accent : '#94a3b8' }}>
                            {key === 'appointments' ? appointments.length
                                : key === 'diagnoses' ? diagnoses.length
                                : key === 'vitals'    ? vitals.length
                                : diagnoses.length}
                        </span>
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div style={s.content}>

                {/* APPOINTMENTS */}
                {activeTab === 'appointments' && (
                    <TableSection
                        accent={sec.accent}
                        addBtn={<button style={{ ...s.addBtn, background: sec.accent }} onClick={() => navigate(`/appointments/new?patient=${id}`)}>+ Book Appointment</button>}
                        paged={apptPaged}
                        sortLabel="Date"
                        headers={['Date & Time', 'Doctor', 'Status', 'Notes', 'Action']}
                        empty="No appointments recorded"
                        rows={apptPaged.paginated.map(apt => {
                            const sc = STATUS_COLOR[apt.status] || STATUS_COLOR.scheduled
                            return (
                                <tr key={apt.id} style={s.row}>
                                    <td style={s.td}>{fmtDateTime(apt.scheduled_at)}</td>
                                    <td style={{ ...s.td, color: '#475569' }}>{apt.doctor_name}</td>
                                    <td style={s.td}>
                                        <span style={{ ...s.badge, background: sc.bg, color: sc.text }}>{apt.status}</span>
                                    </td>
                                    <td style={{ ...s.td, color: '#64748b', maxWidth: '180px' }}>
                                        <span style={s.clip}>{apt.notes || '—'}</span>
                                    </td>
                                    <td style={s.td}>
                                        {apt.status === 'scheduled' && (
                                            <button style={s.completeBtn} onClick={() => handleCompleteAppointment(apt.id)}>✓ Complete</button>
                                        )}
                                        {apt.status === 'scheduled' && (
                                            <button style={{ ...s.completeBtn, background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }}
                                                onClick={async () => {
                                                    if (!await confirm('Are you sure you want to cancel this appointment?')) return
                                                    try {
                                                        await axiosInstance.delete(`/api/v1/appointments/${apt.id}`)
                                                        setAppointments(prev => prev.map(a => a.id === apt.id ? { ...a, status: 'cancelled' } : a))
                                                        toast('Appointment cancelled', 'success')
                                                    } catch { toast('Failed to cancel', 'error') }
                                                }}>
                                                Cancel
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                    />
                )}

                {/* DIAGNOSES */}
                {activeTab === 'diagnoses' && canSeeDiagnoses && (
                    <TableSection
                        accent={sec.accent}
                        addBtn={canAddDiagnosis && (
                            <button style={{ ...s.addBtn, background: sec.accent }} onClick={() => navigate(`/patients/${id}/diagnosis/new`)}>+ Add Diagnosis</button>
                        )}
                        paged={diagPaged}
                        sortLabel="Date"
                        headers={['Date', 'Symptoms', 'Diagnosis', 'ICD Code', 'Prescription', 'Follow Up', '']}
                        empty="No diagnoses recorded"
                        rows={diagPaged.paginated.map(diag => (
                            <tr key={diag.id} style={s.row}>
                                <td style={{ ...s.td, whiteSpace: 'nowrap' }}>{fmtDate(diag.diagnosed_at)}</td>
                                <td style={{ ...s.td, fontSize: '13px' }}>{diag.symptoms}</td>
                                <td style={{ ...s.td, fontSize: '13px' }}>
                                    {diag.diagnosis_text === 'Pending AI analysis'
                                        ? <span style={{ fontSize: '11px', fontWeight: '700', color: '#854d0e', background: '#fef9c3', borderRadius: '6px', padding: '2px 8px' }}>Pending</span>
                                        : diag.diagnosis_text}
                                </td>
                                <td style={{ ...s.td, color: '#64748b' }}>{diag.icd_code || '—'}</td>
                                <td style={{ ...s.td, fontSize: '13px' }}>{diag.prescription || '—'}</td>
                                <td style={{ ...s.td, fontSize: '13px' }}>{diag.follow_up || '—'}</td>
                                <td style={s.td}>
                                    <button style={{ padding: '4px 12px', fontSize: '12px', fontWeight: '600', color: '#6d28d9', background: 'rgba(139,92,246,0.1)', border: '1.5px solid rgba(139,92,246,0.2)', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                        onClick={() => navigate(`/patients/${id}/diagnosis/${diag.id}`)}>
                                        View
                                    </button>
                                </td>
                            </tr>
                        ))}
                    />
                )}

                {/* VITALS */}
                {activeTab === 'vitals' && (
                    <TableSection
                        accent={sec.accent}
                        addBtn={canRecordVitals && (
                            <button style={{ ...s.addBtn, background: sec.accent }} onClick={() => navigate(`/patients/${id}/vitals/new`)}>+ Record Vitals</button>
                        )}
                        paged={vitalPaged}
                        sortLabel="Date"
                        headers={['Date & Time', 'Temp (°C)', 'HR (bpm)', 'BP (mmHg)', 'RR (/min)', 'SpO₂ (%)', 'Weight (kg)', 'Height (cm)']}
                        empty="No vitals recorded"
                        rows={vitalPaged.paginated.map(v => (
                            <tr key={v.id} style={s.row}>
                                <td style={{ ...s.td, whiteSpace: 'nowrap' }}>{fmtDateTime(v.recorded_at)}</td>
                                <td style={s.td}>{v.temperature         ?? '—'}</td>
                                <td style={s.td}>{v.heart_rate          ?? '—'}</td>
                                <td style={s.td}>
                                    {v.blood_pressure_systolic != null || v.blood_pressure_diastolic != null
                                        ? `${v.blood_pressure_systolic ?? '-'}/${v.blood_pressure_diastolic ?? '-'}`
                                        : '—'}
                                </td>
                                <td style={s.td}>{v.respiratory_rate    ?? '—'}</td>
                                <td style={s.td}>{v.oxygen_saturation   ?? '—'}</td>
                                <td style={s.td}>{v.weight_kg           ?? '—'}</td>
                                <td style={s.td}>{v.height_cm           ?? '—'}</td>
                            </tr>
                        ))}
                    />
                )}

                {/* PROGNOSIS */}
                {activeTab === 'prognosis' && canSeePrognosis && (
                    <div>
                        {diagnoses.length === 0 ? (
                            <div style={{ ...glass, padding: '40px', textAlign: 'center', color: '#94a3b8', marginTop: '16px' }}>
                                No diagnoses available — add a diagnosis first
                            </div>
                        ) : (
                            <>
                                <TableSection
                                    accent={sec.accent}
                                    paged={diagPaged}
                                    sortLabel="Date"
                                    headers={['Date', 'Diagnosis', 'Symptoms', 'Action']}
                                    empty="No diagnoses"
                                    rows={diagPaged.paginated.map(diag => (
                                        <tr key={diag.id} style={s.row}>
                                            <td style={{ ...s.td, whiteSpace: 'nowrap' }}>{fmtDate(diag.diagnosed_at)}</td>
                                            <td style={{ ...s.td, fontSize: '13px' }}>{diag.diagnosis_text}</td>
                                            <td style={{ ...s.td, fontSize: '13px' }}>{diag.symptoms}</td>
                                            <td style={s.td}>
                                                <button
                                                    style={{ ...s.progBtn, background: sec.accent }}
                                                    onClick={() => navigate(`/prognosis/${diag.id}`)}>
                                                    {canAddDiagnosis ? 'View / Generate' : 'View Prognosis'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                />
                                <p style={{ color: '#94a3b8', fontSize: '14px', margin: '14px 0 0', fontStyle: 'italic' }}>
                                    Note: Prognosis can be generated after a diagnosis is completed.
                                </p>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

// ── Table Section ─────────────────────────────────────────────────

function TableSection({ accent, addBtn, paged, sortLabel, headers, empty, rows }) {
    const { page, setPage, sortDir, setSortDir, totalPages } = paged
    return (
        <div>
            {addBtn && <div style={{ marginBottom: '12px' }}>{addBtn}</div>}
            <div style={{ ...glass, overflow: 'hidden' }}>
                <table style={s.table}>
                    <thead>
                        <tr style={{ background: 'linear-gradient(135deg, #0f172a, #1e3a8a)' }}>
                            {headers.map((h, i) => (
                                <th key={h}
                                    style={{ ...s.th, cursor: i === 0 ? 'pointer' : 'default', userSelect: 'none' }}
                                    onClick={i === 0 ? () => setSortDir(d => d === 'desc' ? 'asc' : 'desc') : undefined}>
                                    {h}{i === 0 ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr><td colSpan={headers.length} style={s.empty}>{empty}</td></tr>
                        ) : rows}
                    </tbody>
                </table>
            </div>
            {totalPages > 1 && (
                <div style={s.pagination}>
                    <button style={{ ...s.pageBtn, ...(page === 1 ? s.pageBtnOff : {}), borderColor: accent, color: page === 1 ? '#94a3b8' : accent }}
                        disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                        ← Prev
                    </button>
                    <span style={s.pageInfo}>Page {page} of {totalPages}</span>
                    <button style={{ ...s.pageBtn, ...(page === totalPages ? s.pageBtnOff : {}), borderColor: accent, color: page === totalPages ? '#94a3b8' : accent }}
                        disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                        Next →
                    </button>
                </div>
            )}
        </div>
    )
}

// ── Small sub-components ──────────────────────────────────────────

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
            <input type={type} value={value} onChange={e => onChange(e.target.value)} style={s.editInput} />
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

// ── Styles ────────────────────────────────────────────────────────

const s = {
    page:       { maxWidth: '1000px', margin: '0 auto' },
    centerText: { textAlign: 'center', padding: '60px', color: '#94a3b8' },

    pageHeader:  { marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '16px' },
    patientName: { color: '#0f172a', margin: 0, fontSize: '26px', fontWeight: '700', flex: 1 },
    editBtn: {
        padding: '7px 16px', background: 'rgba(255,255,255,0.7)',
        border: '1.5px solid #e2e8f0', borderRadius: '8px',
        fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer'
    },

    infoCard:  { ...glass, padding: '20px 24px', marginBottom: '20px' },
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

    tabs: { display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '2px solid #e2e8f0' },
    tab: {
        padding: '10px 18px', background: 'none', border: 'none', borderBottom: '2px solid transparent',
        cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#94a3b8',
        display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '-2px',
        transition: 'color 0.15s'
    },
    tabActive: { color: '#0f172a' },
    tabBadge:  { fontSize: '11px', fontWeight: '700', borderRadius: '10px', padding: '2px 7px' },

    content: { flex: 1 },

    table: { width: '100%', borderCollapse: 'collapse' },
    th: {
        padding: '12px 14px', textAlign: 'left',
        color: 'rgba(255,255,255,0.85)', fontWeight: '600', fontSize: '12px', letterSpacing: '0.04em'
    },
    row: { borderBottom: '1px solid rgba(226,232,240,0.6)' },
    td:  { padding: '10px 14px', fontSize: '13px', color: '#334155', verticalAlign: 'top' },
    empty: { padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' },

    clip: { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },

    badge: { display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' },

    completeBtn: {
        padding: '4px 10px', background: '#dcfce7', color: '#166534',
        border: '1px solid #bbf7d0', borderRadius: '6px',
        fontSize: '11px', fontWeight: '700', cursor: 'pointer'
    },

    addBtn: {
        padding: '9px 18px', color: 'white', border: 'none',
        borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
        fontWeight: '600', boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
    },

    progBtn: {
        padding: '6px 12px', color: 'white', border: 'none',
        borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600'
    },

    pagination:  { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '14px' },
    pageBtn: {
        padding: '7px 16px', background: 'transparent',
        border: '1.5px solid', borderRadius: '8px',
        cursor: 'pointer', fontSize: '13px', fontWeight: '600'
    },
    pageBtnOff:  { borderColor: '#e2e8f0', cursor: 'not-allowed' },
    pageInfo:    { color: '#64748b', fontSize: '13px', fontWeight: '500' }
}

export default PatientDetail
