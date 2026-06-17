import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axiosInstance from '../api/axiosInstance'
import { useToast } from '../components/Toast'
import { glass } from '../styles/glass'

function PatientForm() {
    const navigate = useNavigate()
    const toast = useToast()

    const [form, setForm] = useState({
        full_name: '', date_of_birth: '', gender: '',
        phone: '', address: '', blood_group: ''
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const set = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }))

    const handleSubmit = async e => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        try {
            const clean = {}
            Object.keys(form).forEach(k => { clean[k] = form[k] || null })
            clean.full_name = form.full_name
            const res = await axiosInstance.post('/api/v1/patients/', clean)
            toast('Patient registered successfully', 'success')
            navigate(`/patients/${res.data.id}`)
        } catch (err) {
            const msg = err.response?.status === 403
                ? 'Access denied. Only receptionists and admins can register patients.'
                : 'Failed to register patient. Please try again.'
            setError(msg)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={s.page}>
            <div style={s.header}>
                <button style={s.backBtn} onClick={() => navigate('/patients')}>← Back</button>
                <h2 style={s.title}>Register New Patient</h2>
            </div>

            <div style={{ ...glass, padding: '28px 32px' }}>
                {error && <div style={s.errorBox}>{error}</div>}

                <form onSubmit={handleSubmit} style={s.form}>
                    <Field label="Full Name *">
                        <input style={s.input} type="text" name="full_name" value={form.full_name}
                            onChange={set} placeholder="Enter full name" required />
                    </Field>

                    <div style={s.twoCol}>
                        <Field label="Date of Birth">
                            <input style={s.input} type="date" name="date_of_birth"
                                value={form.date_of_birth} onChange={set} />
                        </Field>
                        <Field label="Gender">
                            <select style={s.input} name="gender" value={form.gender} onChange={set}>
                                <option value="">Select gender</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                            </select>
                        </Field>
                    </div>

                    <div style={s.twoCol}>
                        <Field label="Phone">
                            <input style={s.input} type="tel" name="phone" value={form.phone}
                                onChange={set} placeholder="Enter phone number" />
                        </Field>
                        <Field label="Blood Group">
                            <select style={s.input} name="blood_group" value={form.blood_group} onChange={set}>
                                <option value="">Select blood group</option>
                                {['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(g => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </select>
                        </Field>
                    </div>

                    <Field label="Address">
                        <textarea style={s.textarea} name="address" value={form.address}
                            onChange={set} placeholder="Enter address" rows={2} />
                    </Field>

                    <button type="submit" style={s.submitBtn} disabled={loading}>
                        {loading ? 'Registering...' : 'Register Patient'}
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
    page:    { maxWidth: '600px', margin: '0 auto' },
    header:  { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' },
    backBtn: {
        padding: '8px 16px', background: 'rgba(255,255,255,0.7)',
        border: '1.5px solid #e2e8f0', borderRadius: '8px',
        cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#475569'
    },
    title:   { color: '#0f172a', margin: 0, fontSize: '22px', fontWeight: '700' },
    form:    { display: 'flex', flexDirection: 'column', gap: '18px' },
    twoCol:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
    label:   { fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' },
    input:   {
        padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '10px',
        fontSize: '14px', background: 'white', outline: 'none',
        boxSizing: 'border-box', width: '100%', color: '#0f172a'
    },
    textarea: {
        padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '10px',
        fontSize: '14px', background: 'white', outline: 'none',
        boxSizing: 'border-box', width: '100%', color: '#0f172a',
        resize: 'vertical', fontFamily: 'inherit'
    },
    submitBtn: {
        padding: '13px', background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
        color: 'white', border: 'none', borderRadius: '10px',
        fontSize: '15px', fontWeight: '700', cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(59,130,246,0.3)', marginTop: '4px'
    },
    errorBox: {
        background: '#fef2f2', border: '1px solid #fecaca',
        color: '#b91c1c', borderRadius: '10px',
        padding: '12px 16px', fontSize: '13px', marginBottom: '4px'
    }
}

export default PatientForm
