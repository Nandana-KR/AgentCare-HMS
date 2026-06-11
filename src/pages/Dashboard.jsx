import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

function Dashboard() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h1 style={styles.title}>Dashboard</h1>
                <button onClick={handleLogout} style={styles.logoutBtn}>
                    Logout
                </button>
            </div>

            <div style={styles.welcomeCard}>
                <h2>Welcome, {user?.full_name}</h2>
                <p>Role: {user?.role}</p>
                <p>Email: {user?.email}</p>
            </div>
        </div>
    )
}

const styles = {
    container: {
        padding: '24px',
        maxWidth: '1200px',
        margin: '0 auto'
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
    },
    title: {
        color: '#1a365d'
    },
    welcomeCard: {
        backgroundColor: 'white',
        padding: '24px',
        borderRadius: '12px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)'
    },
    logoutBtn: {
        padding: '8px 16px',
        backgroundColor: '#e53e3e',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer'
    }
}

export default Dashboard