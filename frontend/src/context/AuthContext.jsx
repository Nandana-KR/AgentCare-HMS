import { createContext, useState, useContext, useEffect } from 'react'
import axiosInstance from '../api/axiosInstance'

const AuthContext = createContext()

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [token, setToken] = useState(
        localStorage.getItem('token') || null
    )
    const [loading, setLoading] = useState(true)

    // When app loads, if token exists fetch user profile
    useEffect(() => {
        const restoreUser = async () => {
            const savedToken = localStorage.getItem('token')
            if (savedToken) {
                try {
                    const response = await axiosInstance.get('/me')
                    setUser(response.data)
                } catch (err) {
                    // Token expired or invalid
                    localStorage.removeItem('token')
                    setToken(null)
                }
            }
            setLoading(false)
        }
        restoreUser()
    }, [])

    const login = (userData, accessToken) => {
        setUser(userData)
        setToken(accessToken)
        localStorage.setItem('token', accessToken)
    }

    const logout = () => {
        setUser(null)
        setToken(null)
        localStorage.removeItem('token')
    }

    if (loading) return <p>Loading...</p>

    return (
        <AuthContext.Provider value={{ user, token, login, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    return useContext(AuthContext)
}