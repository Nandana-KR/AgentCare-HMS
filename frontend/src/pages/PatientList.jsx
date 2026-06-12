import { useState, useEffect } from 'react'
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

    const limit = 10
    const navigate = useNavigate()
    const totalPages = Math.ceil(totalPatients / limit)

    // Fetch patients whenever page, sort, or order changes
    useEffect(() => {
        fetchPatients()
    }, [currentPage, sortBy, order])

    const fetchPatients = async () => {
        setLoading(true)
        setError(null)
        try {
            const skip = (currentPage - 1) * limit

            // Fetch patients and total count simultaneously
            const [patientsRes, countRes] = await Promise.all([
                axiosInstance.get('/api/v1/patients/', {
                    params: { skip, limit, sort_by: sortBy, order }
                }),
                axiosInstance.get('/api/v1/patients/count')
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
                <p style={styles.count}>
                    Total: {totalPatients} patients
                </p>
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
        alignItems: 'center',
        marginBottom: '20px'
    },
    title: {
        color: '#1a365d',
        margin: 0
    },
    count: {
        color: '#718096'
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