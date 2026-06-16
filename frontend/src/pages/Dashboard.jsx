import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import axiosInstance from '../api/axiosInstance'

const ROLE_LABELS = {
    admin: 'System Administrator',
    doctor: 'Physician',
    receptionist: 'Receptionist',
    nurse: 'Nurse'
}

function Dashboard() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [stats, setStats] = useState({ patients: null, appointments: null })

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [pRes, aRes] = await Promise.all([
                    axiosInstance.get('/api/v1/patients/count'),
                    axiosInstance.get('/api/v1/appointments/')
                ])
                setStats({
                    patients: pRes.data.total,
                    appointments: aRes.data.length
                })
            } catch (_) {}
        }
        fetchStats()
    }, [])

    const menuItems = [
        {
            title: 'Patients',
            description: 'View and manage patient records',
            path: '/patients',
            roles: ['admin', 'doctor', 'receptionist', 'nurse']
        },
        {
            title: 'Appointments',
            description: 'Book and manage appointments',
            path: '/appointments',
            roles: ['admin', 'doctor', 'receptionist']
        },
        {
            title: 'Register Patient',
            description: 'Add a new patient to the system',
            path: '/patients/new',
            roles: ['admin', 'receptionist']
        },
        {
            title: 'Staff Management',
            description: 'Manage staff roles and departments',
            path: '/staff',
            roles: ['admin']
        }
    ]

    const allowedItems = menuItems.filter(item => item.roles.includes(user?.role))

    const today = new Date().toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })

    return (
        <div style={styles.container}>
            <div style={styles.welcomeCard}>
                <div>
                    <h2 style={styles.welcome}>Welcome back, {user?.full_name}</h2>
                    <p style={styles.roleText}>{ROLE_LABELS[user?.role] || user?.role}</p>
                </div>
                <p style={styles.dateText}>{today}</p>
            </div>

            {(stats.patients !== null || stats.appointments !== null) && (
                <div style={styles.statsRow}>
                    {stats.patients !== null && (
                        <div style={styles.statCard}>
                            <span style={styles.statNumber}>{stats.patients}</span>
                            <span style={styles.statLabel}>Total Patients</span>
                        </div>
                    )}
                    {stats.appointments !== null && (
                        <div style={styles.statCard}>
                            <span style={styles.statNumber}>{stats.appointments}</span>
                            <span style={styles.statLabel}>Total Appointments</span>
                        </div>
                    )}
                </div>
            )}

            <h3 style={styles.sectionTitle}>Quick Access</h3>

            <div style={styles.grid}>
                {allowedItems.map(item => (
                    <div
                        key={item.path}
                        style={styles.card}
                        onClick={() => navigate(item.path)}
                    >
                        <h3 style={styles.cardTitle}>{item.title}</h3>
                        <p style={styles.cardDesc}>{item.description}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}

const styles = {
    container: {
        maxWidth: '1000px',
        margin: '0 auto'
    },
    welcomeCard: {
        backgroundColor: 'white',
        padding: '24px 28px',
        borderRadius: '12px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    welcome: {
        color: '#1a365d',
        margin: '0 0 4px 0',
        fontSize: '22px'
    },
    roleText: {
        color: '#718096',
        margin: 0,
        fontSize: '14px'
    },
    dateText: {
        color: '#a0aec0',
        margin: 0,
        fontSize: '13px',
        textAlign: 'right'
    },
    statsRow: {
        display: 'flex',
        gap: '16px',
        marginBottom: '24px'
    },
    statCard: {
        backgroundColor: 'white',
        borderRadius: '10px',
        padding: '16px 24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minWidth: '120px',
        borderTop: '3px solid #2b6cb0'
    },
    statNumber: {
        fontSize: '28px',
        fontWeight: '700',
        color: '#2b6cb0',
        lineHeight: 1.2
    },
    statLabel: {
        fontSize: '12px',
        color: '#718096',
        marginTop: '4px',
        textAlign: 'center'
    },
    sectionTitle: {
        color: '#4a5568',
        marginBottom: '16px',
        fontSize: '15px',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '16px'
    },
    card: {
        backgroundColor: 'white',
        padding: '24px',
        borderRadius: '12px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
        cursor: 'pointer',
        borderTop: '4px solid #2b6cb0',
        transition: 'box-shadow 0.15s'
    },
    cardTitle: {
        margin: '0 0 8px 0',
        fontSize: '17px',
        color: '#2b6cb0'
    },
    cardDesc: {
        color: '#718096',
        margin: 0,
        fontSize: '13px',
        lineHeight: '1.5'
    }
}

export default Dashboard
