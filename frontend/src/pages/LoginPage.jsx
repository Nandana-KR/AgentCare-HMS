import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import axiosInstance from '../api/axiosInstance'
import hospitalImg from '../assets/hospital.jpg'

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

const FEATURES = [
    'Patient & appointment management',
    'Clinical diagnosis & AI prognosis',
    'Multi-role access control',
    'Real-time vitals & medical records'
]

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
        <div style={s.page}>

            {/* ── Left panel — hospital image ── */}
            <div style={{ ...s.left, backgroundImage: `url(${hospitalImg})` }}>
                <div style={s.overlay}>
                    <div style={s.brand}>
                        <div style={s.logoMark}>+</div>
                        <div>
                            <div style={s.logoName}>HMS</div>
                            <div style={s.logoTagline}>Hospital Management System</div>
                        </div>
                    </div>

                    <div style={s.heroText}>
                        <h1 style={s.heroTitle}>
                            Smarter Healthcare,<br />Better Outcomes
                        </h1>
                        <p style={s.heroSub}>
                            A complete platform for managing patients,
                            staff, appointments and clinical records.
                        </p>
                    </div>

                    <div style={s.featureList}>
                        {FEATURES.map(f => (
                            <div key={f} style={s.featureRow}>
                                <span style={s.featureCheck}>✓</span>
                                <span style={s.featureLabel}>{f}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Right panel — login form ── */}
            <div style={s.right}>
                <div style={s.card}>
                    <div style={s.cardLogo}>
                        <div style={s.cardLogoMark}>+</div>
                        <div>
                            <div style={s.cardLogoName}>HMS</div>
                            <div style={s.cardLogoSub}>Hospital Management</div>
                        </div>
                    </div>

                    <h2 style={s.cardTitle}>Welcome back</h2>
                    <p style={s.cardSub}>Sign in to your account to continue</p>

                    <form onSubmit={handleLogin} style={s.form}>
                        <div style={s.field}>
                            <label style={s.label}>Email address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                style={s.input}
                                placeholder="you@hms.com"
                                required
                            />
                        </div>

                        <div style={s.field}>
                            <label style={s.label}>Password</label>
                            <div style={s.pwWrap}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    style={s.pwInput}
                                    placeholder="Enter your password"
                                    required
                                />
                                <button
                                    type="button"
                                    style={s.eyeBtn}
                                    onClick={() => setShowPassword(v => !v)}
                                    tabIndex={-1}
                                >
                                    <EyeIcon open={showPassword} />
                                </button>
                            </div>
                        </div>

                        {error && <div style={s.errorBox}>{error}</div>}

                        <button type="submit" style={s.submitBtn} disabled={loading}>
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}

const s = {
    page: {
        display: 'flex',
        minHeight: '100vh',
        background: '#0f172a'
    },

    /* Left */
    left: {
        flex: '1 1 55%',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative'
    },
    overlay: {
        position: 'absolute', inset: 0,
        background: 'linear-gradient(135deg, rgba(10,20,60,0.88) 0%, rgba(15,40,90,0.75) 60%, rgba(30,60,120,0.6) 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '48px 52px'
    },

    brand: {
        display: 'flex', alignItems: 'center', gap: '14px'
    },
    logoMark: {
        width: '48px', height: '48px',
        background: 'rgba(255,255,255,0.15)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.25)',
        borderRadius: '12px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '28px', fontWeight: '900', color: '#f87171'
    },
    logoName: {
        color: 'white', fontSize: '22px', fontWeight: '800',
        letterSpacing: '3px', lineHeight: 1
    },
    logoTagline: {
        color: 'rgba(255,255,255,0.55)', fontSize: '11px',
        letterSpacing: '0.05em', marginTop: '3px'
    },

    heroText: {
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', paddingBottom: '24px'
    },
    heroTitle: {
        color: 'white', fontSize: '42px', fontWeight: '800',
        lineHeight: 1.2, margin: '0 0 16px', letterSpacing: '-0.5px'
    },
    heroSub: {
        color: 'rgba(255,255,255,0.65)', fontSize: '16px',
        lineHeight: '1.7', margin: 0, maxWidth: '420px'
    },

    featureList: {
        display: 'flex', flexDirection: 'column', gap: '10px'
    },
    featureRow: {
        display: 'flex', alignItems: 'center', gap: '12px'
    },
    featureCheck: {
        width: '22px', height: '22px',
        background: 'rgba(59,130,246,0.3)',
        border: '1px solid rgba(59,130,246,0.5)',
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#93c5fd', fontSize: '12px', fontWeight: '700',
        flexShrink: 0, textAlign: 'center', lineHeight: '22px'
    },
    featureLabel: {
        color: 'rgba(255,255,255,0.75)', fontSize: '14px'
    },

    /* Right */
    right: {
        flex: '0 0 420px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(160deg, #f0f4ff 0%, #f8faff 100%)',
        padding: '48px 32px'
    },
    card: {
        width: '100%', maxWidth: '360px'
    },

    cardLogo: {
        display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px'
    },
    cardLogoMark: {
        width: '40px', height: '40px',
        background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
        borderRadius: '10px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '22px', fontWeight: '900', color: '#fca5a5'
    },
    cardLogoName: {
        color: '#0f172a', fontSize: '18px', fontWeight: '800',
        letterSpacing: '2px', lineHeight: 1
    },
    cardLogoSub: {
        color: '#64748b', fontSize: '11px', marginTop: '2px'
    },

    cardTitle: {
        color: '#0f172a', fontSize: '26px', fontWeight: '700',
        margin: '0 0 6px'
    },
    cardSub: {
        color: '#64748b', fontSize: '14px', margin: '0 0 28px'
    },

    form: { display: 'flex', flexDirection: 'column', gap: '18px' },

    field: { display: 'flex', flexDirection: 'column', gap: '6px' },
    label: {
        fontSize: '13px', fontWeight: '600', color: '#374151'
    },
    input: {
        padding: '11px 14px',
        border: '1.5px solid #e2e8f0',
        borderRadius: '10px',
        fontSize: '14px',
        background: 'white',
        outline: 'none',
        boxSizing: 'border-box',
        width: '100%',
        color: '#0f172a'
    },
    pwWrap: { position: 'relative' },
    pwInput: {
        padding: '11px 44px 11px 14px',
        border: '1.5px solid #e2e8f0',
        borderRadius: '10px',
        fontSize: '14px',
        background: 'white',
        outline: 'none',
        boxSizing: 'border-box',
        width: '100%',
        color: '#0f172a'
    },
    eyeBtn: {
        position: 'absolute', right: '12px', top: '50%',
        transform: 'translateY(-50%)',
        background: 'none', border: 'none',
        cursor: 'pointer', color: '#94a3b8',
        display: 'flex', alignItems: 'center', padding: 0
    },

    errorBox: {
        background: '#fef2f2', border: '1px solid #fecaca',
        color: '#b91c1c', borderRadius: '8px',
        padding: '10px 14px', fontSize: '13px', textAlign: 'center'
    },

    submitBtn: {
        padding: '13px',
        background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
        color: 'white', border: 'none',
        borderRadius: '10px', fontSize: '15px',
        fontWeight: '700', cursor: 'pointer',
        letterSpacing: '0.02em',
        boxShadow: '0 4px 14px rgba(59,130,246,0.35)',
        marginTop: '4px'
    }
}

export default LoginPage
