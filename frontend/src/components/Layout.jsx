import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'

function Layout({ children }) {
    const [mobileOpen, setMobileOpen] = useState(false)
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768
            setIsMobile(mobile)
            if (!mobile) setMobileOpen(false)
        }
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    // Close sidebar when navigating on mobile
    useEffect(() => {
        if (isMobile && mobileOpen) setMobileOpen(false)
    }, [children])

    return (
        <div style={styles.container}>
            {/* Mobile header with hamburger */}
            {isMobile && (
                <div style={styles.mobileHeader}>
                    <button style={styles.hamburger} onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
                        <span style={styles.hamburgerLine} />
                        <span style={styles.hamburgerLine} />
                        <span style={styles.hamburgerLine} />
                    </button>
                    <span style={styles.mobileTitle}>
                        <span style={styles.mobileLogo}>+</span> HMS
                    </span>
                    <div style={{ width: 32 }} />
                </div>
            )}

            {/* Overlay */}
            {isMobile && mobileOpen && (
                <div style={styles.overlay} onClick={() => setMobileOpen(false)} />
            )}

            {/* Sidebar */}
            <div style={{
                ...styles.sidebarWrap,
                ...(isMobile ? {
                    position: 'fixed',
                    top: 0,
                    left: mobileOpen ? 0 : '-270px',
                    zIndex: 1000,
                    transition: 'left 0.25s ease'
                } : {})
            }}>
                <Sidebar />
            </div>

            {/* Main content */}
            <main style={{
                ...styles.main,
                ...(isMobile ? { paddingTop: '68px' } : {})
            }}>
                {children}
            </main>
        </div>
    )
}

const styles = {
    container: {
        display: 'flex',
        minHeight: '100vh',
        position: 'relative'
    },
    sidebarWrap: {},
    main: {
        flex: 1,
        padding: '28px 32px',
        overflowY: 'auto',
        minHeight: '100vh'
    },
    mobileHeader: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '56px',
        background: 'linear-gradient(135deg, #0f172a, #1e3a8a)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 999,
        boxShadow: '0 2px 12px rgba(0,0,0,0.15)'
    },
    hamburger: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '8px'
    },
    hamburgerLine: {
        width: '22px',
        height: '2.5px',
        background: 'white',
        borderRadius: '2px'
    },
    mobileTitle: {
        color: 'white',
        fontSize: '18px',
        fontWeight: '700',
        letterSpacing: '2px'
    },
    mobileLogo: {
        color: '#f87171',
        fontWeight: '900',
        fontSize: '20px'
    },
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 999
    }
}

export default Layout
