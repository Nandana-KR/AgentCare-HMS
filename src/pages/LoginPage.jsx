import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import axiosInstance from '../api/axiosInstance'

function LoginPage() {
    // Store form values
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)

    const { login } = useAuth()
    const navigate = useNavigate()

    const handleLogin = async (e) => {
        // Prevent page reload on form submit
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            // Step 1 — login and get token
            // OAuth2 requires form data not JSON
            const formData = new URLSearchParams()
            formData.append('username', email)
            formData.append('password', password)

            const response = await axiosInstance.post(
                '/api/v1/auth/login',
                formData
            )

            const accessToken = response.data.access_token

            // Step 2 — get current user profile
            const userResponse = await axiosInstance.get('/me', {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            })

            // Step 3 — save to context and localStorage
            login(userResponse.data, accessToken)

            // Step 4 — redirect to dashboard
            navigate('/dashboard')

        } catch (err) {
            setError('Invalid email or password')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h2 style={styles.title}>Hospital Management System</h2>
                <p style={styles.subtitle}>Sign in to your account</p>

                <form onSubmit={handleLogin}>
                    <div style={styles.field}>
                        <label style={styles.label}>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={styles.input}
                            placeholder="doctor@hms.com"
                            required
                        />
                    </div>

                    <div style={styles.field}>
                        <label style={styles.label}>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={styles.input}
                            placeholder="Enter password"
                            required
                        />
                    </div>

                    {error && (
                        <p style={styles.error}>{error}</p>
                    )}

                    <button
                        type="submit"
                        style={styles.button}
                        disabled={loading}
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    )
}

const styles = {
    container: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f0f4f8'
    },
    card: {
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '12px',
        width: '400px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
    },
    title: {
        textAlign: 'center',
        color: '#1a365d',
        marginBottom: '8px'
    },
    subtitle: {
        textAlign: 'center',
        color: '#718096',
        marginBottom: '24px'
    },
    field: {
        marginBottom: '16px'
    },
    label: {
        display: 'block',
        marginBottom: '6px',
        color: '#4a5568',
        fontWeight: '500'
    },
    input: {
        width: '100%',
        padding: '10px 12px',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        fontSize: '16px',
        boxSizing: 'border-box'
    },
    button: {
        width: '100%',
        padding: '12px',
        backgroundColor: '#3182ce',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        fontSize: '16px',
        cursor: 'pointer',
        marginTop: '8px'
    },
    error: {
        color: '#e53e3e',
        fontSize: '14px',
        marginBottom: '12px'
    }
}

export default LoginPage