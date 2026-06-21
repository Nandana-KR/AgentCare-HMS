import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axiosInstance from '../api/axiosInstance'
import { useToast } from '../components/Toast'
import { useAuth } from '../context/AuthContext'
import { glass } from '../styles/glass'

function AppointmentForm() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const toast = useToast()
    const { user } = useAuth()
    const prefilledPatient = searchParams.get('patient') || ''

    const isDoctor = user?.role === 'doctor'
    const isNurse  = user?.role === 'nurse'
    const autoDoctor = isDoctor || isNurse

    const [patients,      setPatients]      = useState([])
    const [doctors,       setDoctors]       = useState([])
    const [prefilledName, setPrefilledName] = useState('')
    const [doctorName,    setDoctorName]    = useState('')
    const [loading,       setLoading]       = useState(true)
    const [submitting,    setSubmitting]     = useState(false)
    const [error,         setError]         = useState(null)

    const [form, setForm] = useState({
        patient_id: prefilledPatient,
        doctor_id: '', scheduled_at: '', notes: ''
    })

    useEffect(() => {
        const calls = [axiosInstance.get('/api/v1/users/doctors')]
        if (!prefilledPatient) {
            calls.unshift(axiosInstance.get('/api/v1/patients/', { params: { skip: 0, limit: 200 } }))
        } else {
            calls.unshift(axiosInstance.get(`/api/v1/patients/${prefilledPatient}`))
        }
        Promise.all(calls)
            .then(([p, d]) => {
                if (prefilledPatient) setPrefilledName(p.data.full_name)
                else setPatients(p.data)
                setDoctors(d.data)

                if (autoDoctor) {
                    const docId = isDoctor ? user.id : user.supervisor_id
                    if (docId) {
                        setForm(prev => ({ ...prev, doctor_id: docId }))
                        const doc = d.data.find(x => x.id === docId)
                        if (doc) setDoctorName(doc.full_name + (doc.department_name ? ` — ${doc.department_name}` : ''))
                    }
                }
            })
            .catch(() => setError('Failed to load data'))
            .finally(() => setLoading(false))
    }, [])

    const set = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }))

    const handleSubmit = async e => {
        e.preventDefault()
        setSubmitting(true)
        setError(null)
        try {
            await axiosInstance.post('/api/v1/appointments/', {
                patient_id:   form.patient_id,
                doctor_id:    form.doctor_id,
                scheduled_at: new Date(form.scheduled_at).toISOString(),
                notes:        form.notes || null
            })
            toast('Appointment booked successfully', 'success')
            navigate('/appointments')
        } catch (err) {
            const msg = err.response?.status === 409
                ? (err.response.data?.detail || 'Doctor already has a conflicting appointment.')
                : err.response?.status === 404
                    ? 'Patient or doctor not found.'
                    : 'Failed to book appointment. Please try again.'
            setError(msg)
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) return <p style={s.center}>Loading...</p>

    return (
        <div style={s.page}>
            <div style={s.header}>
                <button style={s.backBtn} onClick={() => navigate('/appointments')}>← Back</button>
                <h2 style={s.title}>Book Appointment</h2>
            </div>

            <div style={{ ...glass, padding: '28px 32px' }}>
                {error && <div style={s.errorBox}>{error}</div>}

                <form onSubmit={handleSubmit} style={s.form}>
                    {prefilledPatient ? (
                        <Field label="Patient">
                            <div style={s.readOnly}>{prefilledName}</div>
                        </Field>
                    ) : (
                        <Field label="Patient *">
                            <select style={s.input} name="patient_id" value={form.patient_id} onChange={set} required>
                                <option value="">Select patient</option>
                                {patients.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.full_name}{p.phone ? ` — ${p.phone}` : ''}
                                    </option>
                                ))}
                            </select>
                            <span style={s.newPatientHint}>
                                New patient?{' '}
                                <button type="button" style={s.newPatientLink}
                                    onClick={() => navigate('/patients/new')}>
                                    Register first →
                                </button>
                            </span>
                        </Field>
                    )}

                    {autoDoctor && form.doctor_id ? (
                        <Field label="Doctor">
                            <div style={s.readOnly}>{doctorName}</div>
                        </Field>
                    ) : (
                        <Field label="Doctor *">
                            <select style={s.input} name="doctor_id" value={form.doctor_id} onChange={set} required>
                                <option value="">Select doctor</option>
                                {doctors.map(d => (
                                    <option key={d.id} value={d.id}>
                                        {d.full_name}{d.department_name ? ` — ${d.department_name}` : ''}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    )}

                    <Field label="Date & Time *">
                        <input style={s.input} type="datetime-local" name="scheduled_at"
                            value={form.scheduled_at} onChange={set} required />
                    </Field>

                    <Field label="Notes (optional)">
                        <textarea style={s.textarea} name="notes" value={form.notes}
                            onChange={set} placeholder="Reason for visit or additional notes" rows={3} />
                    </Field>

                    <button type="submit" style={s.submitBtn} disabled={submitting}>
                        {submitting ? 'Booking...' : 'Book Appointment'}
                    </button>
                </form>
            </div>
        </div>
    )
}

function Field({ label, children }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={s.label}>{label}</label>
            {children}
        </div>
    )
}

const s = {
    page:    { maxWidth: '560px', margin: '0 auto' },
    center:  { textAlign: 'center', padding: '60px', color: '#94a3b8' },
    header:  { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' },
    backBtn: {
        padding: '8px 16px', background: 'rgba(255,255,255,0.7)',
        border: '1.5px solid #e2e8f0', borderRadius: '8px',
        cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#475569'
    },
    title:   { color: '#0f172a', margin: 0, fontSize: '22px', fontWeight: '700' },
    form:    { display: 'flex', flexDirection: 'column', gap: '18px' },
    label:   { fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' },
    input:   {
        padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '10px',
        fontSize: '14px', background: '#f8fafc', outline: 'none',
        boxSizing: 'border-box', width: '100%', color: '#0f172a'
    },
    textarea: {
        padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '10px',
        fontSize: '14px', background: '#f8fafc', outline: 'none',
        boxSizing: 'border-box', width: '100%', color: '#0f172a',
        resize: 'vertical', fontFamily: 'inherit'
    },
    submitBtn: {
        padding: '13px', background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
        color: 'white', border: 'none', borderRadius: '10px',
        fontSize: '15px', fontWeight: '700', cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(59,130,246,0.3)', marginTop: '4px'
    },
    newPatientHint: { fontSize: '12px', color: '#94a3b8', marginTop: '4px' },
    newPatientLink: {
        background: 'none', border: 'none', padding: 0,
        color: '#3b82f6', fontWeight: '600', fontSize: '12px',
        cursor: 'pointer', textDecoration: 'underline'
    },
    readOnly: {
        padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '10px',
        fontSize: '14px', background: 'rgba(241,245,249,0.8)',
        color: '#0f172a', fontWeight: '600'
    },
    errorBox: {
        background: '#fef2f2', border: '1px solid #fecaca',
        color: '#b91c1c', borderRadius: '10px',
        padding: '12px 16px', fontSize: '13px', marginBottom: '4px'
    }
}

export default AppointmentForm
