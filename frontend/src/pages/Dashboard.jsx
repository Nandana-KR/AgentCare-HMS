import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import axiosInstance from '../api/axiosInstance'
import { fetchAppointmentsWithPhone, drName, displayName } from '../utils/mergePhone'
import { glass } from '../styles/glass'

const ROLE_LABELS = {
    admin:        'System Administrator',
    doctor:       'Physician',
    receptionist: 'Receptionist',
    nurse:        'Nurse'
}

const CARD_COLORS = [
    { accent: '#3b82f6', light: 'rgba(59,130,246,0.07)'  },
    { accent: '#8b5cf6', light: 'rgba(139,92,246,0.07)'  },
    { accent: '#10b981', light: 'rgba(16,185,129,0.07)'  },
    { accent: '#f59e0b', light: 'rgba(245,158,11,0.07)'  }
]

const toLocal = d => d && !String(d).endsWith('Z') ? d + 'Z' : d
const fmtTime = d => new Date(toLocal(d)).toLocaleString('en-GB', {
    hour: '2-digit', minute: '2-digit'
})

const fmtDateTime = d => new Date(toLocal(d)).toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit'
})

const isToday = d => {
    const t = new Date(toLocal(d)), now = new Date()
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
    const [appointments, setAppointments] = useState([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        Promise.allSettled([
            axiosInstance.get('/api/v1/patients/count'),
            fetchAppointmentsWithPhone()
        ]).then(([p, a]) => {
            setStats({
                patients:     p.status === 'fulfilled' ? p.value.data.total : '—',
                appointments: a.status === 'fulfilled' ? a.value.length : '—'
            })
            if (a.status === 'fulfilled') setAppointments(a.value)
        }).finally(() => setLoading(false))
    }, [])

    const todayApts = useMemo(() =>
        appointments
            .filter(a => a.status === 'scheduled' && isToday(a.scheduled_at))
            .filter(a => !search || a.patient_name?.toLowerCase().includes(search.toLowerCase()) || a.patient_phone?.includes(search) || a.doctor_name?.toLowerCase().includes(search.toLowerCase()))
            .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)),
        [appointments, search])

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
                <StatCard value={todayApts.length}   label="Today's Schedule" />
            </div>
            <ScheduleTable title="TODAY'S SCHEDULE" appointments={todayApts} search={search} setSearch={setSearch} loading={loading} navigate={navigate} allAppointments={appointments} showDoctorFilter />
            <p style={{ ...s.sectionTitle, marginTop: '24px' }}>QUICK ACCESS</p>
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
    const [search, setSearch] = useState('')

    useEffect(() => {
        fetchAppointmentsWithPhone()
            .then(data => setAppointments(data))
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [])

    const todayScheduled = useMemo(() =>
        appointments
            .filter(a => a.status === 'scheduled' && isToday(a.scheduled_at))
            .filter(a => !search || a.patient_name?.toLowerCase().includes(search.toLowerCase()))
            .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)),
        [appointments, search])

    const upcoming = useMemo(() =>
        appointments
            .filter(a => a.status === 'scheduled' && !isToday(a.scheduled_at))
            .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
            .slice(0, 5),
        [appointments])

    return (
        <div style={s.container}>
            <WelcomeCard user={user} />
            <div style={s.statsRow}>
                <StatCard value={todayScheduled.length} label="Today's Appointments" />
                <StatCard value={appointments.filter(a => a.status === 'scheduled').length} label="Total Scheduled" />
            </div>
            <ScheduleTable title="TODAY'S SCHEDULE" appointments={todayScheduled} search={search} setSearch={setSearch} loading={loading} navigate={navigate} />
            {upcoming.length > 0 && (
                <>
                    <p style={{ ...s.sectionTitle, marginTop: '24px' }}>UPCOMING</p>
                    <div style={{ ...glass, overflow: 'hidden' }}>
                        <table style={s.table}>
                            <thead><tr style={s.thead}>
                                <th style={s.th}>Date</th><th style={s.th}>Patient</th><th style={s.th}>Status</th><th style={s.th}></th>
                            </tr></thead>
                            <tbody>
                                {upcoming.map(apt => (
                                    <tr key={apt.id} style={s.trow}>
                                        <td style={s.td}>{fmtDateTime(apt.scheduled_at)}</td>
                                        <td style={{ ...s.td, fontWeight: '600', color: '#0f172a' }}>{apt.patient_name}</td>
                                        <td style={s.td}><span style={getStatusStyle(apt.status)}>{apt.status}</span></td>
                                        <td style={s.td}><button style={s.viewBtn} onClick={() => navigate(`/patients/${apt.patient_id}`)}>View</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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
    const [search, setSearch] = useState('')

    useEffect(() => {
        Promise.allSettled([
            fetchAppointmentsWithPhone(),
            axiosInstance.get('/api/v1/patients/count')
        ]).then(([a, p]) => {
            if (a.status === 'fulfilled') setAppointments(a.value)
            if (p.status === 'fulfilled') setPatientCount(p.value.data.total)
        }).finally(() => setLoading(false))
    }, [])

    const todayApts = useMemo(() =>
        appointments
            .filter(a => isToday(a.scheduled_at) && a.status === 'scheduled')
            .filter(a => !search || a.patient_name?.toLowerCase().includes(search.toLowerCase()))
            .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)),
        [appointments, search])

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
            <ScheduleTable title="TODAY'S APPOINTMENTS" appointments={todayApts} search={search} setSearch={setSearch} loading={loading} navigate={navigate} allAppointments={appointments} showDoctorFilter />
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
    const [appointments, setAppointments] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    useEffect(() => {
        Promise.allSettled([
            axiosInstance.get('/api/v1/patients/count'),
            fetchAppointmentsWithPhone()
        ]).then(([p, a]) => {
            if (p.status === 'fulfilled') setPatientCount(p.value.data.total)
            if (a.status === 'fulfilled') setAppointments(a.value)
        }).finally(() => setLoading(false))
    }, [])

    const todayApts = useMemo(() =>
        appointments
            .filter(a => isToday(a.scheduled_at) && a.status === 'scheduled')
            .filter(a => !search || a.patient_name?.toLowerCase().includes(search.toLowerCase()))
            .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)),
        [appointments, search])

    return (
        <div style={s.container}>
            <WelcomeCard user={user} />
            <div style={s.statsRow}>
                <StatCard value={patientCount ?? '—'} label="Total Patients" />
                <StatCard value={todayApts.length} label="Today's Schedule" />
            </div>
            <ScheduleTable title="TODAY'S SCHEDULE" appointments={todayApts} search={search} setSearch={setSearch} loading={loading} navigate={navigate} />
            <p style={{ ...s.sectionTitle, marginTop: '24px' }}>QUICK ACCESS</p>
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
                <h2 style={s.welcome}>{greeting}{displayName(user?.full_name, user?.role)}</h2>
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

function ScheduleTable({ title, appointments, search, setSearch, loading, navigate, allAppointments, showDoctorFilter }) {
    const [docFilter, setDocFilter] = useState('all')
    const [doctors, setDoctorsList] = useState([])
    useEffect(() => {
        if (!showDoctorFilter) return
        axiosInstance.get('/api/v1/users/').catch(() => ({ data: [] })).then(res => {
            const staff = res.data.filter(s => s.role === 'doctor').map(s => drName(s.full_name))
            const apt = new Set()
            ;(allAppointments || appointments).forEach(a => { if (a.doctor_name) apt.add(a.doctor_name) })
            setDoctorsList(Array.from(new Set([...staff, ...apt])).sort())
        })
    }, [showDoctorFilter, allAppointments, appointments])

    const filtered = docFilter === 'all' ? appointments : appointments.filter(a => a.doctor_name === docFilter)

    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <p style={{ ...s.sectionTitle, margin: 0 }}>{title} ({filtered.length})</p>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {showDoctorFilter && doctors.length > 0 && (
                        <select style={s.searchInput} value={docFilter} onChange={e => setDocFilter(e.target.value)}>
                            <option value="all">All Doctors</option>
                            {doctors.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    )}
                    <input
                        style={s.searchInput}
                        placeholder="Search name or phone..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>
            {loading ? <p style={s.emptyText}>Loading...</p> :
             filtered.length === 0 ? <div style={s.emptyCard}>{search || docFilter !== 'all' ? 'No matching appointments.' : 'No appointments scheduled today.'}</div> : (
                <div style={{ ...glass, overflow: 'hidden' }}>
                    <table style={s.table}>
                        <thead><tr style={s.thead}>
                            <th style={s.th}>Time</th>
                            <th style={s.th}>Patient</th>
                            <th style={s.th}>Phone</th>
                            <th style={s.th}>Age</th>
                            <th style={s.th}>Doctor</th>
                            <th style={s.th}>Status</th>
                            <th style={s.th}></th>
                        </tr></thead>
                        <tbody>
                            {filtered.map(apt => (
                                <tr key={apt.id} style={s.trow}>
                                    <td style={{ ...s.td, fontWeight: '600', whiteSpace: 'nowrap' }}>{fmtTime(apt.scheduled_at)}</td>
                                    <td style={{ ...s.td, fontWeight: '600', color: '#0f172a' }}>{apt.patient_name}</td>
                                    <td style={{ ...s.td, color: '#64748b' }}>{apt.patient_phone || '—'}</td>
                                    <td style={{ ...s.td, color: '#64748b' }}>{apt.patient_age || '—'}</td>
                                    <td style={{ ...s.td, color: '#64748b' }}>{apt.doctor_name || '—'}</td>
                                    <td style={s.td}><span style={getStatusStyle(apt.status)}>{apt.status}</span></td>
                                    <td style={s.td}>
                                        <button style={s.viewBtn} onClick={() => navigate(`/patients/${apt.patient_id}`)}>View</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
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

    searchInput: {
        padding: '8px 14px', border: '1.5px solid #e2e8f0', borderRadius: '10px',
        fontSize: '13px', outline: 'none', color: '#0f172a',
        background: '#f8fafc', cursor: 'pointer'
    },

    table: { width: '100%', borderCollapse: 'collapse' },
    thead: { background: 'linear-gradient(135deg, #0f172a, #1e3a8a)' },
    th: { padding: '11px 16px', textAlign: 'left', color: 'white', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' },
    td: { padding: '12px 16px', fontSize: '14px', borderBottom: '1px solid rgba(226,232,240,0.5)' },
    trow: { cursor: 'pointer' },
    viewBtn: { padding: '5px 14px', fontSize: '12px', fontWeight: '600', color: '#3b82f6', background: 'rgba(59,130,246,0.1)', border: '1.5px solid rgba(59,130,246,0.2)', borderRadius: '6px', cursor: 'pointer' },

    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px', marginBottom: '8px' },
    card: i => ({
        ...glass,
        padding: '20px 22px', cursor: 'pointer',
        borderTop: `4px solid ${CARD_COLORS[i % 4].accent}`,
        background: `linear-gradient(160deg, ${CARD_COLORS[i % 4].light} 0%, rgba(255,255,255,0.85) 100%)`
    }),
    cardTitle: i => ({ margin: '0 0 6px', fontSize: '15px', fontWeight: '700', color: CARD_COLORS[i % 4].accent }),
    cardDesc: { color: '#64748b', margin: 0, fontSize: '13px', lineHeight: '1.5' },

    emptyCard: { ...glass, padding: '32px', textAlign: 'center', color: '#94a3b8' },
    emptyText: { color: '#94a3b8', textAlign: 'center', padding: '20px' }
}

export default Dashboard
