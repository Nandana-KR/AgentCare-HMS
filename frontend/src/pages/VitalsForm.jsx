import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axiosInstance from '../api/axiosInstance'

function VitalsForm() {
    const { patientId } = useParams()
    const navigate = useNavigate()

    const [patient, setPatient] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(false)

    const [temperature, setTemperature] = useState('')
    const [heartRate, setHeartRate] = useState('')
    const [bpSystolic, setBpSystolic] = useState('')
    const [bpDiastolic, setBpDiastolic] = useState('')
    const [respiratoryRate, setRespiratoryRate] = useState('')
    const [oxygenSaturation, setOxygenSaturation] = useState('')
    const [weightKg, setWeightKg] = useState('')
    const [heightCm, setHeightCm] = useState('')

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

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            await axiosInstance.post('/api/v1/vitals/', {
                patient_id: patientId,
                temperature: temperature ? parseFloat(temperature) : null,
                heart_rate: heartRate ? parseInt(heartRate) : null,
                blood_pressure_systolic: bpSystolic ? parseInt(bpSystolic) : null,
                blood_pressure_diastolic: bpDiastolic ? parseInt(bpDiastolic) : null,
                respiratory_rate: respiratoryRate ? parseInt(respiratoryRate) : null,
                oxygen_saturation: oxygenSaturation ? parseFloat(oxygenSaturation) : null,
                weight_kg: weightKg ? parseFloat(weightKg) : null,
                height_cm: heightCm ? parseFloat(heightCm) : null
            })

            setSuccess(true)

            setTimeout(() => {
                navigate(`/patients/${patientId}`)
            }, 1000)

        } catch (err) {
            setError('Failed to save vitals. Make sure you are logged in as a nurse or doctor.')
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
                    <h2 style={styles.title}>Record Vitals</h2>
                    {patient && (
                        <p style={styles.subtitle}>
                            Patient: {patient.full_name}
                        </p>
                    )}
                </div>
            </div>

            {success && (
                <div style={styles.successBanner}>
                    ✅ Vitals saved successfully. Redirecting...
                </div>
            )}

            {error && (
                <div style={styles.errorBanner}>{error}</div>
            )}

            <form onSubmit={handleSubmit} style={styles.form}>
                <div style={styles.grid}>
                    <div style={styles.fieldGroup}>
                        <label style={styles.label}>Temperature (°C)</label>
                        <input
                            style={styles.input}
                            type="number"
                            step="0.1"
                            value={temperature}
                            onChange={(e) => setTemperature(e.target.value)}
                            placeholder="e.g. 37.0"
                        />
                    </div>

                    <div style={styles.fieldGroup}>
                        <label style={styles.label}>Heart Rate (bpm)</label>
                        <input
                            style={styles.input}
                            type="number"
                            value={heartRate}
                            onChange={(e) => setHeartRate(e.target.value)}
                            placeholder="e.g. 72"
                        />
                    </div>

                    <div style={styles.fieldGroup}>
                        <label style={styles.label}>Blood Pressure - Systolic</label>
                        <input
                            style={styles.input}
                            type="number"
                            value={bpSystolic}
                            onChange={(e) => setBpSystolic(e.target.value)}
                            placeholder="e.g. 120"
                        />
                    </div>

                    <div style={styles.fieldGroup}>
                        <label style={styles.label}>Blood Pressure - Diastolic</label>
                        <input
                            style={styles.input}
                            type="number"
                            value={bpDiastolic}
                            onChange={(e) => setBpDiastolic(e.target.value)}
                            placeholder="e.g. 80"
                        />
                    </div>

                    <div style={styles.fieldGroup}>
                        <label style={styles.label}>Respiratory Rate (breaths/min)</label>
                        <input
                            style={styles.input}
                            type="number"
                            value={respiratoryRate}
                            onChange={(e) => setRespiratoryRate(e.target.value)}
                            placeholder="e.g. 16"
                        />
                    </div>

                    <div style={styles.fieldGroup}>
                        <label style={styles.label}>Oxygen Saturation (%)</label>
                        <input
                            style={styles.input}
                            type="number"
                            step="0.1"
                            value={oxygenSaturation}
                            onChange={(e) => setOxygenSaturation(e.target.value)}
                            placeholder="e.g. 98"
                        />
                    </div>

                    <div style={styles.fieldGroup}>
                        <label style={styles.label}>Weight (kg)</label>
                        <input
                            style={styles.input}
                            type="number"
                            step="0.1"
                            value={weightKg}
                            onChange={(e) => setWeightKg(e.target.value)}
                            placeholder="e.g. 70.5"
                        />
                    </div>

                    <div style={styles.fieldGroup}>
                        <label style={styles.label}>Height (cm)</label>
                        <input
                            style={styles.input}
                            type="number"
                            step="0.1"
                            value={heightCm}
                            onChange={(e) => setHeightCm(e.target.value)}
                            placeholder="e.g. 172"
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    style={styles.submitBtn}
                    disabled={loading}
                >
                    {loading ? 'Saving...' : 'Save Vitals'}
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
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '16px'
    },
    fieldGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
    },
    label: {
        fontWeight: '600',
        color: '#4a5568',
        fontSize: '14px'
    },
    input: {
        padding: '10px 12px',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        fontSize: '14px'
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

export default VitalsForm
