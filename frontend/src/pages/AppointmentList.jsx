import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import axiosInstance from '../api/axiosInstance'
import { useToast } from '../components/Toast'
import { glass } from '../styles/glass'

const STATUS_STYLE = {
    scheduled: { bg: '#dbeafe', text: '#1e40af' },
    completed:  { bg: '#dcfce7', text: '#166534' },
    cancelled:  { bg: '#fee2e2', text: '#991b1b' }
}

const fmtDateTime = d => new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit'
})

const isToday = d => {
    const t = new Date(d), now = new Date()
    return t.getDate() === now.getDate() &&
           t.getMonth() === now.getMonth() &&
           t.getFullYear() === now.getFullYear()
}

function AppointmentList() {
    const [appointments, setAppointments] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [statusFilter, setStatusFilter] = useState('all')
    const [dateFilter, setDateFilter] = useState('all')
    const { user } = useAuth()
    const navigate = useNavigate()
    const toast = useToast()

    useEffect(() => {
        axiosInstance.get('/api/v1/appointments/')
            .then(r => setAppointments(r.data))
            .catch(() => setError('Failed to load appointments'))
            .finally(() => setLoading(false))
    }, [])

    const filtered = useMemo(() => {
        return appointments.filter(a => {
            if (statusFilter !== 'all' && a.status !== statusFilter) return false
            if (dateFilter === 'today' && !isToday(a.scheduled_at)) return false
            return true
        }).sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at))
    }, [appointments, statusFilter, dateFilter])

    const handleComplete = async (id) => {
        try {
            const res = await axiosInstance.patch(`/api/v1/appointments/${id}`, { status: 'completed' })
            setAppointments(prev => prev.map(a => a.id === id ? res.data : a))
        } catch {
            toast('Failed to mark appointment as completed', 'error')
        }
    }

    const handleCancel = async (id) => {
        if (!window.confirm('Cancel this appointment?')) return
        try {
            await axiosInstance.delete(`/api/v1/appointments/${id}`)
            setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'cancelled' } : a))
            toast('Appointment cancelled', 'success')
        } catch {
            toast('Failed to cancel appointment', 'error')
        }
    }

    if (loading) return <p style={s.center}>Loading...</p>
    if (error)   return <p style={{ ...s.center, color: '#ef4444' }}>{error}</p>

    return (
        <div style={s.page}>
            <div style={s.header}>
                <h2 style={s.title}>Appointments</h2>
                <button style={s.bookBtn} onClick={() => navigate('/appointments/new')}>
                    + Book
                </button>
            </div>

            {/* Filters */}
            <div style={s.filterBar}>
                <div style={s.filterGroup}>
                    {['all', 'scheduled', 'completed', 'cancelled'].map(f => (
                        <button
                            key={f}
                            style={{ ...s.filterBtn, ...(statusFilter === f ? s.filterActive : {}) }}
                            onClick={() => setStatusFilter(f)}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>
                <div style={s.filterGroup}>
                    {[['all', 'All Dates'], ['today', 'Today']].map(([v, label]) => (
                        <button
                            key={v}
                            style={{ ...s.filterBtn, ...(dateFilter === v ? s.filterActive : {}) }}
                            onClick={() => setDateFilter(v)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {filtered.length === 0 ? (
                <div style={{ ...glass, padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                    No appointments found
                </div>
            ) : (
                <div style={s.list}>
                    {filtered.map(apt => {
                        const sc = STATUS_STYLE[apt.status] || STATUS_STYLE.scheduled
                        return (
                            <div key={apt.id} style={{ ...glass, overflow: 'hidden', borderLeft: '4px solid #3b82f6' }}>
                                <div style={s.cardHead}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ ...s.badge, background: sc.bg, color: sc.text }}>
                                            {apt.status}
                                        </span>
                                        <span style={s.dateText}>{fmtDateTime(apt.scheduled_at)}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {apt.status === 'scheduled' && user?.role === 'doctor' && (
                                            <button style={s.completeBtn} onClick={() => handleComplete(apt.id)}>
                                                ✓ Complete
                                            </button>
                                        )}
                                        {apt.status === 'scheduled' && user?.role === 'receptionist' && (
                                            <button style={s.cancelBtn} onClick={() => handleCancel(apt.id)}>
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div
                                    style={s.cardBody}
                                    onClick={() => navigate(`/patients/${apt.patient_id}`)}
                                >
                                    <div style={s.row}>
                                        <span style={s.lbl}>Patient</span>
                                        <span style={s.val}>{apt.patient_name}</span>
                                    </div>
                                    <div style={s.row}>
                                        <span style={s.lbl}>Doctor</span>
                                        <span style={s.val}>{apt.doctor_name}</span>
                                    </div>
                                    {apt.notes && (
                                        <div style={s.row}>
                                            <span style={s.lbl}>Notes</span>
                                            <span style={s.val}>{apt.notes}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

const s = {
    page:   { maxWidth: '800px', margin: '0 auto' },
    center: { textAlign: 'center', padding: '60px', color: '#94a3b8' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
    title:  { color: '#0f172a', margin: 0, fontSize: '22px', fontWeight: '700' },
    bookBtn: {
        padding: '9px 18px', background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
        color: 'white', border: 'none', borderRadius: '8px',
        fontSize: '13px', fontWeight: '600', cursor: 'pointer'
    },

    filterBar:   { display: 'flex', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' },
    filterGroup: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
    filterBtn: {
        padding: '6px 14px', background: 'rgba(255,255,255,0.6)',
        border: '1.5px solid rgba(255,255,255,0.7)', borderRadius: '20px',
        fontSize: '12px', fontWeight: '600', color: '#64748b', cursor: 'pointer'
    },
    filterActive: {
        background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
        borderColor: 'transparent', color: 'white'
    },

    list: { display: 'flex', flexDirection: 'column', gap: '10px' },

    cardHead: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 16px', background: 'rgba(59,130,246,0.06)',
        borderBottom: '1px solid rgba(59,130,246,0.1)'
    },
    badge: {
        padding: '3px 10px', borderRadius: '20px',
        fontSize: '11px', fontWeight: '700'
    },
    dateText: { fontSize: '13px', fontWeight: '600', color: '#1e293b' },

    completeBtn: {
        padding: '5px 12px', background: '#dcfce7', color: '#166534',
        border: '1px solid #bbf7d0', borderRadius: '6px',
        fontSize: '12px', fontWeight: '700', cursor: 'pointer'
    },
    cancelBtn: {
        padding: '5px 12px', background: '#fee2e2', color: '#991b1b',
        border: '1px solid #fecaca', borderRadius: '6px',
        fontSize: '12px', fontWeight: '700', cursor: 'pointer'
    },

    cardBody: { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px', cursor: 'pointer' },
    row: { display: 'flex', gap: '12px' },
    lbl: { fontSize: '12px', color: '#94a3b8', fontWeight: '600', minWidth: '64px' },
    val: { fontSize: '13px', color: '#334155' }
}

export default AppointmentList
