import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import axiosInstance from '../api/axiosInstance'

const ROLE_LABELS = {
    admin:        'System Administrator',
    doctor:       'Physician',
    receptionist: 'Receptionist',
    nurse:        'Nurse'
}

const glass = {
    background: 'rgba(255,255,255,0.78)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.6)',
    borderRadius: '16px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.06)'
}

const CARD_COLORS = [
    { accent: '#3b82f6', light: 'rgba(59,130,246,0.07)'  },
    { accent: '#8b5cf6', light: 'rgba(139,92,246,0.07)'  },
    { accent: '#10b981', light: 'rgba(16,185,129,0.07)'  },
    { accent: '#f59e0b', light: 'rgba(245,158,11,0.07)'  }
]

const fmtDateTime = d => new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit'
})

const isToday = d => {
    const t = new Date(d), now = new Date()
    return t.getDate() === now.getDate() &&
           t.getMonth() === now.getMonth() &&
           t.getFullYear() === now.getFullYear()
}

function getGreeting() {
    const h = new Date().getHours()
    if (h < 12) return 'morning'
    if (h < 17) return 'afternoon'
    return 'evening'
}

const getStatusStyle = status => ({
    padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600',
    backgroundColor: status === 'completed' ? '#dcfce7' : status === 'cancelled' ? '#fee2e2' : '#dbeafe',
    color:           status === 'completed' ? '#166534' : status === 'cancelled' ? '#991b1b' : '#1e40af'
})

