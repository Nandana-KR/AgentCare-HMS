import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axiosInstance from '../api/axiosInstance'
import { useToast } from '../components/Toast'

const glass = {
    background: 'rgba(255,255,255,0.78)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.6)',
    borderRadius: '16px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.06)'
}

const FIELDS = [
    { key: 'temperature',              label: 'Temperature (°C)',         placeholder: 'e.g. 37.0', step: '0.1',  type: 'float' },
    { key: 'heart_rate',               label: 'Heart Rate (bpm)',         placeholder: 'e.g. 72',   step: '1',    type: 'int'   },
    { key: 'blood_pressure_systolic',  label: 'BP Systolic (mmHg)',       placeholder: 'e.g. 120',  step: '1',    type: 'int'   },
    { key: 'blood_pressure_diastolic', label: 'BP Diastolic (mmHg)',      placeholder: 'e.g. 80',   step: '1',    type: 'int'   },
    { key: 'respiratory_rate',         label: 'Respiratory Rate (/min)',  placeholder: 'e.g. 16',   step: '1',    type: 'int'   },
    { key: 'oxygen_saturation',        label: 'SpO₂ (%)',                 placeholder: 'e.g. 98',   step: '0.1',  type: 'float' },
    { key: 'weight_kg',                label: 'Weight (kg)',              placeholder: 'e.g. 70.5', step: '0.1',  type: 'float' },
    { key: 'height_cm',                label: 'Height (cm)',              placeholder: 'e.g. 172',  step: '0.1',  type: 'float' }
]

function VitalsForm() {
    const { patientId } = useParams()
    const navigate = useNavigate()
    const toast = useToast()

    const [patient, setPatient] = useState(null)
    const [loading, setLoading] = useState(false)
    const [values, setValues] = useState(
        Object.fromEntries(FIELDS.map(f => [f.key, '']))
    )

    useEffect(() => {
        axiosInstance.get(`/api/v1/patients/${patientId}`)
            .then(r => setPatient(r.data))
            .catch(() => toast('Failed to load patient', 'error'))
    }, [patientId])

    const handleSubmit = async e => {
        e.preventDefault()
        setLoading(true)
        try {
            const payload = { patient_id: patientId }
            FIELDS.forEach(f => {
                payload[f.key] = values[f.key]
                    ? (f.type === 'int' ? parseInt(values[f.key]) : parseFloat(values[f.key]))
                    : null
            })
            await axiosInstance.post('/api/v1/vitals/', payload)
            toast('Vitals saved successfully', 'success')
            navigate(`/patients/${patientId}?tab=vitals`)
        } catch {
            toast('Failed to save vitals', 'error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={s.page}>
            <div style={s.header}>
                <button style={s.backBtn} onClick={() => navigate(`/patients/${patientId}?tab=vitals`)}>
                    ← Back
                </button>
                <div>
                    <h2 style={s.title}>Record Vitals</h2>
                    {patient && <p style={s.subtitle}>{patient.full_name}</p>}
                </div>
            </div>

            <div style={{ ...glass, padding: '28px 32px' }}>
                <form onSubmit={handleSubmit} style={s.form}>
                    <div style={s.grid}>
                        {FIELDS.map(f => (
                            <div key={f.key} style={s.field}>
                                <label style={s.label}>{f.label}</label>
                                <input
                                    style={s.input}
                                    type="number"
                                    step={f.step}
                                    value={values[f.key]}
                                    onChange={e => setValues(p => ({ ...p, [f.key]: e.target.value }))}
                                    placeholder={f.placeholder}
                                />
                            </div>
                        ))}
                    </div>

                    <button type="submit" style={s.submitBtn} disabled={loading}>
                        {loading ? 'Saving...' : 'Save Vitals'}
                    </button>
                </form>
            </div>
        </div>
    )
}

const s = {
    page:    { maxWidth: '660px', margin: '0 auto' },
    header:  { display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '24px' },
    backBtn: {
        padding: '8px 16px', background: 'rgba(255,255,255,0.7)',
        border: '1.5px solid #e2e8f0', borderRadius: '8px',
        cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#475569', marginTop: '4px'
    },
    title:    { color: '#0f172a', margin: '0 0 2px', fontSize: '22px', fontWeight: '700' },
    subtitle: { color: '#64748b', margin: 0, fontSize: '14px' },
    form:     { display: 'flex', flexDirection: 'column', gap: '24px' },
    grid:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
    field:    { display: 'flex', flexDirection: 'column', gap: '6px' },
    label:    { fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' },
    input:    {
        padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '10px',
        fontSize: '14px', background: 'white', outline: 'none',
        boxSizing: 'border-box', width: '100%', color: '#0f172a'
    },
    submitBtn: {
        padding: '13px', background: 'linear-gradient(135deg, #059669, #10b981)',
        color: 'white', border: 'none', borderRadius: '10px',
        fontSize: '15px', fontWeight: '700', cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(16,185,129,0.3)'
    }
}

export default VitalsForm
