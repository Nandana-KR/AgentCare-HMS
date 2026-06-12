import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axiosInstance from '../api/axiosInstance'

function DiagnosisForm() {
    const { patientId } = useParams()
    const navigate = useNavigate()

    const [patient, setPatient] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(false)

    // Form fields
    const [symptoms, setSymptoms] = useState('')
    const [diagnosisText, setDiagnosisText] = useState('')
    const [icdCode, setIcdCode] = useState('')
    const [prescription, setPrescription] = useState('')
    const [followUp, setFollowUp] = useState('')

    // Voice recording state
    const [isListening, setIsListening] = useState(false)
    const [activeField, setActiveField] = useState(null)
    const recognitionRef = useRef(null)

    // Fetch patient info on load
    useEffect(() => {
        const fetchPatient = async () => {
            try {
                const res = await axiosInstance.get(
                    `/api/v1/patients/${patientId}`
                )
                setPatient(res.data)
            } catch (err) {
                setError('Failed to load patient')
            }
        }
        fetchPatient()
    }, [patientId])

    // Set up Web Speech API
    useEffect(() => {
        if ('webkitSpeechRecognition' in window ||
            'SpeechRecognition' in window) {
            const SpeechRecognition =
                window.SpeechRecognition ||
                window.webkitSpeechRecognition

            recognitionRef.current = new SpeechRecognition()
            recognitionRef.current.continuous = true
            recognitionRef.current.interimResults = true
            recognitionRef.current.lang = 'en-US'

            recognitionRef.current.onresult = (event) => {
                let transcript = ''
                for (let i = 0; i < event.results.length; i++) {
                    transcript += event.results[i][0].transcript
                }

                // Fill the active field with speech text
                if (activeField === 'symptoms') {
                    setSymptoms(transcript)
                } else if (activeField === 'diagnosis') {
                    setDiagnosisText(transcript)
                } else if (activeField === 'prescription') {
                    setPrescription(transcript)
                } else if (activeField === 'followup') {
                    setFollowUp(transcript)
                }
            }

            recognitionRef.current.onend = () => {
                setIsListening(false)
                setActiveField(null)
            }
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
        setLoading(true)
        setError(null)

        try {
            await axiosInstance.post('/api/v1/diagnoses/', {
                patient_id: patientId,
                symptoms: symptoms,
                diagnosis_text: diagnosisText,
                icd_code: icdCode || null,
                prescription: prescription || null,
                follow_up: followUp || null
            })

            setSuccess(true)

            // Wait 1 second then go back to patient
            setTimeout(() => {
                navigate(`/patients/${patientId}`)
            }, 1000)

        } catch (err) {
            setError('Failed to save diagnosis. Make sure you are logged in as a doctor.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={styles.container}>

            {/* Header */}
            <div style={styles.header}>
                <button
                    style={styles.backBtn}
                    onClick={() => navigate(`/patients/${patientId}`)}
                >
                    ← Back
                </button>
                <div>
                    <h2 style={styles.title}>New Diagnosis</h2>
                    {patient && (
                        <p style={styles.subtitle}>
                            Patient: {patient.full_name}
                        </p>
                    )}
                </div>
            </div>

            {success && (
                <div style={styles.successBanner}>
                    ✅ Diagnosis saved successfully. Redirecting...
                </div>
            )}

            {error && (
                <div style={styles.errorBanner}>{error}</div>
            )}

            <form onSubmit={handleSubmit} style={styles.form}>

                {/* Symptoms field */}
                <div style={styles.fieldGroup}>
                    <div style={styles.fieldHeader}>
                        <label style={styles.label}>
                            Symptoms *
                        </label>
                        <button
                            type="button"
                            style={{
                                ...styles.voiceBtn,
                                backgroundColor:
                                    isListening &&
                                    activeField === 'symptoms'
                                        ? '#e53e3e'
                                        : '#3182ce'
                            }}
                            onClick={() => startListening('symptoms')}
                        >
                            {isListening && activeField === 'symptoms'
                                ? '⏹ Stop'
                                : '🎤 Speak'}
                        </button>
                    </div>
                    <textarea
                        style={styles.textarea}
                        value={symptoms}
                        onChange={(e) => setSymptoms(e.target.value)}
                        placeholder="Describe patient symptoms..."
                        rows={3}
                        required
                    />
                    {isListening && activeField === 'symptoms' && (
                        <p style={styles.listening}>
                            🔴 Listening...
                        </p>
                    )}
                </div>

                {/* Diagnosis field */}
                <div style={styles.fieldGroup}>
                    <div style={styles.fieldHeader}>
                        <label style={styles.label}>
                            Diagnosis *
                        </label>
                        <button
                            type="button"
                            style={{
                                ...styles.voiceBtn,
                                backgroundColor:
                                    isListening &&
                                    activeField === 'diagnosis'
                                        ? '#e53e3e'
                                        : '#3182ce'
                            }}
                            onClick={() => startListening('diagnosis')}
                        >
                            {isListening && activeField === 'diagnosis'
                                ? '⏹ Stop'
                                : '🎤 Speak'}
                        </button>
                    </div>
                    <textarea
                        style={styles.textarea}
                        value={diagnosisText}
                        onChange={(e) => setDiagnosisText(e.target.value)}
                        placeholder="Enter diagnosis..."
                        rows={3}
                        required
                    />
                    {isListening && activeField === 'diagnosis' && (
                        <p style={styles.listening}>
                            🔴 Listening...
                        </p>
                    )}
                </div>

                {/* ICD Code field */}
                <div style={styles.fieldGroup}>
                    <label style={styles.label}>
                        ICD Code (optional)
                    </label>
                    <input
                        style={styles.input}
                        value={icdCode}
                        onChange={(e) => setIcdCode(e.target.value)}
                        placeholder="e.g. J06.9"
                    />
                </div>

                {/* Prescription field */}
                <div style={styles.fieldGroup}>
                    <div style={styles.fieldHeader}>
                        <label style={styles.label}>
                            Prescription (optional)
                        </label>
                        <button
                            type="button"
                            style={{
                                ...styles.voiceBtn,
                                backgroundColor:
                                    isListening &&
                                    activeField === 'prescription'
                                        ? '#e53e3e'
                                        : '#3182ce'
                            }}
                            onClick={() =>
                                startListening('prescription')
                            }
                        >
                            {isListening &&
                            activeField === 'prescription'
                                ? '⏹ Stop'
                                : '🎤 Speak'}
                        </button>
                    </div>
                    <textarea
                        style={styles.textarea}
                        value={prescription}
                        onChange={(e) => setPrescription(e.target.value)}
                        placeholder="Enter prescription..."
                        rows={2}
                    />
                    {isListening && activeField === 'prescription' && (
                        <p style={styles.listening}>
                            🔴 Listening...
                        </p>
                    )}
                </div>

                {/* Follow up field */}
                <div style={styles.fieldGroup}>
                    <div style={styles.fieldHeader}>
                        <label style={styles.label}>
                            Follow Up (optional)
                        </label>
                        <button
                            type="button"
                            style={{
                                ...styles.voiceBtn,
                                backgroundColor:
                                    isListening &&
                                    activeField === 'followup'
                                        ? '#e53e3e'
                                        : '#3182ce'
                            }}
                            onClick={() => startListening('followup')}
                        >
                            {isListening && activeField === 'followup'
                                ? '⏹ Stop'
                                : '🎤 Speak'}
                        </button>
                    </div>
                    <textarea
                        style={styles.textarea}
                        value={followUp}
                        onChange={(e) => setFollowUp(e.target.value)}
                        placeholder="Enter follow up instructions..."
                        rows={2}
                    />
                    {isListening && activeField === 'followup' && (
                        <p style={styles.listening}>
                            🔴 Listening...
                        </p>
                    )}
                </div>

                {/* Submit button */}
                <button
                    type="submit"
                    style={styles.submitBtn}
                    disabled={loading}
                >
                    {loading ? 'Saving...' : 'Save Diagnosis'}
                </button>

            </form>
        </div>
    )
}

const styles = {
    container: {
        padding: '24px',
        maxWidth: '700px',
        margin: '0 auto'
    },
    header: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '16px',
        marginBottom: '24px'
    },
    backBtn: {
        padding: '8px 16px',
        backgroundColor: '#e2e8f0',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        marginTop: '4px'
    },
    title: {
        color: '#1a365d',
        margin: '0 0 4px 0'
    },
    subtitle: {
        color: '#718096',
        margin: 0
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
    },
    fieldGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
    },
    fieldHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    label: {
        fontWeight: '600',
        color: '#4a5568',
        fontSize: '14px'
    },
    voiceBtn: {
        padding: '4px 12px',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '13px'
    },
    textarea: {
        padding: '10px 12px',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        fontSize: '14px',
        resize: 'vertical',
        fontFamily: 'inherit'
    },
    input: {
        padding: '10px 12px',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        fontSize: '14px'
    },
    listening: {
        color: '#e53e3e',
        fontSize: '13px',
        margin: '4px 0 0 0'
    },
    submitBtn: {
        padding: '12px',
        backgroundColor: '#2b6cb0',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontSize: '16px',
        cursor: 'pointer',
        marginTop: '8px'
    },
    successBanner: {
        backgroundColor: '#c6f6d5',
        color: '#276749',
        padding: '12px 16px',
        borderRadius: '8px',
        marginBottom: '16px'
    },
    errorBanner: {
        backgroundColor: '#fed7d7',
        color: '#9b2c2c',
        padding: '12px 16px',
        borderRadius: '8px',
        marginBottom: '16px'
    }
}

export default DiagnosisForm