import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axiosInstance from '../api/axiosInstance'
import { useAuth } from '../context/AuthContext'

const fmtDateTime = (d) => new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit'
})

function DiagnosisForm() {
    const { patientId } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const isDoctor = user?.role === 'doctor'

    const [patient, setPatient] = useState(null)
    const [appointments, setAppointments] = useState([])
    const [selectedAppointmentId, setSelectedAppointmentId] = useState('')
    const [loadingData, setLoadingData] = useState(true)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(false)

    const [symptoms, setSymptoms] = useState('')
    const [diagnosisText, setDiagnosisText] = useState('')
    const [icdCode, setIcdCode] = useState('')
    const [prescription, setPrescription] = useState('')
    const [followUp, setFollowUp] = useState('')

    const [isListening, setIsListening] = useState(false)
    const [activeField, setActiveField] = useState(null)
    const recognitionRef = useRef(null)

    useEffect(() => {
        Promise.all([
            axiosInstance.get(`/api/v1/patients/${patientId}`),
            axiosInstance.get(`/api/v1/appointments/patient/${patientId}`)
        ]).then(([pRes, aRes]) => {
            setPatient(pRes.data)
            const valid = aRes.data.filter(a => a.status !== 'cancelled')
            setAppointments(valid)
            if (valid.length === 1) setSelectedAppointmentId(valid[0].id)
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

        recognitionRef.current.onresult = (event) => {
            let transcript = ''
            for (let i = 0; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript
            }
            if (activeField === 'symptoms') setSymptoms(transcript)
            else if (activeField === 'diagnosis') setDiagnosisText(transcript)
            else if (activeField === 'prescription') setPrescription(transcript)
            else if (activeField === 'followup') setFollowUp(transcript)
        }
        recognitionRef.current.onend = () => {
            setIsListening(false)
            setActiveField(null)
        }
    }, [activeField])

    const startListening = (field) => {
        if (!recognitionRef.current) {
            alert('Voice input is not supported in this browser. Please use Chrome.')
            return
        }
        if (isListening) {
            recognitionRef.current.stop()
            setIsListening(false)
            setActiveField(null)
            return
        }
        setActiveField(field)
        setIsListening(true)
        recognitionRef.current.start()
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!selectedAppointmentId) {
            setError('Please select an appointment before saving the diagnosis.')
            return
        }
        setLoading(true)
        setError(null)
        try {
            await axiosInstance.post('/api/v1/diagnoses/', {
                patient_id: patientId,
                appointment_id: selectedAppointmentId,
                symptoms,
                diagnosis_text: diagnosisText,
                icd_code: icdCode || null,
                prescription: prescription || null,
                follow_up: followUp || null
            })
            setSuccess(true)
            setTimeout(() => navigate(`/patients/${patientId}?tab=diagnoses`), 1200)
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to save diagnosis.')
        } finally {
            setLoading(false)
        }
    }

    const voiceBtnStyle = (field) => ({
        ...styles.voiceBtn,
        backgroundColor: isListening && activeField === field ? '#e53e3e' : '#3182ce'
    })

    const selectedAppt = appointments.find(a => a.id === selectedAppointmentId)

    if (loadingData) return <p style={styles.centerText}>Loading...</p>

    return (
        <div style={styles.container}>

            <div style={styles.header}>
                <button style={styles.backBtn}
                    onClick={() => navigate(`/patients/${patientId}?tab=diagnoses`)}>
                    ← Back
                </button>
                <div>
                    <h2 style={styles.title}>New Diagnosis</h2>
                    {patient && <p style={styles.subtitle}>Patient: {patient.full_name}</p>}
                </div>
            </div>

            {!isDoctor && (
                <div style={styles.noticeBanner}>
                    Note: Only doctors can submit diagnoses.
                </div>
            )}

            {success && (
                <div style={styles.successBanner}>Diagnosis saved. Redirecting...</div>
            )}

            {error && <div style={styles.errorBanner}>{error}</div>}

            {/* No appointments warning */}
            {appointments.length === 0 && (
                <div style={styles.warningBanner}>
                    This patient has no appointments. An appointment must be booked before a diagnosis can be recorded.
                </div>
            )}

            <form onSubmit={handleSubmit} style={styles.form}>

                {/* Appointment selector */}
                <div style={styles.fieldGroup}>
                    <label style={styles.label}>Appointment *</label>
                    {appointments.length === 0 ? (
                        <p style={styles.noApptText}>No appointments available</p>
                    ) : (
                        <select
                            style={styles.select}
                            value={selectedAppointmentId}
                            onChange={(e) => setSelectedAppointmentId(e.target.value)}
                            required
                        >
                            <option value="">— Select appointment —</option>
                            {appointments.map(apt => (
                                <option key={apt.id} value={apt.id}>
                                    {fmtDateTime(apt.scheduled_at)} · {apt.status}
                                </option>
                            ))}
                        </select>
                    )}
                    {selectedAppt && (
                        <p style={styles.apptHint}>
                            Diagnosis will be dated: {fmtDateTime(selectedAppt.scheduled_at)}
                        </p>
                    )}
                </div>

                {/* Symptoms */}
                <div style={styles.fieldGroup}>
                    <div style={styles.fieldHeader}>
                        <label style={styles.label}>Symptoms *</label>
                        <button type="button" style={voiceBtnStyle('symptoms')}
                            onClick={() => startListening('symptoms')}>
                            {isListening && activeField === 'symptoms' ? 'Stop' : 'Speak'}
                        </button>
                    </div>
                    <textarea style={styles.textarea} value={symptoms}
                        onChange={(e) => setSymptoms(e.target.value)}
                        placeholder="Describe patient symptoms..." rows={3} required />
                    {isListening && activeField === 'symptoms' && (
                        <p style={styles.listening}>Listening...</p>
                    )}
                </div>

                {/* Diagnosis */}
                <div style={styles.fieldGroup}>
                    <div style={styles.fieldHeader}>
                        <label style={styles.label}>Diagnosis *</label>
                        <button type="button" style={voiceBtnStyle('diagnosis')}
                            onClick={() => startListening('diagnosis')}>
                            {isListening && activeField === 'diagnosis' ? 'Stop' : 'Speak'}
                        </button>
                    </div>
                    <textarea style={styles.textarea} value={diagnosisText}
                        onChange={(e) => setDiagnosisText(e.target.value)}
                        placeholder="Enter diagnosis..." rows={3} required />
                    {isListening && activeField === 'diagnosis' && (
                        <p style={styles.listening}>Listening...</p>
                    )}
                </div>

                {/* ICD Code */}
                <div style={styles.fieldGroup}>
                    <label style={styles.label}>ICD Code (optional)</label>
                    <input style={styles.input} value={icdCode}
                        onChange={(e) => setIcdCode(e.target.value)}
                        placeholder="e.g. J06.9" />
                </div>

                {/* Prescription */}
                <div style={styles.fieldGroup}>
                    <div style={styles.fieldHeader}>
                        <label style={styles.label}>Prescription (optional)</label>
                        <button type="button" style={voiceBtnStyle('prescription')}
                            onClick={() => startListening('prescription')}>
                            {isListening && activeField === 'prescription' ? 'Stop' : 'Speak'}
                        </button>
                    </div>
                    <textarea style={styles.textarea} value={prescription}
                        onChange={(e) => setPrescription(e.target.value)}
                        placeholder="Enter prescription..." rows={2} />
                    {isListening && activeField === 'prescription' && (
                        <p style={styles.listening}>Listening...</p>
                    )}
                </div>

                {/* Follow Up */}
                <div style={styles.fieldGroup}>
                    <div style={styles.fieldHeader}>
                        <label style={styles.label}>Follow Up (optional)</label>
                        <button type="button" style={voiceBtnStyle('followup')}
                            onClick={() => startListening('followup')}>
                            {isListening && activeField === 'followup' ? 'Stop' : 'Speak'}
                        </button>
                    </div>
                    <textarea style={styles.textarea} value={followUp}
                        onChange={(e) => setFollowUp(e.target.value)}
                        placeholder="Enter follow up instructions..." rows={2} />
                    {isListening && activeField === 'followup' && (
                        <p style={styles.listening}>Listening...</p>
                    )}
                </div>

                <button type="submit" style={{
                    ...styles.submitBtn,
                    ...(appointments.length === 0 ? { opacity: 0.5, cursor: 'not-allowed' } : {})
                }} disabled={loading || appointments.length === 0}>
                    {loading ? 'Saving...' : 'Save Diagnosis'}
                </button>

            </form>
        </div>
    )
}

const styles = {
    container: { padding: '24px', maxWidth: '700px', margin: '0 auto' },
    centerText: { textAlign: 'center', padding: '40px', color: '#718096' },
    header: { display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '24px' },
    backBtn: { padding: '8px 16px', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer', marginTop: '4px' },
    title: { color: '#1a365d', margin: '0 0 4px 0' },
    subtitle: { color: '#718096', margin: 0 },
    form: { display: 'flex', flexDirection: 'column', gap: '20px' },
    fieldGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
    fieldHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    label: { fontWeight: '600', color: '#4a5568', fontSize: '14px' },
    select: {
        padding: '10px 12px', border: '1px solid #e2e8f0',
        borderRadius: '6px', fontSize: '14px', backgroundColor: 'white'
    },
    apptHint: { fontSize: '12px', color: '#2b6cb0', margin: '4px 0 0 0', fontWeight: '500' },
    noApptText: { color: '#e53e3e', fontSize: '14px', margin: 0 },
    voiceBtn: { padding: '4px 12px', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' },
    textarea: { padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', resize: 'vertical', fontFamily: 'inherit' },
    input: { padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px' },
    listening: { color: '#e53e3e', fontSize: '13px', margin: '4px 0 0 0' },
    submitBtn: { padding: '12px', backgroundColor: '#2b6cb0', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer', marginTop: '8px' },
    noticeBanner: { backgroundColor: '#fefcbf', color: '#744210', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', borderLeft: '4px solid #d69e2e' },
    warningBanner: { backgroundColor: '#fed7d7', color: '#9b2c2c', padding: '14px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', borderLeft: '4px solid #e53e3e' },
    successBanner: { backgroundColor: '#c6f6d5', color: '#276749', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px' },
    errorBanner: { backgroundColor: '#fed7d7', color: '#9b2c2c', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px' }
}

export default DiagnosisForm
