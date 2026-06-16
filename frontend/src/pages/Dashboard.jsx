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

const fmtDateTime = (d) => new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit'
})

// ── Admin dashboard ──────────────────────────────────────────────
function AdminDashboard({ user, navigate }) {
    const [stats, setStats] = useState({ patients: null, appointments: null })

    useEffect(() => {
        Promise.all([
            axiosInstance.get('/api/v1/patients/count'),
            axiosInstance.get('/api/v1/appointments/')
        ]).then(([p, a]) => setStats({ patients: p.data.total, appointments: a.data.length }))
          .catch(() => {})
    }, [])

    const quickLinks = [
        { title: 'Patients', desc: 'View and manage patient records', path: '/patients' },
        { title: 'Appointments', desc: 'View all appointments', path: '/appointments' },
        { title: 'Staff Management', desc: 'Manage roles and departments', path: '/staff' },
        { title: '+ Register Patient', desc: 'Add a new patient to the system', path: '/patients/new' }
    ]

    const today = new Date().toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })

    return (
        <div style={s.container}>
            <div style={s.welcomeCard}>
                <div>
                    <h2 style={s.welcome}>Welcome back, {user?.full_name}</h2>
                    <p style={s.roleText}>{ROLE_LABELS[user?.role]}</p>
                </div>
                <p style={s.dateText}>{today}</p>
            </div>

            <div style={s.statsRow}>
                <div style={s.statCard}>
                    <span style={s.statNum}>{stats.patients ?? '—'}</span>
                    <span style={s.statLabel}>Total Patients</span>
                </div>
                <div style={s.statCard}>
                    <span style={s.statNum}>{stats.appointments ?? '—'}</span>
                    <span style={s.statLabel}>Total Appointments</span>
                </div>
            </div>

            <p style={s.sectionTitle}>QUICK ACCESS</p>
            <div style={s.grid}>
                {quickLinks.map(item => (
                    <div key={item.path} style={s.card} onClick={() => navigate(item.path)}>
                        <h3 style={s.cardTitle}>{item.title}</h3>
                        <p style={s.cardDesc}>{item.desc}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ── Doctor dashboard ─────────────────────────────────────────────
function DoctorDashboard({ user, navigate }) {
    const [appointments, setAppointments] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        axiosInstance.get('/api/v1/appointments/')
            .then(r => setAppointments(r.data))
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [])

    const scheduled = appointments.filter(a => a.status === 'scheduled')
    const recent = appointments.filter(a => a.status !== 'scheduled').slice(0, 5)

    const getStatusStyle = (s) => ({
        padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600',
        backgroundColor: s === 'completed' ? '#c6f6d5' : s === 'cancelled' ? '#fed7d7' : '#bee3f8',
        color: s === 'completed' ? '#276749' : s === 'cancelled' ? '#9b2c2c' : '#2b6cb0'
    })

    return (
        <div style={s.container}>
            <div style={s.welcomeCard}>
                <div>
                    <h2 style={s.welcome}>Good {getGreeting()}, {user?.full_name}</h2>
                    <p style={s.roleText}>{user?.department_name ? `${ROLE_LABELS.doctor} · ${user.department_name}` : ROLE_LABELS.doctor}</p>
                </div>
                <p style={s.dateText}>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            </div>

            <p style={s.sectionTitle}>UPCOMING APPOINTMENTS ({scheduled.length})</p>
            {loading ? (
                <p style={s.emptyText}>Loading...</p>
            ) : scheduled.length === 0 ? (
                <div style={s.emptyCard}>No upcoming appointments scheduled.</div>
            ) : (
                <div style={s.apptList}>
                    {scheduled.map(apt => (
                        <div key={apt.id} style={s.apptCard}
                            onClick={() => navigate(`/patients/${apt.patient_id}`)}
                        >
                            <div style={s.apptLeft}>
                                <span style={s.apptDate}>{fmtDateTime(apt.scheduled_at)}</span>
                                <span style={s.apptPatient}>{apt.patient_name}</span>
                            </div>
                            <span style={getStatusStyle(apt.status)}>{apt.status}</span>
                        </div>
                    ))}
                </div>
            )}

            {recent.length > 0 && (
                <>
                    <p style={{ ...s.sectionTitle, marginTop: '28px' }}>RECENT HISTORY</p>
                    <div style={s.apptList}>
                        {recent.map(apt => (
                            <div key={apt.id} style={{ ...s.apptCard, opacity: 0.75 }}
                                onClick={() => navigate(`/patients/${apt.patient_id}`)}>
                                <div style={s.apptLeft}>
                                    <span style={s.apptDate}>{fmtDateTime(apt.scheduled_at)}</span>
                                    <span style={s.apptPatient}>{apt.patient_name}</span>
                                </div>
                                <span style={getStatusStyle(apt.status)}>{apt.status}</span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

// ── Nurse dashboard ──────────────────────────────────────────────
function NurseDashboard({ user, navigate }) {
    const [patientCount, setPatientCount] = useState(null)

    useEffect(() => {
        axiosInstance.get('/api/v1/patients/count')
            .then(r => setPatientCount(r.data.total))
            .catch(() => {})
    }, [])

    return (
        <div style={s.container}>
            <div style={s.welcomeCard}>
                <div>
                    <h2 style={s.welcome}>Good {getGreeting()}, {user?.full_name}</h2>
                    <p style={s.roleText}>{ROLE_LABELS.nurse}</p>
                </div>
                <p style={s.dateText}>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            </div>

            <div style={s.statsRow}>
                <div style={s.statCard}>
                    <span style={s.statNum}>{patientCount ?? '—'}</span>
                    <span style={s.statLabel}>Total Patients</span>
                </div>
            </div>

            <p style={s.sectionTitle}>QUICK ACCESS</p>
            <div style={s.grid}>
                <div style={s.card} onClick={() => navigate('/patients')}>
                    <h3 style={s.cardTitle}>Patients</h3>
                    <p style={s.cardDesc}>View patient records and record vitals</p>
                </div>
            </div>
        </div>
    )
}

function getGreeting() {
    const h = new Date().getHours()
    if (h < 12) return 'morning'
    if (h < 17) return 'afternoon'
    return 'evening'
}

// ── Main export ──────────────────────────────────────────────────
function Dashboard() {
    const { user } = useAuth()
    const navigate = useNavigate()

    useEffect(() => {
        if (user?.role === 'receptionist') navigate('/appointments', { replace: true })
    }, [user, navigate])

    if (!user || user.role === 'receptionist') return null

    if (user.role === 'admin') return <AdminDashboard user={user} navigate={navigate} />
    if (user.role === 'doctor') return <DoctorDashboard user={user} navigate={navigate} />
    if (user.role === 'nurse') return <NurseDashboard user={user} navigate={navigate} />
    return null
}

const s = {
    container: { maxWidth: '900px', margin: '0 auto' },
    welcomeCard: {
        backgroundColor: 'white', padding: '24px 28px', borderRadius: '12px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)', marginBottom: '20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
    },
    welcome: { color: '#1a365d', margin: '0 0 4px 0', fontSize: '22px' },
    roleText: { color: '#718096', margin: 0, fontSize: '13px' },
    dateText: { color: '#a0aec0', margin: 0, fontSize: '13px', textAlign: 'right' },
    statsRow: { display: 'flex', gap: '16px', marginBottom: '24px' },
    statCard: {
        backgroundColor: 'white', borderRadius: '10px', padding: '16px 28px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex',
        flexDirection: 'column', alignItems: 'center', borderTop: '3px solid #2b6cb0'
    },
    statNum: { fontSize: '32px', fontWeight: '700', color: '#2b6cb0', lineHeight: 1.2 },
    statLabel: { fontSize: '12px', color: '#718096', marginTop: '4px' },
    sectionTitle: {
        color: '#a0aec0', fontSize: '11px', fontWeight: '700',
        letterSpacing: '0.08em', marginBottom: '12px'
    },
    grid: {
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px',
        marginBottom: '8px'
    },
    card: {
        backgroundColor: 'white', padding: '20px 24px', borderRadius: '12px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)', cursor: 'pointer',
        borderTop: '4px solid #2b6cb0'
    },
    cardTitle: { margin: '0 0 6px 0', fontSize: '16px', color: '#2b6cb0' },
    cardDesc: { color: '#718096', margin: 0, fontSize: '13px', lineHeight: '1.5' },
    apptList: { display: 'flex', flexDirection: 'column', gap: '8px' },
    apptCard: {
        backgroundColor: 'white', borderRadius: '10px', padding: '14px 18px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center',
        cursor: 'pointer', borderLeft: '4px solid #2b6cb0'
    },
    apptLeft: { display: 'flex', flexDirection: 'column', gap: '2px' },
    apptDate: { fontSize: '13px', fontWeight: '600', color: '#2d3748' },
    apptPatient: { fontSize: '13px', color: '#718096' },
    emptyCard: {
        backgroundColor: 'white', borderRadius: '10px', padding: '32px',
        textAlign: 'center', color: '#a0aec0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
    },
    emptyText: { color: '#a0aec0', textAlign: 'center', padding: '20px' }
}

export default Dashboard