// ── Admin ────────────────────────────────────────────────────────
function AdminDashboard({ user, navigate }) {
    const [stats, setStats] = useState({ patients: null, appointments: null })

    useEffect(() => {
        Promise.allSettled([
            axiosInstance.get('/api/v1/patients/count'),
            axiosInstance.get('/api/v1/appointments/')
        ]).then(([p, a]) => setStats({
            patients:     p.status === 'fulfilled' ? p.value.data.total : '—',
            appointments: a.status === 'fulfilled' ? a.value.data.length : '—'
        }))
    }, [])

    const links = [
        { title: 'Patients',          desc: 'View and manage patient records', path: '/patients' },
        { title: 'Appointments',      desc: 'View all appointments',           path: '/appointments' },
        { title: 'Staff Management',  desc: 'Manage roles and departments',    path: '/staff' },
        { title: '+ Register Patient',desc: 'Add a new patient to the system', path: '/patients/new' }
    ]

    return (
        <div style={s.container}>
            <WelcomeCard user={user} />
            <div style={s.statsRow}>
                <StatCard value={stats.patients}     label="Total Patients" />
                <StatCard value={stats.appointments} label="Total Appointments" />
            </div>
            <p style={s.sectionTitle}>QUICK ACCESS</p>
            <div style={s.grid}>
                {links.map((item, i) => (
                    <div key={item.path} style={s.card(i)} onClick={() => navigate(item.path)}>
                        <h3 style={s.cardTitle(i)}>{item.title}</h3>
                        <p style={s.cardDesc}>{item.desc}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ── Doctor ───────────────────────────────────────────────────────
function DoctorDashboard({ user, navigate }) {
    const [appointments, setAppointments] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        axiosInstance.get('/api/v1/appointments/')
            .then(r => setAppointments(r.data))
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [])

    const todayScheduled = appointments.filter(a => a.status === 'scheduled' && isToday(a.scheduled_at))
    const upcoming       = appointments.filter(a => a.status === 'scheduled' && !isToday(a.scheduled_at))
                                       .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
                                       .slice(0, 5)

    return (
        <div style={s.container}>
            <WelcomeCard user={user} />
            <div style={s.statsRow}>
                <StatCard value={todayScheduled.length} label="Today's Appointments" />
                <StatCard value={appointments.filter(a => a.status === 'scheduled').length} label="Total Scheduled" />
            </div>

            <p style={s.sectionTitle}>TODAY'S SCHEDULE ({todayScheduled.length})</p>
            {loading ? <p style={s.emptyText}>Loading...</p> :
             todayScheduled.length === 0 ? <div style={s.emptyCard}>No appointments today.</div> : (
                <div style={s.apptList}>
                    {todayScheduled.sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)).map(apt => (
                        <ApptRow key={apt.id} apt={apt} navigate={navigate} />
                    ))}
                </div>
            )}

            {upcoming.length > 0 && (
                <>
                    <p style={{ ...s.sectionTitle, marginTop: '24px' }}>UPCOMING</p>
                    <div style={s.apptList}>
                        {upcoming.map(apt => <ApptRow key={apt.id} apt={apt} navigate={navigate} />)}
                    </div>
                </>
            )}
        </div>
    )
}

// ── Receptionist ─────────────────────────────────────────────────
function ReceptionistDashboard({ user, navigate }) {
    const [appointments, setAppointments] = useState([])
    const [patientCount, setPatientCount] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        Promise.allSettled([
            axiosInstance.get('/api/v1/appointments/'),
            axiosInstance.get('/api/v1/patients/count')
        ]).then(([a, p]) => {
            if (a.status === 'fulfilled') setAppointments(a.value.data)
            if (p.status === 'fulfilled') setPatientCount(p.value.data.total)
        }).finally(() => setLoading(false))
    }, [])

    const todayApts = appointments
        .filter(a => isToday(a.scheduled_at) && a.status === 'scheduled')
        .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))

    const links = [
        { title: '+ Book Appointment', desc: 'Schedule a new appointment',     path: '/appointments/new', i: 0 },
        { title: '+ Register Patient', desc: 'Add a new patient to the system', path: '/patients/new',    i: 1 },
        { title: 'All Appointments',   desc: 'View and manage appointments',    path: '/appointments',     i: 2 },
        { title: 'Patients',           desc: 'Browse patient records',          path: '/patients',         i: 3 }
    ]

    return (
        <div style={s.container}>
            <WelcomeCard user={user} />
            <div style={s.statsRow}>
                <StatCard value={todayApts.length} label="Today's Scheduled" />
                <StatCard value={patientCount ?? '—'} label="Total Patients" />
            </div>

            <p style={s.sectionTitle}>TODAY'S APPOINTMENTS ({todayApts.length})</p>
            {loading ? <p style={s.emptyText}>Loading...</p> :
             todayApts.length === 0 ? <div style={s.emptyCard}>No appointments scheduled today.</div> : (
                <div style={s.apptList}>
                    {todayApts.map(apt => <ApptRow key={apt.id} apt={apt} navigate={navigate} />)}
                </div>
            )}

            <p style={{ ...s.sectionTitle, marginTop: '24px' }}>QUICK ACCESS</p>
            <div style={s.grid}>
                {links.map(item => (
                    <div key={item.path} style={s.card(item.i)} onClick={() => navigate(item.path)}>
                        <h3 style={s.cardTitle(item.i)}>{item.title}</h3>
                        <p style={s.cardDesc}>{item.desc}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ── Nurse ────────────────────────────────────────────────────────
function NurseDashboard({ user, navigate }) {
    const [patientCount, setPatientCount] = useState(null)

    useEffect(() => {
        axiosInstance.get('/api/v1/patients/count')
            .then(r => setPatientCount(r.data.total))
            .catch(() => {})
    }, [])

    return (
        <div style={s.container}>
            <WelcomeCard user={user} />
            <div style={s.statsRow}>
                <StatCard value={patientCount ?? '—'} label="Total Patients" />
            </div>
            <p style={s.sectionTitle}>QUICK ACCESS</p>
            <div style={s.grid}>
                <div style={s.card(0)} onClick={() => navigate('/patients')}>
                    <h3 style={s.cardTitle(0)}>Patients</h3>
                    <p style={s.cardDesc}>View patient records and record vitals</p>
                </div>
                <div style={s.card(1)} onClick={() => navigate('/appointments')}>
                    <h3 style={s.cardTitle(1)}>Appointments</h3>
                    <p style={s.cardDesc}>View and book appointments</p>
                </div>
            </div>
        </div>
    )
}

// ── Shared components ─────────────────────────────────────────────
function WelcomeCard({ user }) {
    const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const greeting = ['doctor', 'nurse', 'receptionist'].includes(user?.role) ? `Good ${getGreeting()}, ` : 'Welcome back, '
    return (
        <div style={s.welcomeCard}>
            <div>
                <h2 style={s.welcome}>{greeting}{user?.full_name}</h2>
                <p style={s.roleText}>
                    {ROLE_LABELS[user?.role]}
                    {user?.department_name ? ` · ${user.department_name}` : ''}
                </p>
            </div>
            <p style={s.dateText}>{today}</p>
        </div>
    )
}

function StatCard({ value, label }) {
    return (
        <div style={s.statCard}>
            <span style={s.statNum}>{value}</span>
            <span style={s.statLabel}>{label}</span>
        </div>
    )
}

function ApptRow({ apt, navigate }) {
    return (
        <div style={s.apptCard} onClick={() => navigate(`/patients/${apt.patient_id}`)}>
            <div style={s.apptLeft}>
                <span style={s.apptDate}>{fmtDateTime(apt.scheduled_at)}</span>
                <span style={s.apptPatient}>{apt.patient_name}</span>
            </div>
            <span style={getStatusStyle(apt.status)}>{apt.status}</span>
        </div>
    )
}

// ── Main ─────────────────────────────────────────────────────────
function Dashboard() {
    const { user } = useAuth()
    const navigate = useNavigate()
    if (!user) return null

    if (user.role === 'admin')        return <AdminDashboard        user={user} navigate={navigate} />
    if (user.role === 'doctor')       return <DoctorDashboard       user={user} navigate={navigate} />
    if (user.role === 'receptionist') return <ReceptionistDashboard user={user} navigate={navigate} />
    if (user.role === 'nurse')        return <NurseDashboard        user={user} navigate={navigate} />
    return null
}

// ── Styles ────────────────────────────────────────────────────────
const s = {
    container: { maxWidth: '900px', margin: '0 auto' },

    welcomeCard: {
        ...glass,
        padding: '24px 28px', marginBottom: '22px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(255,255,255,0.82) 60%)',
        borderLeft: '5px solid #3b82f6'
    },
    welcome:  { color: '#0f172a', margin: '0 0 4px', fontSize: '22px', fontWeight: '700' },
    roleText: { color: '#64748b', margin: 0, fontSize: '13px' },
    dateText: { color: '#94a3b8', margin: 0, fontSize: '13px', textAlign: 'right' },

    statsRow: { display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' },
    statCard: {
        ...glass,
        padding: '20px 32px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        flex: '1', minWidth: '140px'
    },
    statNum: {
        fontSize: '36px', fontWeight: '800', lineHeight: 1.1,
        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
    },
    statLabel: { fontSize: '12px', color: '#64748b', marginTop: '6px', fontWeight: '500' },

    sectionTitle: { color: '#94a3b8', fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', marginBottom: '12px', marginTop: '4px' },

    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px', marginBottom: '8px' },
    card: i => ({
        ...glass,
        padding: '20px 22px', cursor: 'pointer',
        borderTop: `4px solid ${CARD_COLORS[i % 4].accent}`,
        background: `linear-gradient(160deg, ${CARD_COLORS[i % 4].light} 0%, rgba(255,255,255,0.85) 100%)`
    }),
    cardTitle: i => ({ margin: '0 0 6px', fontSize: '15px', fontWeight: '700', color: CARD_COLORS[i % 4].accent }),
    cardDesc: { color: '#64748b', margin: 0, fontSize: '13px', lineHeight: '1.5' },

    apptList: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '4px' },
    apptCard: {
        ...glass,
        padding: '13px 18px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        cursor: 'pointer', borderLeft: '4px solid #3b82f6'
    },
    apptLeft:    { display: 'flex', flexDirection: 'column', gap: '2px' },
    apptDate:    { fontSize: '13px', fontWeight: '600', color: '#1e293b' },
    apptPatient: { fontSize: '13px', color: '#64748b' },

    emptyCard: { ...glass, padding: '32px', textAlign: 'center', color: '#94a3b8' },
    emptyText: { color: '#94a3b8', textAlign: 'center', padding: '20px' }
}

export default Dashboard
