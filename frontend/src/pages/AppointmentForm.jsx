import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axiosInstance from '../api/axiosInstance'

function AppointmentForm() {
    const navigate = useNavigate()

    const [patients, setPatients] = useState([])
    const [doctors, setDoctors] = useState([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState(null)

    const [formData, setFormData] = useState({
        patient_id: '',
        doctor_id: '',
        scheduled_at: '',
        notes: ''
    })

    // Fetch patients and doctors when page loads
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [patientsRes, doctorsRes] = await Promise.all([
                    axiosInstance.get('/api/v1/patients/', {
                        params: { skip: 0, limit: 100 }
                    }),
                    axiosInstance.get('/api/v1/users/doctors')
                ])
                setPatients(patientsRes.data)
                setDoctors(doctorsRes.data)
            } catch (err) {
                setError('Failed to load patients and doctors')
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [])

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: value
        }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSubmitting(true)
        setError(null)

        try {
            // Convert local datetime to ISO format
            const scheduledAt = new Date(
                formData.scheduled_at
            ).toISOString()

            await axiosInstance.post('/api/v1/appointments/', {
                patient_id: formData.patient_id,
                doctor_id: formData.doctor_id,
                scheduled_at: scheduledAt,
                notes: formData.notes || null
            })

            navigate('/appointments')

        } catch (err) {
            if (err.response?.status === 403) {
                setError(
                    'Access denied. Only receptionists can book appointments.'
                )
            } else if (err.response?.status === 404) {
                setError('Patient or doctor not found.')
            } else if (err.response?.status === 409) {
                setError(err.response.data?.detail || 'This doctor already has a conflicting appointment.')
            } else {
                setError('Failed to book appointment. Please try again.')
            }
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) return (
        <p style={styles.loading}>Loading...</p>
    )

    return (
        <div style={styles.container}>

            {/* Header */}
            <div style={styles.header}>
                <button
                    style={styles.backBtn}
                    onClick={() => navigate('/appointments')}
                >
                    ← Back
                </button>
                <h2 style={styles.title}>Book Appointment</h2>
            </div>

            {error && (
                <div style={styles.errorBanner}>{error}</div>
            )}

            <form onSubmit={handleSubmit} style={styles.form}>

                {/* Patient dropdown */}
                <div style={styles.fieldGroup}>
                    <label style={styles.label}>
                        Patient *
                    </label>
                    <select
                        style={styles.input}
                        name="patient_id"
                        value={formData.patient_id}
                        onChange={handleChange}
                        required
                    >
                        <option value="">Select patient</option>
                        {patients.map(patient => (
                            <option
                                key={patient.id}
                                value={patient.id}
                            >
                                {patient.full_name}
                                {patient.phone
                                    ? ` — ${patient.phone}`
                                    : ''}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Doctor dropdown */}
                <div style={styles.fieldGroup}>
                    <label style={styles.label}>
                        Doctor *
                    </label>
                    <select
                        style={styles.input}
                        name="doctor_id"
                        value={formData.doctor_id}
                        onChange={handleChange}
                        required
                    >
                        <option value="">Select doctor</option>
                        {doctors.map(doctor => (
                            <option
                                key={doctor.id}
                                value={doctor.id}
                            >
                                {doctor.full_name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Date and time */}
                <div style={styles.fieldGroup}>
                    <label style={styles.label}>
                        Date and Time *
                    </label>
                    <input
                        style={styles.input}
                        type="datetime-local"
                        name="scheduled_at"
                        value={formData.scheduled_at}
                        onChange={handleChange}
                        required
                    />
                </div>

                {/* Notes */}
                <div style={styles.fieldGroup}>
                    <label style={styles.label}>
                        Notes (optional)
                    </label>
                    <textarea
                        style={styles.textarea}
                        name="notes"
                        value={formData.notes}
                        onChange={handleChange}
                        placeholder="Reason for visit or additional notes"
                        rows={3}
                    />
                </div>

                {/* Submit */}
                <button
                    type="submit"
                    style={styles.submitBtn}
                    disabled={submitting}
                >
                    {submitting
                        ? 'Booking...'
                        : 'Book Appointment'}
                </button>

            </form>
        </div>
    )
}

const styles = {
    container: {
        maxWidth: '580px',
        margin: '0 auto'
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '24px'
    },
    backBtn: {
        padding: '8px 16px',
        backgroundColor: '#e2e8f0',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer'
    },
    title: {
        color: '#1a365d',
        margin: 0
    },
    errorBanner: {
        backgroundColor: '#fed7d7',
        color: '#9b2c2c',
        padding: '12px 16px',
        borderRadius: '8px',
        marginBottom: '16px'
    },
    form: {
        backgroundColor: 'white',
        padding: '24px',
        borderRadius: '12px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
    },
    fieldGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
    },
    label: {
        fontSize: '14px',
        fontWeight: '600',
        color: '#4a5568'
    },
    input: {
        padding: '10px 12px',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        fontSize: '14px',
        width: '100%',
        boxSizing: 'border-box'
    },
    textarea: {
        padding: '10px 12px',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        fontSize: '14px',
        resize: 'vertical',
        fontFamily: 'inherit'
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
    loading: {
        textAlign: 'center',
        padding: '40px',
        color: '#718096'
    }
}

export default AppointmentForm