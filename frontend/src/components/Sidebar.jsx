import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Sidebar() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    const isActive = (path) => location.pathname.startsWith(path)

    const getNavItems = () => {
        if (!user) return []

        const items = [
            {
                label: 'Dashboard',
                path: '/dashboard',
                icon: '🏠',
                roles: ['admin', 'doctor', 'receptionist']
            },
            {
                label: 'Patients',
                path: '/patients',
                icon: '👥',
                roles: ['admin', 'doctor', 'receptionist']
            },
            {
                label: 'Appointments',
                path: '/appointments',
                icon: '📅',
                roles: ['admin', 'doctor', 'receptionist']
            },
            {
                label: 'Register Patient',
                path: '/patients/new',
                icon: '➕',
                roles: ['admin', 'receptionist']
            }
        ]

        return items.filter(item =>
            item.roles.includes(user.role)
        )
    }

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    return (
        <div style={styles.sidebar}>

            {/* Logo */}
            <div style={styles.logo}>
                <span style={styles.logoIcon}>🏥</span>
                <span style={styles.logoText}>HMS</span>
            </div>

            {/* User info */}
            <div style={styles.userCard}>
                <div style={styles.avatar}>
                    {user?.full_name?.charAt(0).toUpperCase()}
                </div>
                <div style={styles.userInfo}>
                    <span style={styles.userName}>
                        {user?.full_name}
                    </span>
                    <span style={styles.userRole}>
                        {user?.role}
                    </span>
                </div>
            </div>

            {/* Divider */}
            <div style={styles.divider} />

            {/* Navigation */}
            <nav style={styles.nav}>
                {getNavItems().map(item => (
                    <button
                        key={item.path}
                        style={{
                            ...styles.navItem,
                            ...(isActive(item.path)
                                ? styles.activeItem
                                : {})
                        }}
                        onClick={() => navigate(item.path)}
                    >
                        <span style={styles.navIcon}>
                            {item.icon}
                        </span>
                        <span style={styles.navLabel}>
                            {item.label}
                        </span>
                        {isActive(item.path) && (
                            <div style={styles.activeDot} />
                        )}
                    </button>
                ))}
            </nav>

            {/* Logout at bottom */}
            <div style={styles.bottom}>
                <div style={styles.divider} />
                <button
                    style={styles.logoutBtn}
                    onClick={handleLogout}
                >
                    <span>🚪</span>
                    <span>Logout</span>
                </button>
            </div>
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
        padding: '24px 20px 16px',
    },
    logoIcon: {
        fontSize: '24px'
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
    divider: {
        height: '1px',
        backgroundColor: 'rgba(255,255,255,0.1)',
        margin: '8px 12px'
    },
    nav: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '8px 12px',
        flex: 1
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
    navIcon: {
        fontSize: '18px',
        width: '24px',
        textAlign: 'center'
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