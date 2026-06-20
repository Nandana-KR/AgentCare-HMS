import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axiosInstance from '../api/axiosInstance'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { glass } from '../styles/glass'

const ROLES = ['admin', 'doctor', 'receptionist', 'nurse']

const ROLE_PILL = {
    admin:        { bg: 'rgba(139,92,246,0.1)',  text: '#6d28d9' },
    doctor:       { bg: 'rgba(59,130,246,0.1)',  text: '#1d4ed8' },
    nurse:        { bg: 'rgba(16,185,129,0.1)',  text: '#065f46' },
    receptionist: { bg: 'rgba(245,158,11,0.1)',  text: '#92400e' }
}

function StaffList() {
    const { user: currentUser } = useAuth()
    const navigate = useNavigate()
    const toast = useToast()

    const [staff,       setStaff]       = useState([])
    const [departments, setDepartments] = useState([])
    const [loading,     setLoading]     = useState(true)
    const [savingId,    setSavingId]    = useState(null)
    const [edits,       setEdits]       = useState({})

    const [showForm, setShowForm] = useState(false)
    const [newStaff, setNewStaff] = useState({
        full_name: '', email: '', password: '', confirm_password: '', role: 'nurse',
        department_id: '', supervisor_id: ''
    })
    const [adding, setAdding] = useState(false)
    const [showPass, setShowPass] = useState(false)

    useEffect(() => { fetchData() }, [])

    const fetchData = async () => {
        setLoading(true)
        try {
            const [sRes, dRes] = await Promise.all([
                axiosInstance.get('/api/v1/users/'),
                axiosInstance.get('/api/v1/departments/')
            ])
            setStaff(sRes.data)
            setDepartments(dRes.data)
        } catch {
            toast('Failed to load staff', 'error')
        } finally {
            setLoading(false)
        }
    }

    const getEdit = (member, field) => {
        const ov = edits[member.id]
        if (ov && field in ov) return ov[field]
        if (field === 'is_active') return member.is_active
        return member[field] ?? ''
    }

    const setEdit = (id, field, value) =>
        setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))

    const hasChanges = id => !!edits[id] && Object.keys(edits[id]).length > 0

    const handleSave = async member => {
        const changes = edits[member.id]
        if (!changes) return
        setSavingId(member.id)
        const payload = {}
        if ('role'          in changes) payload.role          = changes.role
        if ('department_id' in changes) payload.department_id = changes.department_id || null
        if ('supervisor_id' in changes) payload.supervisor_id = changes.supervisor_id || null
        if ('is_active'     in changes) payload.is_active     = changes.is_active
        try {
            const res = await axiosInstance.patch(`/api/v1/users/${member.id}`, payload)
            setStaff(prev => prev.map(s => s.id === member.id ? res.data : s))
            setEdits(prev => { const n = { ...prev }; delete n[member.id]; return n })
            toast('Staff member updated', 'success')
        } catch {
            toast('Failed to update staff member', 'error')
        } finally {
            setSavingId(null)
        }
    }

    const doctors = staff.filter(s => s.role === 'doctor')

    const handleAddStaff = async e => {
        e.preventDefault()
        if (newStaff.password !== newStaff.confirm_password) {
            toast('Passwords do not match', 'error')
            return
        }
        setAdding(true)
        try {
            await axiosInstance.post('/api/v1/users/register', {
                full_name:     newStaff.full_name,
                email:         newStaff.email,
                password:      newStaff.password,
                role:          newStaff.role,
                department_id: newStaff.department_id || null,
                supervisor_id: newStaff.supervisor_id || null
            })
            setShowForm(false)
            setNewStaff({ full_name: '', email: '', password: '', confirm_password: '', role: 'nurse', department_id: '', supervisor_id: '' })
            toast('Staff member created successfully', 'success')
            fetchData()
        } catch (err) {
            toast(err.response?.data?.detail || 'Failed to create staff member', 'error')
        } finally {
            setAdding(false)
        }
    }

    if (loading) return <p style={s.center}>Loading staff...</p>

    return (
        <div style={s.page}>
            <div style={s.header}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    <button style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.7)', border: '1.5px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#475569', marginTop: '4px' }} onClick={() => navigate('/dashboard')}>← Back</button>
                    <div>
                    <h2 style={s.title}>Staff Management</h2>
                    <p style={s.count}>{staff.length} staff members</p>
                    </div>
                </div>
                <button style={showForm ? s.cancelBtn : s.addBtn}
                    onClick={() => setShowForm(v => !v)}>
                    {showForm ? 'Cancel' : '+ Add Staff'}
                </button>
            </div>

            {/* Add form */}
            {showForm && (
                <div style={{ ...glass, padding: '24px 28px', marginBottom: '20px' }}>
                    <h3 style={s.formTitle}>New Staff Member</h3>
                    <form onSubmit={handleAddStaff} style={s.addFormInner}>
                        <div style={s.formGrid}>
                            <FormField label="Full Name *">
                                <input style={s.fi} type="text" required value={newStaff.full_name}
                                    onChange={e => setNewStaff(p => ({ ...p, full_name: e.target.value }))} />
                            </FormField>
                            <FormField label="Email *">
                                <input style={s.fi} type="email" required value={newStaff.email}
                                    onChange={e => setNewStaff(p => ({ ...p, email: e.target.value }))} />
                            </FormField>
                            <FormField label="Password *">
                                <div style={{ position: 'relative' }}>
                                    <input style={s.fi} type={showPass ? 'text' : 'password'} required value={newStaff.password}
                                        onChange={e => setNewStaff(p => ({ ...p, password: e.target.value }))} />
                                    <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#94a3b8' }}>
                                        {showPass ? '🙈' : '👁'}
                                    </button>
                                </div>
                            </FormField>
                            <FormField label="Confirm Password *">
                                <input style={{ ...s.fi, borderColor: newStaff.confirm_password && newStaff.password !== newStaff.confirm_password ? '#ef4444' : '#e2e8f0' }}
                                    type={showPass ? 'text' : 'password'} required value={newStaff.confirm_password}
                                    onChange={e => setNewStaff(p => ({ ...p, confirm_password: e.target.value }))} />
                                {newStaff.confirm_password && newStaff.password !== newStaff.confirm_password && (
                                    <p style={{ color: '#ef4444', fontSize: '11px', margin: '4px 0 0' }}>Passwords do not match</p>
                                )}
                            </FormField>
                            <FormField label="Role *">
                                <select style={s.fi} value={newStaff.role}
                                    onChange={e => setNewStaff(p => ({ ...p, role: e.target.value, supervisor_id: '' }))}>
                                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </FormField>
                            <FormField label="Department *">
                                <select style={s.fi} value={newStaff.department_id} required
                                    onChange={e => setNewStaff(p => ({ ...p, department_id: e.target.value }))}>
                                    <option value="">— None —</option>
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </FormField>
                            <FormField label={newStaff.role === 'nurse' ? 'Supervising Doctor' : 'Supervisor'}>
                                <select style={s.fi} value={newStaff.supervisor_id}
                                    onChange={e => setNewStaff(p => ({ ...p, supervisor_id: e.target.value }))}>
                                    <option value="">— None —</option>
                                    {(newStaff.role === 'nurse' ? doctors : staff).map(s => (
                                        <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>
                                    ))}
                                </select>
                            </FormField>
                        </div>
                        <button type="submit" style={s.createBtn} disabled={adding}>
                            {adding ? 'Creating...' : 'Create Staff Member'}
                        </button>
                    </form>
                </div>
            )}

            {/* Staff table */}
            <div style={{ ...glass, overflow: 'hidden' }}>
                <table style={s.table}>
                    <thead>
                        <tr style={s.thead}>
                            <th style={s.th}>Name</th>
                            <th style={s.th}>Email</th>
                            <th style={s.th}>Role</th>
                            <th style={s.th}>Department</th>
                            <th style={s.th}>Supervisor</th>
                            <th style={s.th}>Active</th>
                            <th style={s.th}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {staff.map(member => {
                            const currentRole = getEdit(member, 'role')
                            const pill = ROLE_PILL[member.role] || ROLE_PILL.admin
                            return (
                                <tr key={member.id} style={s.row}>
                                    <td style={s.td}>
                                        <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '13px' }}>{member.full_name}</div>
                                    </td>
                                    <td style={{ ...s.td, color: '#64748b', fontSize: '12px' }}>{member.email}</td>
                                    <td style={s.td}>
                                        <select style={s.sel} value={getEdit(member, 'role')}
                                            onChange={e => setEdit(member.id, 'role', e.target.value)}>
                                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    </td>
                                    <td style={s.td}>
                                        <select style={s.sel} value={getEdit(member, 'department_id')}
                                            onChange={e => setEdit(member.id, 'department_id', e.target.value)}>
                                            <option value="">—</option>
                                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        </select>
                                    </td>
                                    <td style={s.td}>
                                        <select style={s.sel} value={getEdit(member, 'supervisor_id')}
                                            onChange={e => setEdit(member.id, 'supervisor_id', e.target.value)}>
                                            <option value="">—</option>
                                            {staff.filter(x => x.id !== member.id && (currentRole === 'nurse' ? x.role === 'doctor' : true))
                                                .map(x => <option key={x.id} value={x.id}>{x.full_name} ({x.role})</option>)}
                                        </select>
                                    </td>
                                    <td style={s.td}>
                                        <input type="checkbox"
                                            checked={getEdit(member, 'is_active')}
                                            disabled={member.id === currentUser?.id}
                                            onChange={e => setEdit(member.id, 'is_active', e.target.checked)} />
                                    </td>
                                    <td style={s.td}>
                                        <button
                                            style={{ ...s.saveBtn, ...(hasChanges(member.id) ? {} : s.saveBtnOff) }}
                                            disabled={!hasChanges(member.id) || savingId === member.id}
                                            onClick={() => handleSave(member)}>
                                            {savingId === member.id ? '...' : 'Save'}
                                        </button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function FormField({ label, children }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
            {children}
        </div>
    )
}

const s = {
    page:   { maxWidth: '1100px', margin: '0 auto' },
    center: { textAlign: 'center', padding: '60px', color: '#94a3b8' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' },
    title:  { color: '#0f172a', margin: '0 0 4px', fontSize: '22px', fontWeight: '700' },
    count:  { color: '#94a3b8', margin: 0, fontSize: '13px' },
    addBtn: {
        padding: '8px 20px', background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
        color: 'white', border: 'none', borderRadius: '10px',
        cursor: 'pointer', fontSize: '14px', fontWeight: '700'
    },
    cancelBtn: {
        padding: '8px 20px', background: 'rgba(255,255,255,0.7)',
        border: '1.5px solid #e2e8f0', borderRadius: '10px',
        color: '#64748b', cursor: 'pointer', fontSize: '14px', fontWeight: '600'
    },

    formTitle:    { color: '#0f172a', margin: '0 0 16px', fontSize: '15px', fontWeight: '700' },
    addFormInner: { display: 'flex', flexDirection: 'column', gap: '16px' },
    formGrid:     { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' },
    fi: {
        padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '10px',
        fontSize: '14px', background: '#f8fafc', outline: 'none',
        boxSizing: 'border-box', width: '100%', color: '#0f172a'
    },
    createBtn: {
        padding: '13px 24px', background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
        color: 'white', border: 'none', borderRadius: '10px',
        cursor: 'pointer', fontSize: '15px', fontWeight: '700',
        alignSelf: 'flex-start', boxShadow: '0 4px 14px rgba(16,185,129,0.3)'
    },

    table:  { width: '100%', borderCollapse: 'collapse' },
    thead:  { background: 'linear-gradient(135deg, #0f172a, #1e1b4b)' },
    th:     { padding: '13px 16px', textAlign: 'left', color: 'rgba(255,255,255,0.8)', fontWeight: '600', fontSize: '12px', letterSpacing: '0.04em' },
    row:    { borderBottom: '1px solid rgba(226,232,240,0.6)' },
    td:     { padding: '10px 16px' },
    sel:    {
        padding: '5px 8px', border: '1.5px solid #e2e8f0', borderRadius: '6px',
        fontSize: '12px', background: 'white', color: '#0f172a', outline: 'none'
    },
    saveBtn:    {
        padding: '5px 14px', background: 'linear-gradient(135deg, #059669, #10b981)',
        color: 'white', border: 'none', borderRadius: '6px',
        cursor: 'pointer', fontSize: '12px', fontWeight: '600'
    },
    saveBtnOff: { background: '#e2e8f0', color: '#94a3b8', cursor: 'not-allowed' }
}

export default StaffList
