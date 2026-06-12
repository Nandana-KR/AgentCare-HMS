import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

function Dashboard() {
    const { user } = useAuth()
    const navigate = useNavigate()

    const menuItems = [
        {
            title: 'Patients',
            description: 'View and manage patient records',
            path: '/patients',
            roles: ['admin', 'doctor', 'receptionist'],
            color: '#3182ce'
        },
        {
            title: 'Appointments',
            description: 'Book and manage appointments',
            path: '/appointments',
            roles: ['admin', 'doctor', 'receptionist'],
            color: '#38a169'
        },
        {
            title: 'Register Patient',
            description: 'Add a new patient to the system',
            path: '/patients/new',
            roles: ['admin', 'receptionist'],
            color: '#805ad5'
        }
    ]

    const allowedItems = menuItems.filter(
        item => item.roles.includes(user?.role)
    )

    return (
        <div style={styles.container}>
            <div style={styles.welcomeCard}>
                <h2 style={styles.welcome}>
                    Welcome back, {user?.full_name}
                </h2>
                <p style={styles.roleText}>
                    Logged in as {user?.role}
                </p>
            </div>

            <h3 style={styles.sectionTitle}>Quick Access</h3>

            <div style={styles.grid}>
                {allowedItems.map(item => (
                    <div
                        key={item.path}
                        style={{
                            ...styles.card,
                            borderTop: `4px solid ${item.color}`
                        }}
                        onClick={() => navigate(item.path)}
                    >
                        <h3 style={{
                            ...styles.cardTitle,
                            color: item.color
                        }}>
                            {item.title}
                        </h3>
                        <p style={styles.cardDesc}>
                            {item.description}
                        </p>
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
        padding: '24px',
        borderRadius: '12px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
        marginBottom: '24px'
    },
    welcome: {
        color: '#1a365d',
        margin: '0 0 4px 0'
    },
    roleText: {
        color: '#718096',
        margin: 0,
        textTransform: 'capitalize'
    },
    sectionTitle: {
        color: '#4a5568',
        marginBottom: '16px'
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '16px'
    },
    card: {
        backgroundColor: 'white',
        padding: '24px',
        borderRadius: '12px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
        cursor: 'pointer',
        transition: 'transform 0.1s'
    },
    cardTitle: {
        margin: '0 0 8px 0',
        fontSize: '18px'
    },
    cardDesc: {
        color: '#718096',
        margin: 0,
        fontSize: '14px'
    }
}

export default Dashboard