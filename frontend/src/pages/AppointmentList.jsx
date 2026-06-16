import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import axiosInstance from '../api/axiosInstance'

function AppointmentList() {
    const [appointments, setAppointments] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const { user } = useAuth()
    const navigate = useNavigate()

    useEffect(() => {
        fetchAppointments()
    }, [])

    const fetchAppointments = async () => {
        setLoading(true)
        try {
            const res = await axiosInstance.get(
                '/api/v1/appointments/'
            )
            setAppointments(res.data)
        } catch (err) {
            setError('Failed to load appointments')
        } finally {
            setLoading(false)
        }
    }

    const handleCancel = async (appointmentId) => {
        if (!window.confirm(
            'Are you sure you want to cancel this appointment?'
        )) return

        try {
            await axiosInstance.delete(
                `/api/v1/appointments/${appointmentId}`
            )
            fetchAppointments()
        } catch (err) {
            alert('Failed to cancel appointment')
        }
    }

    const getStatusStyle = (status) => {
        if (status === 'completed') return styles.statusCompleted
        if (status === 'cancelled') return styles.statusCancelled
        return styles.statusScheduled
    }

    if (loading) return (
        <p style={styles.loading}>Loading...</p>
    )
    if (error) return (
        <p style={styles.error}>{error}</p>
    )

    return (
        <div style={styles.container}>

            {/* Header */}
            <div style={styles.header}>
                <h2 style={styles.title}>Appointments</h2>
                {['admin', 'receptionist', 'doctor', 'nurse'].includes(user?.role) && (
                    <button
                        style={styles.bookBtn}
                        onClick={() => navigate('/appointments/new')}
                    >
                        + Book Appointment
                    </button>
                )}
            </div>

            {appointments.length === 0 ? (
                <div style={styles.emptyState}>
                    <p>No appointments found</p>
                </div>
            ) : (
                <div style={styles.list}>
                    {appointments.map(apt => (
                        <div key={apt.id} style={styles.card}>

                            <div style={styles.cardHeader}>
                                <span style={getStatusStyle(apt.status)}>
                                    {apt.status}
                                </span>
                                <span style={styles.dateText}>
                                    {new Date(apt.scheduled_at)
                                        .toLocaleString('en-GB', {day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})}
                                </span>
                            </div>

                            <div style={styles.cardBody}>
                                <div style={styles.infoRow}>
                                    <span style={styles.label}>
                                        Patient
                                    </span>
                                    <span style={styles.value}>
                                        {apt.patient_name}
                                    </span>
                                </div>
                                <div style={styles.infoRow}>
                                    <span style={styles.label}>
                                        Doctor
                                    </span>
                                    <span style={styles.value}>
                                        {apt.doctor_name}
                                    </span>
                                </div>
                                {apt.notes && (
                                    <div style={styles.infoRow}>
                                        <span style={styles.label}>
                                            Notes
                                        </span>
                                        <span style={styles.value}>
                                            {apt.notes}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {apt.status === 'scheduled' &&
                             user?.role === 'receptionist' && (
                                <button
                                    style={styles.cancelBtn}
                                    onClick={() =>
                                        handleCancel(apt.id)
                                    }
                                >
                                    Cancel Appointment
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

const styles = {
    container: {
        maxWidth: '800px',
        margin: '0 auto'
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
    },
    title: {
        color: '#1a365d',
        margin: 0
    },
    bookBtn: {
        padding: '10px 20px',
        backgroundColor: '#2b6cb0',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px'
    },
    list: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
    },
    card: {
        backgroundColor: 'white',
        borderRadius: '10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        overflow: 'hidden'
    },
    cardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        backgroundColor: '#f7fafc',
        borderBottom: '1px solid #e2e8f0'
    },
    cardBody: {
        padding: '16px'
    },
    infoRow: {
        display: 'flex',
        gap: '12px',
        marginBottom: '8px'
    },
    label: {
        fontSize: '13px',
        color: '#718096',
        fontWeight: '600',
        minWidth: '80px'
    },
    value: {
        fontSize: '13px',
        color: '#2d3748'
    },
    dateText: {
        fontSize: '14px',
        color: '#4a5568',
        fontWeight: '500'
    },
    statusScheduled: {
        padding: '3px 10px',
        backgroundColor: '#bee3f8',
        color: '#2b6cb0',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '600'
    },
    statusCompleted: {
        padding: '3px 10px',
        backgroundColor: '#c6f6d5',
        color: '#276749',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '600'
    },
    statusCancelled: {
        padding: '3px 10px',
        backgroundColor: '#fed7d7',
        color: '#9b2c2c',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '600'
    },
    cancelBtn: {
        margin: '0 16px 16px',
        padding: '8px 16px',
        backgroundColor: '#e53e3e',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '13px'
    },
    emptyState: {
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '12px',
        textAlign: 'center',
        color: '#a0aec0'
    },
    loading: {
        textAlign: 'center',
        padding: '40px',
        color: '#718096'
    },
    error: {
        textAlign: 'center',
        padding: '40px',
        color: '#e53e3e'
    }
}

export default AppointmentList