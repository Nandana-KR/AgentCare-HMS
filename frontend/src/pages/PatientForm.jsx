import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axiosInstance from '../api/axiosInstance'

function PatientForm() {
    const navigate = useNavigate()

    const [formData, setFormData] = useState({
        full_name: '',
        date_of_birth: '',
        gender: '',
        phone: '',
        address: '',
        blood_group: ''
    })

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: value
        }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            // Remove empty strings — send null instead
            const cleanData = {}
            Object.keys(formData).forEach(key => {
                cleanData[key] = formData[key] || null
            })

            // full_name must not be null
            cleanData.full_name = formData.full_name

            const response = await axiosInstance.post(
                '/api/v1/patients/',
                cleanData
            )

            // Go to the new patient's detail page
            navigate(`/patients/${response.data.id}`)

        } catch (err) {
            if (err.response?.status === 403) {
                setError(
                    'Access denied. Only receptionists can register patients.'
                )
            } else {
                setError('Failed to register patient. Please try again.')
            }
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
                    onClick={() => navigate('/patients')}
                >
                    ← Back
                </button>
                <h2 style={styles.title}>Register New Patient</h2>
            </div>

            {error && (
                <div style={styles.errorBanner}>{error}</div>
            )}

            <form onSubmit={handleSubmit} style={styles.form}>

                {/* Full Name */}
                <div style={styles.fieldGroup}>
                    <label style={styles.label}>
                        Full Name *
                    </label>
                    <input
                        style={styles.input}
                        type="text"
                        name="full_name"
                        value={formData.full_name}
                        onChange={handleChange}
                        placeholder="Enter full name"
                        required
                    />
                </div>

                {/* Two columns */}
                <div style={styles.twoCol}>

                    {/* Date of Birth */}
                    <div style={styles.fieldGroup}>
                        <label style={styles.label}>
                            Date of Birth
                        </label>
                        <input
                            style={styles.input}
                            type="date"
                            name="date_of_birth"
                            value={formData.date_of_birth}
                            onChange={handleChange}
                        />
                    </div>

                    {/* Gender */}
                    <div style={styles.fieldGroup}>
                        <label style={styles.label}>Gender</label>
                        <select
                            style={styles.input}
                            name="gender"
                            value={formData.gender}
                            onChange={handleChange}
                        >
                            <option value="">Select gender</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                        </select>
                    </div>

                </div>

                <div style={styles.twoCol}>

                    {/* Phone */}
                    <div style={styles.fieldGroup}>
                        <label style={styles.label}>Phone</label>
                        <input
                            style={styles.input}
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder="Enter phone number"
                        />
                    </div>

                    {/* Blood Group */}
                    <div style={styles.fieldGroup}>
                        <label style={styles.label}>
                            Blood Group
                        </label>
                        <select
                            style={styles.input}
                            name="blood_group"
                            value={formData.blood_group}
                            onChange={handleChange}
                        >
                            <option value="">Select blood group</option>
                            <option value="A+">A+</option>
                            <option value="A-">A-</option>
                            <option value="B+">B+</option>
                            <option value="B-">B-</option>
                            <option value="O+">O+</option>
                            <option value="O-">O-</option>
                            <option value="AB+">AB+</option>
                            <option value="AB-">AB-</option>
                        </select>
                    </div>

                </div>

                {/* Address */}
                <div style={styles.fieldGroup}>
                    <label style={styles.label}>Address</label>
                    <textarea
                        style={styles.textarea}
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        placeholder="Enter address"
                        rows={2}
                    />
                </div>

                {/* Submit */}
                <button
                    type="submit"
                    style={styles.submitBtn}
                    disabled={loading}
                >
                    {loading
                        ? 'Registering...'
                        : 'Register Patient'}
                </button>

            </form>
        </div>
    )
}

const styles = {
    container: {
        maxWidth: '600px',
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
    twoCol: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
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
    }
}

export default PatientForm