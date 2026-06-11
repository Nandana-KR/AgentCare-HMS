import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import PatientList from './pages/PatientList'
import PatientDetail from './pages/PatientDetail'
import PatientForm from './pages/PatientForm'
import DiagnosisForm from './pages/DiagnosisForm'
import PrognosisPage from './pages/PrognosisPage'

function ProtectedRoute({ children }) {
    const { token } = useAuth()
    if (!token) {
        return <Navigate to="/login" />
    }
    return <Layout>{children}</Layout>
}

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route
                        path="/login"
                        element={<LoginPage />}
                    />
                    <Route
                        path="/dashboard"
                        element={
                            <ProtectedRoute>
                                <Dashboard />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/patients"
                        element={
                            <ProtectedRoute>
                                <PatientList />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/patients/new"
                        element={
                            <ProtectedRoute>
                                <PatientForm />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/patients/:id"
                        element={
                            <ProtectedRoute>
                                <PatientDetail />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/patients/:patientId/diagnosis/new"
                        element={
                            <ProtectedRoute>
                                <DiagnosisForm />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/prognosis/:diagnosisId"
                        element={
                            <ProtectedRoute>
                                <PrognosisPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/"
                        element={<Navigate to="/login" />}
                    />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    )
}

export default App