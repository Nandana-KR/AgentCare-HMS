import axios from 'axios'

// Base URL of your FastAPI backend
const axiosInstance = axios.create({
    baseURL: 'http://localhost:8000',
})

// This runs before every request
// It automatically adds the token to every API call
axiosInstance.interceptors.request.use((config) => {
    const token = localStorage.getItem('token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

export default axiosInstance