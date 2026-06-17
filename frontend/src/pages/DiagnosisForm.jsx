import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axiosInstance from '../api/axiosInstance'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'

const glass = {
    background: 'rgba(255,255,255,0.78)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.6)',
    borderRadius: '16px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.06)'
}

const fmtDateTime = d => new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit'
})

function DiagnosisForm() {
    const { patientId } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const toast = useToast()
    const isDoctor = user?.role === 'doctor'

    const [patient,      setPatient]      = useState(null)
    const [appointments, setAppointments] = useState([])
    const [apptId,       setApptId]       = useState('')
    const [loadingData,  setLoadingData]  = useState(true)
    const [loading,      setLoading]      = useState(false)
    const [error,        setError]        = useState(null)

    const [symptoms,      setSymptoms]      = useState('')
    const [diagnosisText, setDiagnosisText] = useState('')
    const [icdCode,       setIcdCode]       = useState('')
    const [prescription,  setPrescription]  = useState('')
    const [followUp,      setFollowUp]      = useState('')

    const [isListening, setIsListening] = useState(false)
    const [activeField, setActiveField] = useState(null)
    const recognitionRef = useRef(null)

    useEffect(() => {
        Promise.all([
            axiosInstance.get(`/api/v1/patients/${patientId}`),
            axiosInstance.get(`/api/v1/appointments/patient/${patientId}`)
        ]).then(([p, a]) => {
            setPatient(p.data)
            const valid = a.data.filter(x => x.status !== 'cancelled')
            setAppointments(valid)
            if (valid.length === 1) setApptId(valid[0].id)
        }).catch(() => setError('Failed to load patient data'))
          .finally(() => setLoadingData(false))
    }, [patientId])

    useEffect(() => {
        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition
        recognitionRef.current = new SR()
        recognitionRef.current.continuous = true
        recognitionRef.current.interimResults = true
        recognitionRef.current.lang = 'en-US'
        recognitionRef.current.onresult = event => {
            let t = ''
            for (let i = 0; i < event.results.length; i++) t += event.results[i][0].transcript
            if (activeField === 'symptoms')     setSymptoms(t)
            if (activeField === 'diagnosis')    setDiagnosisText(t)
            if (activeField === 'prescription') setPrescription(t)
            if (activeField === 'followup')     setFollowUp(t)
        }
        recognitionRef.current.onend = () => { setIsListening(false); setActiveField(null) }
    }, [activeField])

    const toggleVoice = field => {
        if (!recognitionRef.current) {
            toast('Voice input is not supported in this browser. Please use Chrome.', 'warning')
            return
        }
        if (isListening) { recognitionRef.current.stop(); return }
        setActiveField(field)
        setIsListening(true)
        recognitionRef.current.start()
    }

    const handleSubmit = async e => {
        e.preventDefault()
        if (!apptId) { setError('Please select an appointment first.'); return }
        setLoading(true)
        setError(null)
        try {
            await axiosInstance.post('/api/v1/diagnoses/', {
                patient_id:     patientId,
                appointment_id: apptId,
                symptoms,
                diagnosis_text: diagnosisText,
                icd_code:       icdCode || null,
                prescription:   prescription || null,
                follow_up:      followUp || null
            })
            toast('Diagnosis saved successfully', 'success')
            navigate(`/patients/${patientId}?tab=diagnoses`)
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to save diagnosis.')
        } finally {
            setLoading(false)
        }
    }

    if (loadingData) return <p style={s.center}>Loading...</p>

    const selectedAppt = appointments.find(a => a.id === apptId)

    return (
        <div style={s.page}>
            <div style={s.header}>
                <button style={s.backBtn} onClick={() => navigate(`/patients/${patientId}?tab=diagnoses`)}>
                    ← Back
                </button>
                <div>
                    <h2 style={s.title}>New Diagnosis</h2>
                    {patient && <p style={s.subtitle}>{patient.full_name}</p>}
                </div>
            </div>

            {!isDoctor && (
                <div style={s.warnBox}>Only doctors can submit diagnoses.</div>
            )}
            {appointments.length === 0 && (
                <div style={s.warnBox}>No appointments found. Book an appointment before recording a diagnosis.</div>
            )}

            <div style={{ ...glass, padding: '28px 32px' }}>
                {error && <div style={s.errorBox}>{error}</div>}

                <form onSubmit={handleSubmit} style={s.form}>

                    {/* Appointment selector */}
                    <div style={s.field}>
                        <label style={s.label}>Appointment *</label>
                        {appointments.length === 0 ? (
                            <p style={{ color: '#ef4444', fontSize: '13px', margin: 0 }}>No appointments available</p>
                        ) : (
                            <select style={s.input} value={apptId}
                                onChange={e => setApptId(e.target.value)} required>
                                <option value="">— Select appointment —</option>
                                {appointments.map(a => (
                                    <option key={a.id} value={a.id}>
                                        {fmtDateTime(a.scheduled_at)} · {a.status}
                                    </option>
                                ))}
                            </select>
                        )}
                        {selectedAppt && (
                            <p style={s.apptHint}>
                                Diagnosis dated: {fmtDateTime(selectedAppt.scheduled_at)}
                            </p>
                        )}
                    </div>

                    <VoiceField label="Symptoms *" value={symptoms} onChange={setSymptoms}
                        field="symptoms" active={activeField} listening={isListening} onVoice={toggleVoice} required />

                    <VoiceField label="Diagnosis *" value={diagnosisText} onChange={setDiagnosisText}
                        field="diagnosis" active={activeField} listening={isListening} onVoice={toggleVoice} required />

                    <div style={s.field}>
                        <label style={s.label}>ICD Code (optional)</label>
                        <input style={s.input} value={icdCode}
                            onChange={e => setIcdCode(e.target.value)} placeholder="e.g. J06.9" />
                    </div>

                    <VoiceField label="Prescription (optional)" value={prescription} onChange={setPrescription}
                        field="prescription" active={activeField} listening={isListening} onVoice={toggleVoice} />

                    <VoiceField label="Follow Up (optional)" value={followUp} onChange={setFollowUp}
                        field="followup" active={activeField} listening={isListening} onVoice={toggleVoice} />

                    <button type="submit" style={{
                        ...s.submitBtn,
                        ...(appointments.length === 0 ? { opacity: 0.5, cursor: 'not-allowed' } : {})
                    }} disabled={loading || appointments.length === 0}>
                        {loading ? 'Saving...' : 'Save Diagnosis'}
                    </button>
                </form>
            </div>
        </div>
    )
}

