import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Sidebar() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    // ── Detect patient detail context ────────────────────────────
    const patientDetailMatch = location.pathname.match(/^\/patients\/(?!new\b)([^/]+)$/)
    const isPatientDetail = !!patientDetailMatch
    const patientId = patientDetailMatch?.[1]
    const currentTab = new URLSearchParams(location.search).get('tab') || 'appointments'

    // ── Normal nav items ─────────────────────────────────────────
    const isActive = (path) => location.pathname.startsWith(path)

    const getNavItems = () => {
        if (!user) return []
        return [
            { label: 'Dashboard', path: '/dashboard', roles: ['admin', 'doctor', 'receptionist', 'nurse'] },
            { label: 'Patients', path: '/patients', roles: ['admin', 'doctor', 'receptionist', 'nurse'] },
            { label: 'Appointments', path: '/appointments', roles: ['admin', 'doctor', 'receptionist'] },
            { label: '+ Register Patient', path: '/patients/new', roles: ['admin', 'receptionist'] },
            { label: 'Staff', path: '/staff', roles: ['admin'] }
        ].filter(item => item.roles.includes(user.role))
    }

    // ── Patient context nav items ────────────────────────────────
    const patientSections = [
        { label: 'Appointments', tab: 'appointments', roles: ['admin', 'doctor', 'receptionist', 'nurse'] },
        { label: 'Diagnoses', tab: 'diagnoses', roles: ['doctor', 'nurse'] },
        { label: 'Vitals', tab: 'vitals', roles: ['admin', 'doctor', 'receptionist', 'nurse'] },
        { label: 'Prognosis', tab: 'prognosis', roles: ['doctor', 'nurse'] }
    ].filter(s => s.roles.includes(user?.role))

    const logoAndUser = (
        <>
            <div style={styles.logo}>
                <span style={styles.logoCross}>+</span>
                <span style={styles.logoText}>HMS</span>
            </div>

            <div style={styles.userCard}>
                <div style={styles.avatar}>
                    {user?.full_name?.charAt(0).toUpperCase()}
                </div>
                <div style={styles.userInfo}>
                    <span style={styles.userName}>{user?.full_name}</span>
                    <span style={styles.userRole}>{user?.role}</span>
                    {user?.department_name && (
                        <span style={styles.userDept}>{user.department_name}</span>
                    )}
                    {user?.supervisor_name && (
                        <span style={styles.userDept}>Reports to: {user.supervisor_name}</span>
                    )}
                </div>
            </div>

            <div style={styles.divider} />
        </>
    )

    const logoutBtn = (
        <div style={styles.bottom}>
            <div style={styles.divider} />
            <button style={styles.logoutBtn} onClick={handleLogout}>
                Logout
            </button>
        </div>
    )

    // ── Patient context sidebar ──────────────────────────────────
    if (isPatientDetail) {
        return (
            <div style={styles.sidebar}>
                {logoAndUser}

                <nav style={styles.nav}>
                    <button
                        style={styles.backBtn}
                        onClick={() => navigate('/patients')}
                    >
                        ← Patients
                    </button>

                    <div style={styles.sectionLabel}>PATIENT RECORD</div>

                    {patientSections.map(item => (
                        <button
                            key={item.tab}
                            style={{
                                ...styles.navItem,
                                ...(currentTab === item.tab ? styles.activeItem : {})
                            }}
                            onClick={() => navigate(`/patients/${patientId}?tab=${item.tab}`)}
                        >
                            <span style={styles.navLabel}>{item.label}</span>
                            {currentTab === item.tab && <div style={styles.activeDot} />}
                        </button>
                    ))}
                </nav>

                {logoutBtn}
            </div>
        )
    }

    // ── Normal sidebar ───────────────────────────────────────────
    return (
        <div style={styles.sidebar}>
            {logoAndUser}

            <nav style={styles.nav}>
                {getNavItems().map(item => (
                    <button
                        key={item.path}
                        style={{
                            ...styles.navItem,
                            ...(isActive(item.path) ? styles.activeItem : {})
                        }}
                        onClick={() => navigate(item.path)}
                    >
                        <span style={styles.navLabel}>{item.label}</span>
                        {isActive(item.path) && <div style={styles.activeDot} />}
                    </button>
                ))}
            </nav>

            {logoutBtn}
        </div>
    )
}

const styles = {
    sidebar: {
        width: '240px',
        minWidth: '240px',
        backgroundColor: '#1a365d',
        display: 'flex',
        flexDirection: 'column',
        padding: '0',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto'
    },
    logo: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '24px 20px 16px'
    },
    logoCross: {
        fontSize: '22px',
        fontWeight: '900',
        color: '#fc8181',
        lineHeight: 1
    },
    logoText: {
        color: 'white',
        fontSize: '22px',
        fontWeight: '700',
        letterSpacing: '2px'
    },
    userCard: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 20px',
        backgroundColor: 'rgba(255,255,255,0.08)',
        margin: '0 12px 12px',
        borderRadius: '10px'
    },
    avatar: {
        width: '36px',
        height: '36px',
        backgroundColor: '#3182ce',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: '700',
        fontSize: '16px',
        flexShrink: 0
    },
    userInfo: {
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
    },
    userName: {
        color: 'white',
        fontSize: '13px',
        fontWeight: '600',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
    },
    userRole: {
        color: '#90cdf4',
        fontSize: '11px',
        textTransform: 'capitalize'
    },
    userDept: {
        color: '#bee3f8',
        fontSize: '10px',
        fontStyle: 'italic'
    },
    divider: {
        height: '1px',
        backgroundColor: 'rgba(255,255,255,0.1)',
        margin: '8px 12px'
    },
    nav: {
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        padding: '4px 12px',
        flex: 1
    },
    sectionLabel: {
        fontSize: '10px',
        fontWeight: '700',
        color: 'rgba(255,255,255,0.35)',
        letterSpacing: '0.1em',
        padding: '12px 14px 4px'
    },
    backBtn: {
        display: 'flex',
        alignItems: 'center',
        padding: '10px 14px',
        backgroundColor: 'rgba(255,255,255,0.06)',
        color: '#90cdf4',
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
        gap: '12px',
        padding: '10px 14px',
        backgroundColor: 'transparent',
        color: '#bee3f8',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500',
        textAlign: 'left',
        position: 'relative',
        width: '100%'
    },
    activeItem: {
        backgroundColor: '#2b6cb0',
        color: 'white'
    },
    navLabel: {
        flex: 1
    },
    activeDot: {
        width: '6px',
        height: '6px',
        backgroundColor: '#63b3ed',
        borderRadius: '50%'
    },
    bottom: {
        padding: '0 12px 16px'
    },
    logoutBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 14px',
        backgroundColor: 'transparent',
        color: '#fc8181',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500',
        width: '100%'
    }
}

export default Sidebar
