import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ROLE_GRADIENT = {
    admin:        'linear-gradient(135deg, #667eea, #764ba2)',
    doctor:       'linear-gradient(135deg, #0ea5e9, #2563eb)',
    nurse:        'linear-gradient(135deg, #10b981, #059669)',
    receptionist: 'linear-gradient(135deg, #f59e0b, #d97706)'
}

const ROLE_LABELS = {
    admin: 'Administrator',
    doctor: 'Physician',
    nurse: 'Nurse',
    receptionist: 'Receptionist'
}

function RoleIcon({ role }) {
    const p = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'white', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
    if (role === 'doctor') return (
        <svg {...p}>
            <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/>
            <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/>
            <circle cx="20" cy="10" r="2"/>
        </svg>
    )
    if (role === 'nurse') return (
        <svg {...p}>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            <line x1="12" y1="9" x2="12" y2="15"/><line x1="9" y1="12" x2="15" y2="12"/>
        </svg>
    )
    if (role === 'admin') return (
        <svg {...p}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <polyline points="9 12 11 14 15 10"/>
        </svg>
    )
    return (
        <svg {...p}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
        </svg>
    )
}

const TAB_DOT = {
    appointments: '#60a5fa',
    diagnoses:    '#a78bfa',
    vitals:       '#34d399',
    prognosis:    '#fbbf24'
}

function Sidebar() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    const patientDetailMatch = location.pathname.match(/^\/patients\/(?!new\b)([^/]+)$/)
    const isPatientDetail = !!patientDetailMatch
    const patientId = patientDetailMatch?.[1]
    const currentTab = new URLSearchParams(location.search).get('tab') || 'appointments'

    const isActive = (path) => location.pathname.startsWith(path)

    const getNavItems = () => {
        if (!user) return []
        return [
            { label: 'Dashboard',          path: '/dashboard',    roles: ['admin', 'doctor', 'receptionist', 'nurse'] },
            { label: 'Patients',           path: '/patients',     roles: ['admin', 'doctor', 'receptionist', 'nurse'] },
            { label: 'Appointments',       path: '/appointments', roles: ['admin', 'doctor', 'receptionist', 'nurse'] },
            { label: 'Diagnoses',          path: '/diagnoses',    roles: ['doctor', 'nurse'] },
            { label: 'Vitals',             path: '/vitals',       roles: ['doctor', 'nurse'] },
            { label: 'Prognosis',          path: '/prognosis',    roles: ['doctor', 'nurse'] },
            { label: '+ Register Patient', path: '/patients/new', roles: ['admin', 'receptionist'] },
            { label: 'Staff',              path: '/staff',        roles: ['admin'] }
        ].filter(item => item.roles.includes(user.role))
    }

    const getBottomItems = () => {
        if (!user) return []
        return [
            { label: 'Settings', path: '/settings', roles: ['admin', 'doctor', 'receptionist', 'nurse'] }
        ].filter(item => item.roles.includes(user.role))
    }

    const patientSections = [
        { label: 'Appointments', tab: 'appointments', roles: ['admin', 'doctor', 'receptionist', 'nurse'] },
        { label: 'Diagnoses',    tab: 'diagnoses',    roles: ['doctor', 'nurse'] },
        { label: 'Vitals',       tab: 'vitals',       roles: ['admin', 'doctor', 'receptionist', 'nurse'] },
        { label: 'Prognosis',    tab: 'prognosis',    roles: ['doctor', 'nurse'] }
    ].filter(s => s.roles.includes(user?.role))

    const avatarBg = ROLE_GRADIENT[user?.role] || ROLE_GRADIENT.admin

    const profileBlock = (
        <div style={s.profileSection}>
            <div style={{ ...s.avatar, background: avatarBg }}>
                <RoleIcon role={user?.role} />
            </div>
            <div style={s.profileInfo}>
                <span style={s.profileName}>{user?.full_name}</span>
                <span style={s.roleBadge}>
                    {ROLE_LABELS[user?.role] || user?.role}
                    {user?.department_name && ` · ${user.department_name}`}
                </span>
                {user?.supervisor_name && (
                    <span style={s.metaText}>Supervising: {user.supervisor_name}</span>
                )}
            </div>
        </div>
    )

    const logoutBtn = (
        <div style={s.bottom}>
            <div style={s.divider} />
            {getBottomItems().map(item => (
                <button
                    key={item.path}
                    style={{ ...s.navItem, ...(isActive(item.path) ? s.activeItem : {}), margin: '0 0 2px' }}
                    onClick={() => navigate(item.path)}
                >
                    <span style={{ ...s.tabDot, backgroundColor: isActive(item.path) ? '#60a5fa' : 'transparent' }} />
                    <span style={s.navLabel}>{item.label}</span>
                </button>
            ))}
            <button style={s.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>
    )

    if (isPatientDetail) {
        return (
            <div style={s.sidebar}>
                <div style={s.logoRow}>
                    <span style={s.logoCross}>+</span>
                    <span style={s.logoText}>HMS</span>
                </div>
                {profileBlock}
                <div style={s.divider} />
                <nav style={s.nav}>
                    <button style={s.backBtn} onClick={() => navigate('/patients')}>
                        ← Patients
                    </button>
                    <div style={s.sectionLabel}>PATIENT RECORD</div>
                    {patientSections.map(item => (
                        <button
                            key={item.tab}
                            style={{ ...s.navItem, ...(currentTab === item.tab ? s.activeItem : {}) }}
                            onClick={() => navigate(`/patients/${patientId}?tab=${item.tab}`)}
                        >
                            <span style={{ ...s.tabDot, backgroundColor: TAB_DOT[item.tab] || '#60a5fa' }} />
                            <span style={s.navLabel}>{item.label}</span>
                        </button>
                    ))}
                </nav>
                {logoutBtn}
            </div>
        )
    }

    return (
        <div style={s.sidebar}>
            <div style={s.logoRow}>
                <span style={s.logoCross}>+</span>
                <span style={s.logoText}>HMS</span>
            </div>
            {profileBlock}
            <div style={s.divider} />
            <nav style={s.nav}>
                {getNavItems().map(item => (
                    <button
                        key={item.path}
                        style={{ ...s.navItem, ...(isActive(item.path) ? s.activeItem : {}) }}
                        onClick={() => navigate(item.path)}
                    >
                        <span style={{ ...s.tabDot, backgroundColor: isActive(item.path) ? '#60a5fa' : 'transparent' }} />
                        <span style={s.navLabel}>{item.label}</span>
                    </button>
                ))}
            </nav>
            {logoutBtn}
        </div>
    )
}

