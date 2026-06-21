import axiosInstance from '../api/axiosInstance'

export const drName = name => {
    if (!name) return '—'
    return name.toLowerCase().startsWith('dr') ? name : `Dr. ${name}`
}

export const displayName = (name, role) => {
    if (!name) return '—'
    if (role === 'doctor') return drName(name)
    return name
}

export async function fetchAppointmentsWithPhone() {
    const [aptsRes, patsRes] = await Promise.all([
        axiosInstance.get('/api/v1/appointments/'),
        axiosInstance.get('/api/v1/patients/?limit=1000')
    ])
    const patientMap = {}
    patsRes.data.forEach(p => {
        let age = ''
        if (p.date_of_birth) {
            age = Math.floor((new Date() - new Date(p.date_of_birth)) / (365.25 * 86400000))
        }
        patientMap[p.id] = { phone: p.phone || '', age }
    })
    return aptsRes.data.map(a => ({
        ...a,
        patient_phone: a.patient_phone || patientMap[a.patient_id]?.phone || '',
        patient_age: patientMap[a.patient_id]?.age || '',
        doctor_name: drName(a.doctor_name)
    }))
}
