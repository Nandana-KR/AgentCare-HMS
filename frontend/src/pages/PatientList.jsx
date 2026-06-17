import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axiosInstance from '../api/axiosInstance'
import { useAuth } from '../context/AuthContext'

const glass = {
    background: 'rgba(255,255,255,0.78)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.6)',
    borderRadius: '16px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.06)'
}

const AVATAR_COLORS = [
    'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    'linear-gradient(135deg, #8b5cf6, #6d28d9)',
    'linear-gradient(135deg, #10b981, #059669)',
    'linear-gradient(135deg, #f59e0b, #d97706)',
    'linear-gradient(135deg, #ef4444, #dc2626)',
    'linear-gradient(135deg, #06b6d4, #0891b2)'
]

const fmtDate = d => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })

function PatientList() {
    const [patients,       setPatients]       = useState([])
    const [loading,        setLoading]        = useState(true)
    const [error,          setError]          = useState(null)
    const [currentPage,    setCurrentPage]    = useState(1)
    const [totalPatients,  setTotalPatients]  = useState(0)
    const [sortBy,         setSortBy]         = useState('full_name')
    const [order,          setOrder]          = useState('asc')
    const [searchInput,    setSearchInput]    = useState('')
    const [search,         setSearch]         = useState('')
    const debounceRef = useRef(null)

    const limit = 10
    const navigate = useNavigate()
    const { user } = useAuth()
    const canBook = ['admin', 'receptionist', 'doctor', 'nurse'].includes(user?.role)
    const totalPages = Math.ceil(totalPatients / limit) || 1

    const handleSearchChange = e => {
        const val = e.target.value
        setSearchInput(val)
        clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => { setSearch(val); setCurrentPage(1) }, 350)
    }

    const handleSort = col => {
        if (sortBy === col) setOrder(o => o === 'asc' ? 'desc' : 'asc')
        else { setSortBy(col); setOrder('asc') }
        setCurrentPage(1)
    }

    useEffect(() => {
        setLoading(true)
        setError(null)
        const skip = (currentPage - 1) * limit
        const params = { skip, limit, sort_by: sortBy, order }
        if (search) params.search = search

        Promise.all([
            axiosInstance.get('/api/v1/patients/', { params }),
            axiosInstance.get('/api/v1/patients/count', { params: search ? { search } : {} })
        ]).then(([p, c]) => {
            setPatients(p.data)
            setTotalPatients(c.data.total)
        }).catch(() => setError('Failed to load patients'))
          .finally(() => setLoading(false))
    }, [currentPage, sortBy, order, search])

    if (error) return <p style={s.center}>{error}</p>

    return (
        <div style={s.page}>
            {/* Header */}
            <div style={s.header}>
                <div>
                    <h2 style={s.title}>Patients</h2>
                    <p style={s.count}>
                        {totalPatients} patient{totalPatients !== 1 ? 's' : ''}
                        {search ? ` matching "${search}"` : ''}
                    </p>
                </div>
                <input
                    style={s.search}
                    type="text"
                    placeholder="Search name or phone..."
                    value={searchInput}
                    onChange={handleSearchChange}
                />
            </div>

            {/* Sort bar */}
            <div style={s.sortBar}>
                <span style={s.sortLabel}>Sort:</span>
                {[['full_name', 'Name'], ['created_at', 'Date Registered']].map(([col, label]) => (
                    <button key={col} style={{ ...s.sortBtn, ...(sortBy === col ? s.sortActive : {}) }}
                        onClick={() => handleSort(col)}>
                        {label} {sortBy === col ? (order === 'asc' ? '↑' : '↓') : '↕'}
                    </button>
                ))}
            </div>

            {/* Patient cards */}
            {loading ? (
                <div style={s.loadingGrid}>
                    {[...Array(6)].map((_, i) => (
                        <div key={i} style={{ ...glass, padding: '18px 20px', height: '72px', opacity: 0.4 }} />
                    ))}
                </div>
            ) : patients.length === 0 ? (
                <div style={{ ...glass, padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
                    {search ? `No patients matching "${search}"` : 'No patients registered yet'}
                </div>
            ) : (
                <div style={s.list}>
                    {patients.map((p, i) => {
                        const initials = p.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                        const avatarBg = AVATAR_COLORS[i % AVATAR_COLORS.length]
                        return (
                            <div key={p.id} style={s.card} onClick={() => navigate(`/patients/${p.id}`)}>
                                <div style={{ ...s.avatar, background: avatarBg }}>{initials}</div>
                                <div style={s.cardMain}>
                                    <span style={s.name}>{p.full_name}</span>
                                    <div style={s.pills}>
                                        {p.phone      && <span style={s.pill}>{p.phone}</span>}
                                        {p.blood_group && <span style={{ ...s.pill, ...s.pillRed }}>{p.blood_group}</span>}
                                        {p.gender      && <span style={{ ...s.pill, ...s.pillGray }}>{p.gender}</span>}
                                    </div>
                                </div>
                                <div style={s.cardRight}>
                                    <span style={s.dateText}>{fmtDate(p.created_at)}</span>
                                    <div style={s.actions} onClick={e => e.stopPropagation()}>
                                        <button style={s.viewBtn} onClick={() => navigate(`/patients/${p.id}`)}>
                                            View
                                        </button>
                                        {canBook && (
                                            <button style={s.bookBtn} onClick={() => navigate(`/appointments/new?patient=${p.id}`)}>
                                                + Appt
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={s.pagination}>
                    <button style={{ ...s.pageBtn, ...(currentPage === 1 ? s.pageBtnDisabled : {}) }}
                        onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>
                        ← Prev
                    </button>
                    <span style={s.pageInfo}>Page {currentPage} of {totalPages}</span>
                    <button style={{ ...s.pageBtn, ...(currentPage === totalPages ? s.pageBtnDisabled : {}) }}
                        onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>
                        Next →
                    </button>
                </div>
            )}
        </div>
    )
}

const s = {
    page:   { maxWidth: '860px', margin: '0 auto' },
    center: { textAlign: 'center', padding: '60px', color: '#94a3b8' },

    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' },
    title:  { color: '#0f172a', margin: '0 0 4px', fontSize: '22px', fontWeight: '700' },
    count:  { color: '#94a3b8', margin: 0, fontSize: '13px' },
    search: {
        padding: '9px 14px', border: '1.5px solid rgba(255,255,255,0.6)',
        borderRadius: '10px', fontSize: '14px',
        background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)',
        outline: 'none', width: '220px', color: '#0f172a',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
    },

    sortBar:    { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' },
    sortLabel:  { fontSize: '12px', color: '#94a3b8', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase' },
    sortBtn:    {
        padding: '5px 12px', background: 'rgba(255,255,255,0.6)',
        border: '1.5px solid rgba(255,255,255,0.7)', borderRadius: '20px',
        fontSize: '12px', fontWeight: '600', color: '#64748b', cursor: 'pointer'
    },
    sortActive: { background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', borderColor: 'transparent', color: 'white' },

    loadingGrid: { display: 'flex', flexDirection: 'column', gap: '10px' },

    list: { display: 'flex', flexDirection: 'column', gap: '10px' },
    card: {
        ...glass,
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', gap: '14px',
        cursor: 'pointer', borderLeft: '4px solid #3b82f6',
        transition: 'box-shadow 0.2s'
    },
    avatar: {
        width: '42px', height: '42px', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontSize: '14px', fontWeight: '700',
        flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
    },
    cardMain: { flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 },
    name:     { fontSize: '15px', fontWeight: '700', color: '#0f172a' },
    pills:    { display: 'flex', gap: '6px', flexWrap: 'wrap' },
    pill:     { fontSize: '11px', color: '#3b82f6', background: 'rgba(59,130,246,0.1)', borderRadius: '6px', padding: '2px 8px', fontWeight: '600' },
    pillRed:  { color: '#dc2626', background: 'rgba(220,38,38,0.08)' },
    pillGray: { color: '#64748b', background: 'rgba(100,116,139,0.08)' },

    cardRight:  { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 },
    dateText:   { fontSize: '12px', color: '#94a3b8', fontWeight: '500' },
    actions:    { display: 'flex', gap: '6px' },
    viewBtn:    {
        padding: '5px 12px', background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
        color: 'white', border: 'none', borderRadius: '6px',
        cursor: 'pointer', fontSize: '12px', fontWeight: '600'
    },
    bookBtn:    {
        padding: '5px 10px', background: 'rgba(16,185,129,0.1)',
        color: '#059669', border: '1px solid rgba(16,185,129,0.3)',
        borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600'
    },

    pagination:     { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '20px' },
    pageBtn:        {
        padding: '8px 18px', background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
        color: 'white', border: 'none', borderRadius: '8px',
        cursor: 'pointer', fontSize: '13px', fontWeight: '600'
    },
    pageBtnDisabled:{ background: '#e2e8f0', color: '#94a3b8', cursor: 'not-allowed' },
    pageInfo:       { color: '#64748b', fontSize: '13px', fontWeight: '600' }
}

export default PatientList
