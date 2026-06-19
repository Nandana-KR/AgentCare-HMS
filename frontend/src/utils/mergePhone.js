import axiosInstance from '../api/axiosInstance'

export async function fetchAppointmentsWithPhone() {
    const [aptsRes, patsRes] = await Promise.all([
        axiosInstance.get('/api/v1/appointments/'),
        axiosInstance.get('/api/v1/patients/')
    ])
    const phoneMap = {}
    patsRes.data.forEach(p => { phoneMap[p.id] = p.phone || '' })
    return aptsRes.data.map(a => ({
        ...a,
        patient_phone: a.patient_phone || phoneMap[a.patient_id] || ''
    }))
}
