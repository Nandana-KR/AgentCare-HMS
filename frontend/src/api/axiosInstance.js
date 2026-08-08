import axios from 'axios'

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
})

// Add token to every request
axiosInstance.interceptors.request.use((config) => {
    const token = localStorage.getItem('token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

// Catch expired/invalid tokens globally
axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Don't redirect if already on login or if it's the login request
            const isLoginRequest = error.config?.url?.includes('/auth/login')
            const isOnLogin = window.location.pathname === '/login'
            if (!isLoginRequest && !isOnLogin) {
                localStorage.removeItem('token')
                localStorage.removeItem('user')
                // Store message so LoginPage can show it
                sessionStorage.setItem('session_expired', '1')
                window.location.href = '/login'
            }
        }
        return Promise.reject(error)
    }
)

export default axiosInstance