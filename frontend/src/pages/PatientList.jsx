import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axiosInstance from '../api/axiosInstance'

function PatientList() {
    const [patients, setPatients] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPatients, setTotalPatients] = useState(0)
    const [sortBy, setSortBy] = useState('full_name')
    const [order, setOrder] = useState('asc')
    const [searchInput, setSearchInput] = useState('')
    const [search, setSearch] = useState('')
    const debounceRef = useRef(null)

    const limit = 10
    const navigate = useNavigate()
    const totalPages = Math.ceil(totalPatients / limit)

    const handleSearchChange = (e) => {
        const val = e.target.value
        setSearchInput(val)
        clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            setSearch(val)
            setCurrentPage(1)
        }, 350)
    }

    useEffect(() => {
        fetchPatients()
    }, [currentPage, sortBy, order, search])

    const fetchPatients = async () => {
        setLoading(true)
        setError(null)
        try {
            const skip = (currentPage - 1) * limit

            const params = { skip, limit, sort_by: sortBy, order }
            if (search) params.search = search

            const [patientsRes, countRes] = await Promise.all([
                axiosInstance.get('/api/v1/patients/', { params }),
                axiosInstance.get('/api/v1/patients/count', {
                    params: search ? { search } : {}
                })
            ])

            setPatients(patientsRes.data)
            setTotalPatients(countRes.data.total)
        } catch (err) {
            setError('Failed to load patients')
        } finally {
            setLoading(false)
        }
    }

    const handleSort = (column) => {
        if (sortBy === column) {
            // Same column clicked — toggle order
            setOrder(order === 'asc' ? 'desc' : 'asc')
        } else {
            // New column clicked — sort ascending
            setSortBy(column)
            setOrder('asc')
        }
        setCurrentPage(1)
    }

    const getSortIndicator = (column) => {
        if (sortBy !== column) return ' ↕'
        return order === 'asc' ? ' ↑' : ' ↓'
    }

    if (loading) return <p style={styles.loading}>Loading patients...</p>
    if (error) return <p style={styles.error}>{error}</p>

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h2 style={styles.title}>Patients</h2>
                <div style={styles.headerRight}>
                    <input
                        style={styles.searchInput}
                        type="text"
                        placeholder="Search by name..."
                        value={searchInput}
                        onChange={handleSearchChange}
                    />
                    <p style={styles.count}>
                        {totalPatients} patient{totalPatients !== 1 ? 's' : ''}
                        {search ? ` matching "${search}"` : ''}
                    </p>
                </div>
            </div>

            <table style={styles.table}>
                <thead>
                    <tr style={styles.headerRow}>
                        <th
                            style={styles.th}
                            onClick={() => handleSort('full_name')}
                        >
                            Name{getSortIndicator('full_name')}
                        </th>
                        <th style={styles.th}>Gender</th>
                        <th style={styles.th}>Blood Group</th>
                        <th style={styles.th}>Phone</th>
                        <th
                            style={styles.th}
                            onClick={() => handleSort('created_at')}
                        >
                            Registered{getSortIndicator('created_at')}
                        </th>
                        <th style={styles.th}>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {patients.map((patient) => (
                        <tr key={patient.id} style={styles.row}>
                            <td style={styles.td}>{patient.full_name}</td>
                            <td style={styles.td}>
                                {patient.gender || '-'}
                            </td>
                            <td style={styles.td}>
                                {patient.blood_group || '-'}
                            </td>
                            <td style={styles.td}>
                                {patient.phone || '-'}
                            </td>
                            <td style={styles.td}>
                                {new Date(patient.created_at)
                                    .toLocaleDateString()}
                            </td>
                            <td style={styles.td}>
                                <button
                                    style={styles.viewBtn}
                                    onClick={() => navigate(
                                        `/patients/${patient.id}`
                                    )}
                                >
                                    View
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Pagination controls */}
            <div style={styles.pagination}>
                <button
                    style={styles.pageBtn}
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                >
                    Previous
                </button>

                <span style={styles.pageInfo}>
                    Page {currentPage} of {totalPages}
                </span>

                <button
                    style={styles.pageBtn}
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                >
                    Next
                </button>
            </div>
        </div>
    )
}

const styles = {
    container: {
        padding: '24px'
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '20px'
    },
    headerRight: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '6px'
    },
    title: {
        color: '#1a365d',
        margin: 0
    },
    count: {
        color: '#718096',
        margin: 0,
        fontSize: '14px'
    },
    searchInput: {
        padding: '8px 12px',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        fontSize: '14px',
        width: '220px'
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        backgroundColor: 'white',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)'
    },
    headerRow: {
        backgroundColor: '#2b6cb0'
    },
    th: {
        padding: '14px 16px',
        textAlign: 'left',
        color: 'white',
        fontWeight: '600',
        cursor: 'pointer',
        userSelect: 'none'
    },
    row: {
        borderBottom: '1px solid #e2e8f0'
    },
    td: {
        padding: '12px 16px',
        color: '#4a5568'
    },
    viewBtn: {
        padding: '6px 14px',
        backgroundColor: '#3182ce',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer'
    },
    pagination: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '16px',
        marginTop: '20px'
    },
    pageBtn: {
        padding: '8px 16px',
        backgroundColor: '#3182ce',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer'
    },
    pageInfo: {
        color: '#4a5568',
        fontWeight: '500'
    },
    loading: {
        textAlign: 'center',
        padding: '40px',
        color: '#718096'
    },
    error: {
        textAlign: 'center',
        padding: '40px',
        color: '#e53e3e'
    }
}

export default PatientList