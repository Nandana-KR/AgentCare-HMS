import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { fetchAppointmentsWithPhone } from '../utils/mergePhone'
import { glass } from '../styles/glass'

const MODE_CONFIG = {
    diagnoses: { title: 'Diagnoses', subtitle: 'Select a patient to record diagnosis', accent: '#8b5cf6' },
    vitals:    { title: 'Vitals',    subtitle: 'Select a patient to record vitals',    accent: '#10b981' },
    prognosis: { title: 'Prognosis', subtitle: 'Select a patient to view prognosis',   accent: '#14b8a6' }
}

const fmtDate = d => new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit'
})

function ScheduledPatients() {
    const location = useLocation()
    const mode = location.pathname.replace('/', '')
    const navigate = useNavigate()
    const config = MODE_CONFIG[mode] || MODE_CONFIG.diagnoses

    const [appointments, setAppointments] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    useEffect(() => {
        fetchAppointmentsWithPhone()
            .then(data => {
                const today = new Date()
                const todayStr = today.toISOString().split('T')[0]
                const filtered = data.filter(a => {
                    const isToday = a.scheduled_at?.startsWith(todayStr)
                    const isScheduled = a.status === 'scheduled'
                    return isToday || isScheduled
                }).filter(a => a.status !== 'cancelled')
                setAppointments(filtered)
            })
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [])

    const patients = useMemo(() => {
        const map = new Map()
        appointments.forEach(a => {
            if (!map.has(a.patient_id)) {
                map.set(a.patient_id, {
                    patient_id: a.patient_id,
                    patient_name: a.patient_name,
                    patient_phone: a.patient_phone || '',
                    patient_age: a.patient_age || '',
                    scheduled_at: a.scheduled_at,
                    doctor_name: a.doctor_name
                })
            }
        })
        return Array.from(map.values()).filter(p =>
            !search || p.patient_name?.toLowerCase().includes(search.toLowerCase()) || p.patient_phone?.includes(search) || p.doctor_name?.toLowerCase().includes(search.toLowerCase())
        )
    }, [appointments, search])

    const handleClick = (patientId) => {
        if (mode === 'diagnoses') navigate(`/patients/${patientId}/diagnosis/new`)
        else if (mode === 'vitals') navigate(`/patients/${patientId}/vitals/new`)
        else if (mode === 'prognosis') navigate(`/patients/${patientId}?tab=prognosis`)
    }

    if (loading) return <p style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>Loading...</p>

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ color: '#0f172a', margin: '0 0 4px', fontSize: '22px', fontWeight: '700' }}>{config.title}</h2>
                    <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>{config.subtitle}</p>
                </div>
                <input
                    style={{ padding: '7px 14px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', width: '220px', color: '#0f172a', background: 'white' }}
                    placeholder="Search name or phone..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {patients.length === 0 ? (
                <div style={{ ...glass, padding: '40px', textAlign: 'center' }}>
                    <p style={{ color: '#94a3b8', fontSize: '15px', margin: 0 }}>No patients with scheduled appointments</p>
                </div>
            ) : (
                <div style={{ ...glass, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'linear-gradient(135deg, #0f172a, #1e3a8a)' }}>
                                <th style={s.th}>Patient</th>
                                <th style={s.th}>Phone</th>
                                <th style={s.th}>Age</th>
                                <th style={s.th}>Appointment</th>
                                <th style={s.th}>Doctor</th>
                                <th style={s.th}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {patients.map(p => (
                                <tr key={p.patient_id} style={s.row} onClick={() => handleClick(p.patient_id)}>
                                    <td style={s.td}>
                                        <span style={{ fontWeight: '600', color: '#0f172a' }}>{p.patient_name}</span>
                                    </td>
                                    <td style={{ ...s.td, color: '#64748b' }}>{p.patient_phone || '—'}</td>
                                    <td style={{ ...s.td, color: '#64748b' }}>{p.patient_age || '—'}</td>
                                    <td style={{ ...s.td, color: '#64748b' }}>{fmtDate(p.scheduled_at)}</td>
                                    <td style={{ ...s.td, color: '#64748b' }}>{p.doctor_name || '—'}</td>
                                    <td style={s.td}>
                                        <span style={{ ...s.goBtn, background: config.accent }}>
                                            {mode === 'diagnoses' ? 'Diagnose' : mode === 'vitals' ? 'Record' : 'View'}  →
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

const s = {
    th: { padding: '12px 16px', textAlign: 'left', color: 'white', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' },
    td: { padding: '14px 16px', fontSize: '14px', borderBottom: '1px solid rgba(226,232,240,0.5)' },
    row: { cursor: 'pointer', transition: 'background 0.15s' },
    goBtn: { color: 'white', fontSize: '12px', fontWeight: '600', padding: '5px 14px', borderRadius: '6px', whiteSpace: 'nowrap' }
}

export default ScheduledPatients
