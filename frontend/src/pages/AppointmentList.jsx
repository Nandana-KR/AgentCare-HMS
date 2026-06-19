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

const fmt = d => new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit'
})

const isToday = d => {
    const t = new Date(d), n = new Date()
    return t.getDate() === n.getDate() && t.getMonth() === n.getMonth() && t.getFullYear() === n.getFullYear()
}

const PAGE_SIZE = 10

function AppointmentList() {
    const [appointments, setAppointments] = useState([])
    const [loading,      setLoading]      = useState(true)
    const [error,        setError]        = useState(null)
    const [filter,  setFilterVal] = useState('all')
    const [search,  setSearch]   = useState('')
    const [sortDir, setSortDir]  = useState('desc')
    const [page,         setPage]         = useState(1)
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
        const q = search.toLowerCase()
        return appointments
            .filter(a => {
                if (filter === 'today') return isToday(a.scheduled_at)
                if (filter !== 'all') return a.status === filter
                return true
            })
            .filter(a => !q || a.patient_name?.toLowerCase().includes(q) || a.doctor_name?.toLowerCase().includes(q))
            .sort((a, b) => sortDir === 'desc'
                ? new Date(b.scheduled_at) - new Date(a.scheduled_at)
                : new Date(a.scheduled_at) - new Date(b.scheduled_at)
            )
    }, [appointments, filter, search, sortDir])

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
    const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

    const changeFilter = f => { setFilterVal(f); setPage(1) }

    if (loading) return <p style={s.center}>Loading...</p>
    if (error)   return <p style={{ ...s.center, color: '#ef4444' }}>{error}</p>

    return (
        <div style={s.page}>
            <div style={s.header}>
                <h2 style={s.title}>Appointments</h2>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                        style={{ padding: '7px 14px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', width: '200px', color: '#0f172a', background: 'white' }}
                        placeholder="Search name..."
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1) }}
                    />
                    {user?.role === 'admin' && (
                        <button style={{ ...s.bookBtn, background: '#ef4444' }} onClick={async () => {
                            if (!await confirm('Remove duplicate appointments? Keeps only the latest per patient.')) return
                            try {
                                const res = await axiosInstance.post('/api/v1/appointments/cleanup')
                                toast(res.data.message, 'success')
                                window.location.reload()
                            } catch { toast('Cleanup failed', 'error') }
                        }}>Cleanup Duplicates</button>
                    )}
                    <button style={s.bookBtn} onClick={() => navigate('/appointments/new')}>+ Book</button>
                </div>
            </div>

            {/* Filters */}
            <div style={s.filterBar}>
                {[
                    { key: 'all',       label: 'All' },
                    { key: 'scheduled', label: 'Scheduled' },
                    { key: 'completed', label: 'Completed' },
                    { key: 'cancelled', label: 'Cancelled' },
                    { key: 'today',     label: 'Today' }
                ].map(f => {
                    const count = f.key === 'all'   ? appointments.length
                        : f.key === 'today'         ? appointments.filter(a => isToday(a.scheduled_at)).length
                        : appointments.filter(a => a.status === f.key).length
                    const active = filter === f.key
                    return (
                        <button key={f.key}
                            style={{ ...s.filterBtn, ...(active ? s.filterActive : {}) }}
                            onClick={() => changeFilter(f.key)}>
                            {f.label}
                            <span style={{ ...s.filterCount, ...(active ? s.filterCountActive : {}) }}>
                                {count}
                            </span>
                        </button>
                    )
                })}
            </div>

            {/* Table */}
            <div style={{ ...glass, overflow: 'hidden' }}>
                <table style={s.table}>
                    <thead>
                        <tr style={s.thead}>
                            <th style={{ ...s.th, cursor: 'pointer', userSelect: 'none' }}
                                onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}>
                                Date & Time {sortDir === 'desc' ? '↓' : '↑'}
                            </th>
                            <th style={s.th}>Patient</th>
                            <th style={s.th}>Doctor</th>
                            <th style={s.th}>Status</th>
                            <th style={s.th}>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginated.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={s.empty}>
                                    {filter === 'today' ? 'No appointments today'
                                        : filter !== 'all' ? `No ${filter} appointments`
                                        : 'No appointments found'}
                                </td>
                            </tr>
                        ) : paginated.map(apt => {
                            const sc = STATUS_STYLE[apt.status] || STATUS_STYLE.scheduled
                            return (
                                <tr key={apt.id} style={s.row}
                                    onClick={() => navigate(`/patients/${apt.patient_id}`)}
                                    title="View patient">
                                    <td style={s.td}>{fmt(apt.scheduled_at)}</td>
                                    <td style={{ ...s.td, fontWeight: '600', color: '#0f172a' }}>{apt.patient_name}</td>
                                    <td style={{ ...s.td, color: '#475569' }}>{apt.doctor_name}</td>
                                    <td style={s.td}>
                                        <span style={{ ...s.badge, background: sc.bg, color: sc.text }}>
                                            {apt.status}
                                        </span>
                                    </td>
                                    <td style={{ ...s.td, color: '#64748b', maxWidth: '180px' }}>
                                        <span style={s.noteClip}>{apt.notes || '—'}</span>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={s.pagination}>
                    <button style={{ ...s.pageBtn, ...(page === 1 ? s.pageBtnOff : {}) }}
                        disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                        ← Prev
                    </button>
                    <span style={s.pageInfo}>
                        Page {page} of {totalPages} &nbsp;·&nbsp; {filtered.length} total
                    </span>
                    <button style={{ ...s.pageBtn, ...(page === totalPages ? s.pageBtnOff : {}) }}
                        disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                        Next →
                    </button>
                </div>
            )}
        </div>
    )
}

