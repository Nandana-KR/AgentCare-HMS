import { createContext, useState, useContext } from 'react'

// Create the context object
const AuthContext = createContext()

// This component wraps your entire app
// Any component inside can access auth data
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [token, setToken] = useState(
        localStorage.getItem('token') || null
    )

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

    return (
        <AuthContext.Provider value={{ user, token, login, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

// Custom hook — makes using auth context easier
export function useAuth() {
    return useContext(AuthContext)
}