import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axiosInstance from '../api/axiosInstance'
import { useAuth } from '../context/AuthContext'
import { glass } from '../styles/glass'

const fmtDate = d => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })

function PatientList() {
    const [patients,      setPatients]      = useState([])
    const [loading,       setLoading]       = useState(true)
    const [error,         setError]         = useState(null)
    const [currentPage,   setCurrentPage]   = useState(1)
    const [totalPatients, setTotalPatients] = useState(0)
    const [sortBy,        setSortBy]        = useState('full_name')
    const [order,         setOrder]         = useState('asc')
    const [searchInput,   setSearchInput]   = useState('')
    const [search,        setSearch]        = useState('')
    const [doctorFilter,  setDoctorFilter]  = useState('all')
    const [doctors,       setDoctors]       = useState([])
    const [doctorPatientMap, setDoctorPatientMap] = useState({})
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

    const sortIcon = col => sortBy === col ? (order === 'asc' ? ' ↑' : ' ↓') : ' ↕'

    useEffect(() => {
        if (['admin', 'receptionist'].includes(user?.role)) {
            axiosInstance.get('/api/v1/appointments/').then(res => {
                const docSet = new Set()
                const map = {}
                res.data.forEach(a => {
                    if (a.doctor_name) {
                        docSet.add(a.doctor_name)
                        if (!map[a.doctor_name]) map[a.doctor_name] = new Set()
                        map[a.doctor_name].add(a.patient_id)
                    }
                })
                setDoctors(Array.from(docSet).sort())
                const converted = {}
                Object.entries(map).forEach(([k, v]) => { converted[k] = Array.from(v) })
                setDoctorPatientMap(converted)
            }).catch(() => {})
        }
    }, [user])

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

    const filteredPatients = doctorFilter === 'all' ? patients
        : patients.filter(p => doctorPatientMap[doctorFilter]?.includes(p.id))

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
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {['admin', 'receptionist'].includes(user?.role) && doctors.length > 1 && (
                        <select style={{ padding: '8px 14px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', color: '#0f172a', background: 'white' }}
                            value={doctorFilter} onChange={e => { setDoctorFilter(e.target.value); setCurrentPage(1) }}>
                            <option value="all">All Doctors</option>
                            {doctors.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    )}
                    <input
                        style={s.search}
                        type="text"
                        placeholder="Search name or phone..."
                        value={searchInput}
                        onChange={handleSearchChange}
                    />
                </div>
            </div>

            {/* Table */}
            <div style={{ ...glass, overflow: 'hidden' }}>
                <table style={s.table}>
                    <thead>
                        <tr style={s.thead}>
                            <th style={s.th}>#</th>
                            <th style={{ ...s.th, cursor: 'pointer', userSelect: 'none' }}
                                onClick={() => handleSort('full_name')}>
                                Name{sortIcon('full_name')}
                            </th>
                            <th style={s.th}>Phone</th>
                            <th style={s.th}>Age</th>
                            <th style={s.th}>Gender</th>
                            <th style={s.th}>Blood Group</th>
                            <th style={{ ...s.th, cursor: 'pointer', userSelect: 'none' }}
                                onClick={() => handleSort('created_at')}>
                                Registered{sortIcon('created_at')}
                            </th>
                            <th style={s.th}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            [...Array(5)].map((_, i) => (
                                <tr key={i} style={s.row}>
                                    {[...Array(8)].map((_, j) => (
                                        <td key={j} style={s.td}>
                                            <div style={s.skeleton} />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : filteredPatients.length === 0 ? (
                            <tr>
                                <td colSpan={8} style={s.empty}>
                                    {search ? `No patients matching "${search}"` : 'No patients registered yet'}
                                </td>
                            </tr>
                        ) : filteredPatients.map((p, i) => {
                            const rowNum = (currentPage - 1) * limit + i + 1
                            return (
                                <tr key={p.id} style={s.row} onClick={() => navigate(`/patients/${p.id}`)}>
                                    <td style={{ ...s.td, color: '#94a3b8', fontSize: '12px' }}>{rowNum}</td>
                                    <td style={{ ...s.td, fontWeight: '600', color: '#0f172a' }}>{p.full_name}</td>
                                    <td style={{ ...s.td, color: '#475569' }}>{p.phone || '—'}</td>
                                    <td style={{ ...s.td, color: '#475569' }}>{p.date_of_birth ? Math.floor((new Date() - new Date(p.date_of_birth)) / (365.25 * 86400000)) : '—'}</td>
                                    <td style={{ ...s.td, color: '#475569', textTransform: 'capitalize' }}>{p.gender || '—'}</td>
                                    <td style={s.td}>
                                        {p.blood_group
                                            ? <span style={s.bloodBadge}>{p.blood_group}</span>
                                            : <span style={{ color: '#94a3b8' }}>—</span>}
                                    </td>
                                    <td style={{ ...s.td, color: '#64748b' }}>{fmtDate(p.created_at)}</td>
                                    <td style={s.td} onClick={e => e.stopPropagation()}>
                                        <div style={s.actions}>
                                            <button style={s.viewBtn} onClick={() => navigate(`/patients/${p.id}`)}>
                                                View
                                            </button>
                                            {canBook && (
                                                <button style={s.apptBtn}
                                                    onClick={() => navigate(`/appointments/new?patient=${p.id}`)}>
                                                    + Appt
                                                </button>
                                            )}
                                        </div>
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
                    <button style={{ ...s.pageBtn, ...(currentPage === 1 ? s.pageBtnOff : {}) }}
                        onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>
                        ← Prev
                    </button>
                    <span style={s.pageInfo}>Page {currentPage} of {totalPages} · {totalPatients} total</span>
                    <button style={{ ...s.pageBtn, ...(currentPage === totalPages ? s.pageBtnOff : {}) }}
                        onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>
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

    table: { width: '100%', borderCollapse: 'collapse' },
    thead: { background: 'linear-gradient(135deg, #0f172a, #1e3a8a)' },
    th: {
        padding: '13px 14px', textAlign: 'left',
        color: 'rgba(255,255,255,0.85)', fontWeight: '600',
        fontSize: '12px', letterSpacing: '0.04em'
    },
    row: {
        borderBottom: '1px solid rgba(226,232,240,0.6)',
        cursor: 'pointer', transition: 'background 0.12s'
    },
    td:    { padding: '11px 14px', fontSize: '13px', color: '#334155' },
    empty: { padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' },

    skeleton: {
        height: '14px', borderRadius: '6px',
        background: 'linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)',
        backgroundSize: '200% 100%'
    },

    bloodBadge: {
        display: 'inline-block', padding: '2px 8px', borderRadius: '6px',
        fontSize: '11px', fontWeight: '700',
        background: 'rgba(220,38,38,0.08)', color: '#dc2626'
    },

    actions: { display: 'flex', gap: '6px' },
    viewBtn: {
        padding: '5px 14px', background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
        color: 'white', border: 'none', borderRadius: '6px',
        cursor: 'pointer', fontSize: '12px', fontWeight: '600'
    },
    apptBtn: {
        padding: '5px 14px', background: 'rgba(16,185,129,0.1)',
        color: '#059669', border: '1px solid rgba(16,185,129,0.3)',
        borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600'
    },

    pagination: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '16px' },
    pageBtn: {
        padding: '8px 18px', background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
        color: 'white', border: 'none', borderRadius: '8px',
        cursor: 'pointer', fontSize: '13px', fontWeight: '600'
    },
    pageBtnOff: { background: '#e2e8f0', color: '#94a3b8', cursor: 'not-allowed' },
    pageInfo:   { color: '#64748b', fontSize: '13px', fontWeight: '500' }
}

export default PatientList