const s = {
    sidebar: {
        width: '248px',
        minWidth: '248px',
        background: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto'
    },
    logoRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '24px 20px 16px'
    },
    logoCross: {
        fontSize: '24px',
        fontWeight: '900',
        color: '#f87171',
        lineHeight: 1
    },
    logoText: {
        color: 'white',
        fontSize: '22px',
        fontWeight: '700',
        letterSpacing: '3px'
    },
    profileSection: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '11px',
        margin: '0 12px 8px',
        padding: '13px 12px',
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.08)'
    },
    avatar: {
        width: '50px',
        height: '50px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: '700',
        fontSize: '20px',
        flexShrink: 0,
        boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
        border: '2px solid rgba(255,255,255,0.25)'
    },
    profileInfo: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        overflow: 'hidden',
        paddingTop: '2px'
    },
    profileName: {
        color: 'white',
        fontSize: '13px',
        fontWeight: '600',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
    },
    roleBadge: {
        display: 'inline-block',
        fontSize: '10px',
        fontWeight: '600',
        color: '#c4b5fd',
        backgroundColor: 'rgba(139,92,246,0.2)',
        borderRadius: '5px',
        padding: '2px 7px',
        alignSelf: 'flex-start',
        letterSpacing: '0.02em'
    },
    metaText: {
        color: 'rgba(255,255,255,0.38)',
        fontSize: '10px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
    },
    divider: {
        height: '1px',
        background: 'rgba(255,255,255,0.07)',
        margin: '6px 16px'
    },
    nav: {
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        padding: '4px 10px',
        flex: 1
    },
    sectionLabel: {
        fontSize: '10px',
        fontWeight: '700',
        color: 'rgba(255,255,255,0.28)',
        letterSpacing: '0.1em',
        padding: '10px 14px 4px'
    },
    backBtn: {
        display: 'flex',
        alignItems: 'center',
        padding: '9px 14px',
        backgroundColor: 'rgba(255,255,255,0.06)',
        color: '#93c5fd',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: '500',
        textAlign: 'left',
        width: '100%',
        marginBottom: '4px'
    },
    navItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '9px',
        padding: '9px 13px',
        backgroundColor: 'transparent',
        color: 'rgba(255,255,255,0.55)',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '13.5px',
        fontWeight: '500',
        textAlign: 'left',
        width: '100%'
    },
    activeItem: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        color: 'white'
    },
    tabDot: {
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        flexShrink: 0
    },
    navLabel: {
        flex: 1
    },
    bottom: {
        padding: '0 10px 18px'
    },
    logoutBtn: {
        display: 'flex',
        alignItems: 'center',
        padding: '10px 14px',
        backgroundColor: 'transparent',
        color: '#f87171',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '13.5px',
        fontWeight: '500',
        width: '100%'
    }
}

export default Sidebar
