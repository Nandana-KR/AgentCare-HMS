import { useState, useEffect } from 'react'
import axiosInstance from '../api/axiosInstance'
import { useAuth } from '../context/AuthContext'

const ROLES = ['admin', 'doctor', 'receptionist', 'nurse']

function StaffList() {
    const { user: currentUser } = useAuth()

    const [staff, setStaff] = useState([])
    const [departments, setDepartments] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [savingId, setSavingId] = useState(null)
    const [edits, setEdits] = useState({})

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        setError(null)
        try {
            const [staffRes, deptRes] = await Promise.all([
                axiosInstance.get('/api/v1/users/'),
                axiosInstance.get('/api/v1/departments/')
            ])
            setStaff(staffRes.data)
            setDepartments(deptRes.data)
        } catch (err) {
            setError('Failed to load staff')
        } finally {
            setLoading(false)
        }
    }

    const getEdit = (member, field) => {
        const override = edits[member.id]
        if (override && field in override) return override[field]

        switch (field) {
            case 'role':
                return member.role
            case 'department_id':
                return member.department_id ?? ''
            case 'supervisor_id':
                return member.supervisor_id ?? ''
            case 'is_active':
                return member.is_active
            default:
                return ''
        }
    }

    const setEdit = (memberId, field, value) => {
        setEdits(prev => ({
            ...prev,
            [memberId]: { ...prev[memberId], [field]: value }
        }))
    }

    const hasChanges = (memberId) => {
        return !!edits[memberId] && Object.keys(edits[memberId]).length > 0
    }

    const handleSave = async (member) => {
        const changes = edits[member.id]
        if (!changes) return

        setSavingId(member.id)
        setError(null)

        const payload = {}
        if ('role' in changes) payload.role = changes.role
        if ('department_id' in changes) {
            payload.department_id = changes.department_id || null
        }
        if ('supervisor_id' in changes) {
            payload.supervisor_id = changes.supervisor_id || null
        }
        if ('is_active' in changes) payload.is_active = changes.is_active

        try {
            const res = await axiosInstance.patch(
                `/api/v1/users/${member.id}`, payload
            )
            setStaff(prev => prev.map(s =>
                s.id === member.id ? res.data : s
            ))
            setEdits(prev => {
                const next = { ...prev }
                delete next[member.id]
                return next
            })
        } catch (err) {
            setError('Failed to update staff member')
        } finally {
            setSavingId(null)
        }
    }

    if (loading) return <p style={styles.loading}>Loading staff...</p>

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h2 style={styles.title}>Staff Management</h2>
                <p style={styles.count}>Total: {staff.length} staff</p>
            </div>

            {error && <div style={styles.errorBanner}>{error}</div>}

            <table style={styles.table}>
                <thead>
                    <tr style={styles.headerRow}>
                        <th style={styles.th}>Name</th>
                        <th style={styles.th}>Email</th>
                        <th style={styles.th}>Role</th>
                        <th style={styles.th}>Department</th>
                        <th style={styles.th}>Supervisor</th>
                        <th style={styles.th}>Active</th>
                        <th style={styles.th}>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {staff.map(member => (
                        <tr key={member.id} style={styles.row}>
                            <td style={styles.td}>{member.full_name}</td>
                            <td style={styles.td}>{member.email}</td>
                            <td style={styles.td}>
                                <select
                                    style={styles.select}
                                    value={getEdit(member, 'role')}
                                    onChange={(e) => setEdit(
                                        member.id, 'role', e.target.value
                                    )}
                                >
                                    {ROLES.map(r => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                            </td>
                            <td style={styles.td}>
                                <select
                                    style={styles.select}
                                    value={getEdit(member, 'department_id')}
                                    onChange={(e) => setEdit(
                                        member.id, 'department_id', e.target.value
                                    )}
                                >
                                    <option value="">-</option>
                                    {departments.map(d => (
                                        <option key={d.id} value={d.id}>
                                            {d.name}
                                        </option>
                                    ))}
                                </select>
                            </td>
                            <td style={styles.td}>
                                <select
                                    style={styles.select}
                                    value={getEdit(member, 'supervisor_id')}
                                    onChange={(e) => setEdit(
                                        member.id, 'supervisor_id', e.target.value
                                    )}
                                >
                                    <option value="">-</option>
                                    {staff
                                        .filter(s => s.id !== member.id)
                                        .map(s => (
                                            <option key={s.id} value={s.id}>
                                                {s.full_name}
                                            </option>
                                        ))}
                                </select>
                            </td>
                            <td style={styles.td}>
                                <input
                                    type="checkbox"
                                    checked={getEdit(member, 'is_active')}
                                    disabled={member.id === currentUser?.id}
                                    onChange={(e) => setEdit(
                                        member.id, 'is_active', e.target.checked
                                    )}
                                />
                            </td>
                            <td style={styles.td}>
                                <button
                                    style={{
                                        ...styles.saveBtn,
                                        ...(hasChanges(member.id)
                                            ? {} : styles.saveBtnDisabled)
                                    }}
                                    disabled={
                                        !hasChanges(member.id) ||
                                        savingId === member.id
                                    }
                                    onClick={() => handleSave(member)}
                                >
                                    {savingId === member.id ? 'Saving...' : 'Save'}
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
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
        fontWeight: '600'
    },
    row: {
        borderBottom: '1px solid #e2e8f0'
    },
    td: {
        padding: '10px 16px',
        color: '#4a5568'
    },
    select: {
        padding: '6px 8px',
        borderRadius: '4px',
        border: '1px solid #e2e8f0',
        fontSize: '13px'
    },
    saveBtn: {
        padding: '6px 14px',
        backgroundColor: '#38a169',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer'
    },
    saveBtnDisabled: {
        backgroundColor: '#cbd5e0',
        cursor: 'not-allowed'
    },
    loading: {
        textAlign: 'center',
        padding: '40px',
        color: '#718096'
    },
    errorBanner: {
        backgroundColor: '#fed7d7',
        color: '#9b2c2c',
        padding: '12px 16px',
        borderRadius: '8px',
        marginBottom: '16px'
    }
}

export default StaffList