function VoiceField({ label, value, onChange, field, active, listening, onVoice, required }) {
    const isActive = listening && active === field
    return (
        <div style={s.field}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={s.label}>{label}</label>
                <button type="button" onClick={() => onVoice(field)} style={{
                    ...s.voiceBtn,
                    background: isActive
                        ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                        : 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
                }}>
                    {isActive ? '■ Stop' : '🎤 Speak'}
                </button>
            </div>
            <textarea style={s.textarea} value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={`${label.replace(' *', '').replace(' (optional)', '')}...`}
                rows={3} required={required} />
            {isActive && <p style={{ color: '#ef4444', fontSize: '12px', margin: '4px 0 0', fontWeight: '600' }}>Listening...</p>}
        </div>
    )
}

const s = {
    page:    { maxWidth: '700px', margin: '0 auto' },
    center:  { textAlign: 'center', padding: '60px', color: '#94a3b8' },
    header:  { display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' },
    backBtn: {
        padding: '8px 16px', background: 'rgba(255,255,255,0.7)',
        border: '1.5px solid #e2e8f0', borderRadius: '8px',
        cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#475569', marginTop: '4px'
    },
    title:    { color: '#0f172a', margin: '0 0 2px', fontSize: '22px', fontWeight: '700' },
    subtitle: { color: '#64748b', margin: 0, fontSize: '14px' },

    warnBox: {
        background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
        color: '#92400e', borderRadius: '10px', padding: '12px 16px',
        fontSize: '13px', fontWeight: '500', marginBottom: '16px'
    },
    errorBox: {
        background: '#fef2f2', border: '1px solid #fecaca',
        color: '#b91c1c', borderRadius: '10px',
        padding: '12px 16px', fontSize: '13px', marginBottom: '4px'
    },
    apptHint: { fontSize: '12px', color: '#3b82f6', margin: '4px 0 0', fontWeight: '600' },

    form:    { display: 'flex', flexDirection: 'column', gap: '18px' },
    field:   { display: 'flex', flexDirection: 'column', gap: '6px' },
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
    voiceBtn: {
        padding: '5px 12px', color: 'white', border: 'none',
        borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600'
    },
    submitBtn: {
        padding: '13px', background: 'linear-gradient(135deg, #6d28d9, #8b5cf6)',
        color: 'white', border: 'none', borderRadius: '10px',
        fontSize: '15px', fontWeight: '700', cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(139,92,246,0.3)'
    }
}

export default DiagnosisForm
