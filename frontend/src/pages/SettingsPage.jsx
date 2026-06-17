import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import axiosInstance from '../api/axiosInstance'
import { glass } from '../styles/glass'

const ROLE_LABELS = {
    admin: 'Administrator',
    doctor: 'Physician',
    nurse: 'Nurse',
    receptionist: 'Receptionist'
}

function PasswordField({ label, name, value, onChange }) {
    const [show, setShow] = useState(false)
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={s.label}>{label}</label>
            <div style={{ position: 'relative' }}>
                <input
                    type={show ? 'text' : 'password'}
                    name={name}
                    value={value}
                    onChange={onChange}
                    required
                    style={s.pwInput}
                />
                <button
                    type="button"
                    onClick={() => setShow(v => !v)}
                    style={s.eyeBtn}
                >
                    {show ? 'Hide' : 'Show'}
                </button>
            </div>
        </div>
    )
}

function SettingsPage() {
    const { user } = useAuth()
    const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(null)
    const [error, setError] = useState(null)

    const handleChange = e => {
        const { name, value } = e.target
        setForm(prev => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async e => {
        e.preventDefault()
        setError(null)
        setSuccess(null)
        if (form.new_password !== form.confirm_password) {
            setError('New passwords do not match')
            return
        }
        if (form.new_password.length < 6) {
            setError('New password must be at least 6 characters')
            return
        }
        setLoading(true)
        try {
            await axiosInstance.post('/api/v1/auth/change-password', {
                current_password: form.current_password,
                new_password: form.new_password
            })
            setSuccess('Password changed successfully')
            setForm({ current_password: '', new_password: '', confirm_password: '' })
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to change password')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={s.page}>
            <h2 style={s.pageTitle}>Account Settings</h2>

            <div style={{ ...glass, padding: '20px 24px', marginBottom: '20px' }}>
                <p style={s.metaLabel}>Logged in as</p>
                <p style={s.userName}>{user?.full_name}</p>
                <p style={s.userMeta}>
                    {user?.email}
                    <span style={s.rolePill}>{ROLE_LABELS[user?.role] || user?.role}</span>
                </p>
                {user?.department_name && (
                    <p style={s.deptText}>{user.department_name}</p>
                )}
            </div>

            <div style={{ ...glass, padding: '24px' }}>
                <h3 style={s.sectionTitle}>Change Password</h3>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <PasswordField label="Current Password" name="current_password" value={form.current_password} onChange={handleChange} />
                    <PasswordField label="New Password" name="new_password" value={form.new_password} onChange={handleChange} />
                    <PasswordField label="Confirm New Password" name="confirm_password" value={form.confirm_password} onChange={handleChange} />

                    {error && <div style={s.errorBox}>{error}</div>}
                    {success && <div style={s.successBox}>{success}</div>}

                    <button type="submit" disabled={loading} style={s.submitBtn}>
                        {loading ? 'Updating...' : 'Update Password'}
                    </button>
                </form>
            </div>
        </div>
    )
}

const s = {
    page: { maxWidth: '480px', margin: '0 auto' },
    pageTitle: { color: '#0f172a', margin: '0 0 24px', fontSize: '22px', fontWeight: '700' },

    metaLabel: { margin: '0 0 4px', fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' },
    userName: { margin: '0 0 4px', fontSize: '17px', fontWeight: '700', color: '#0f172a' },
    userMeta: { margin: 0, fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '10px' },
    rolePill: {
        fontSize: '11px', fontWeight: '600', color: '#6d28d9',
        background: 'rgba(139,92,246,0.1)', borderRadius: '6px',
        padding: '2px 8px'
    },
    deptText: { margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' },

    sectionTitle: { margin: '0 0 20px', fontSize: '16px', fontWeight: '700', color: '#0f172a' },

    label: { fontSize: '13px', fontWeight: '600', color: '#374151' },
    pwInput: {
        padding: '10px 56px 10px 14px',
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
        background: 'none', border: 'none', cursor: 'pointer',
        color: '#94a3b8', fontSize: '12px', fontWeight: '600', padding: 0
    },

    errorBox: {
        background: '#fef2f2', border: '1px solid #fecaca',
        color: '#b91c1c', borderRadius: '8px',
        padding: '10px 14px', fontSize: '13px'
    },
    successBox: {
        background: '#f0fdf4', border: '1px solid #bbf7d0',
        color: '#166534', borderRadius: '8px',
        padding: '10px 14px', fontSize: '13px'
    },
    submitBtn: {
        padding: '11px',
        background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
        color: 'white', border: 'none', borderRadius: '10px',
        fontSize: '14px', fontWeight: '700', cursor: 'pointer',
        marginTop: '4px', boxShadow: '0 4px 14px rgba(59,130,246,0.3)'
    }
}

export default SettingsPage