const s = {
    page:   { maxWidth: '1000px', margin: '0 auto' },
    center: { textAlign: 'center', padding: '60px', color: '#94a3b8' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
    title:  { color: '#0f172a', margin: 0, fontSize: '22px', fontWeight: '700' },
    bookBtn: {
        padding: '9px 18px', background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
        color: 'white', border: 'none', borderRadius: '8px',
        fontSize: '13px', fontWeight: '600', cursor: 'pointer'
    },

    filterBar:   { display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' },
    filterBtn: {
        padding: '6px 14px', background: 'rgba(255,255,255,0.6)',
        border: '1.5px solid rgba(255,255,255,0.7)', borderRadius: '20px',
        fontSize: '12px', fontWeight: '600', color: '#64748b', cursor: 'pointer'
    },
    filterActive: { background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', borderColor: 'transparent', color: 'white' },
    filterCount: {
        display: 'inline-block', marginLeft: '5px',
        background: 'rgba(0,0,0,0.1)', color: '#64748b',
        borderRadius: '10px', padding: '0px 6px', fontSize: '11px', fontWeight: '700'
    },
    filterCountActive: { background: 'rgba(255,255,255,0.25)', color: 'white' },

    table: { width: '100%', borderCollapse: 'collapse' },
    thead: { background: 'linear-gradient(135deg, #0f172a, #1e3a8a)' },
    th: {
        padding: '13px 16px', textAlign: 'left',
        color: 'rgba(255,255,255,0.85)', fontWeight: '600', fontSize: '12px', letterSpacing: '0.04em'
    },
    row: {
        borderBottom: '1px solid rgba(226,232,240,0.6)',
        cursor: 'pointer', transition: 'background 0.15s'
    },
    td: { padding: '11px 16px', fontSize: '13px', color: '#334155' },
    empty: { padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' },

    badge: {
        display: 'inline-block', padding: '3px 10px', borderRadius: '20px',
        fontSize: '11px', fontWeight: '700'
    },
    noteClip: {
        display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px'
    },

    pagination:  { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '16px' },
    pageBtn:     {
        padding: '8px 18px', background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
        color: 'white', border: 'none', borderRadius: '8px',
        cursor: 'pointer', fontSize: '13px', fontWeight: '600'
    },
    pageBtnOff:  { background: '#e2e8f0', color: '#94a3b8', cursor: 'not-allowed' },
    pageInfo:    { color: '#64748b', fontSize: '13px', fontWeight: '500' }
}

export default AppointmentList
