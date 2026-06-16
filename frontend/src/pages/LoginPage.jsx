import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import axiosInstance from '../api/axiosInstance'

function EyeIcon({ open }) {
    return open ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
        </svg>
    ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
    )
}

function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)

    const { login } = useAuth()
    const navigate = useNavigate()

    const handleLogin = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const formData = new URLSearchParams()
            formData.append('username', email)
            formData.append('password', password)

            const response = await axiosInstance.post('/api/v1/auth/login', formData)
            const accessToken = response.data.access_token

            const userResponse = await axiosInstance.get('/me', {
                headers: { Authorization: `Bearer ${accessToken}` }
            })

            login(userResponse.data, accessToken)
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
                <div style={styles.logoArea}>
                    <div style={styles.logoBadge}>+</div>
                    <div>
                        <h2 style={styles.title}>HMS</h2>
                        <p style={styles.tagline}>Hospital Management System</p>
                    </div>
                </div>
                <p style={styles.subtitle}>Sign in to your account</p>

                <form onSubmit={handleLogin}>
                    <div style={styles.field}>
                        <label style={styles.label}>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={styles.input}
                            placeholder="Enter your email"
                            required
                        />
                    </div>

                    <div style={styles.field}>
                        <label style={styles.label}>Password</label>
                        <div style={styles.passwordWrapper}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={styles.passwordInput}
                                placeholder="Enter password"
                                required
                            />
                            <button
                                type="button"
                                style={styles.eyeBtn}
                                onClick={() => setShowPassword(v => !v)}
                                tabIndex={-1}
                            >
                                <EyeIcon open={showPassword} />
                            </button>
                        </div>
                    </div>

                    {error && <p style={styles.error}>{error}</p>}

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
    logoArea: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        marginBottom: '24px'
    },
    logoBadge: {
        width: '48px',
        height: '48px',
        backgroundColor: '#1a365d',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fc8181',
        fontSize: '28px',
        fontWeight: '900',
        lineHeight: 1,
        flexShrink: 0
    },
    title: {
        color: '#1a365d',
        margin: '0 0 2px 0',
        fontSize: '24px',
        fontWeight: '700',
        letterSpacing: '2px'
    },
    tagline: {
        color: '#718096',
        margin: 0,
        fontSize: '12px'
    },
    subtitle: {
        textAlign: 'center',
        color: '#4a5568',
        marginBottom: '24px',
        fontSize: '14px',
        paddingTop: '16px',
        borderTop: '1px solid #e2e8f0'
    },
    field: {
        marginBottom: '16px'
    },
    label: {
        display: 'block',
        marginBottom: '6px',
        color: '#4a5568',
        fontWeight: '500',
        fontSize: '14px'
    },
    input: {
        width: '100%',
        padding: '10px 12px',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        fontSize: '15px',
        boxSizing: 'border-box',
        outline: 'none'
    },
    passwordWrapper: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center'
    },
    passwordInput: {
        width: '100%',
        padding: '10px 44px 10px 12px',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        fontSize: '15px',
        boxSizing: 'border-box',
        outline: 'none'
    },
    eyeBtn: {
        position: 'absolute',
        right: '12px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: '#a0aec0',
        display: 'flex',
        alignItems: 'center',
        padding: '0'
    },
    button: {
        width: '100%',
        padding: '12px',
        backgroundColor: '#2b6cb0',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        fontSize: '16px',
        cursor: 'pointer',
        marginTop: '8px',
        fontWeight: '600'
    },
    error: {
        color: '#e53e3e',
        fontSize: '14px',
        marginBottom: '12px',
        textAlign: 'center'
    }
}

export default LoginPage
