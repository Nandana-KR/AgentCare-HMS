import { createContext, useState, useContext, useEffect } from 'react'
import axiosInstance from '../api/axiosInstance'

const AuthContext = createContext()

function getSavedUser() {
    try {
        return JSON.parse(localStorage.getItem('user'))
    } catch {
        localStorage.removeItem('user')
        return null
    }
}

export function AuthProvider({ children }) {
    const savedToken = localStorage.getItem('token') || null
    const savedUser = savedToken ? getSavedUser() : null
    const [user, setUser] = useState(savedUser)
    const [token, setToken] = useState(savedToken)
    const [loading, setLoading] = useState(Boolean(savedToken && !savedUser))

    // When app loads, if token exists fetch user profile
    useEffect(() => {
        const restoreUser = async () => {
            const savedToken = localStorage.getItem('token')
            if (savedToken) {
                try {
                    const response = await axiosInstance.get('/me')
                    setUser(response.data)
                    localStorage.setItem('user', JSON.stringify(response.data))
                } catch (err) {
                    // Token expired or invalid
                    localStorage.removeItem('token')
                    localStorage.removeItem('user')
                    setUser(null)
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
        localStorage.setItem('user', JSON.stringify(userData))
    }

    const logout = () => {
        setUser(null)
        setToken(null)
        localStorage.removeItem('token')
        localStorage.removeItem('user')
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
