/**
 * Reusable loading spinner component.
 * Used across the app to replace plain "Loading..." text.
 */
function Spinner({ size = 40, message = 'Loading...', fullPage = false }) {
    const containerStyle = fullPage ? styles.fullPage : styles.inline

    return (
        <div style={containerStyle}>
            <div style={{ ...styles.spinner, width: size, height: size }} />
            {message && <p style={styles.message}>{message}</p>}
        </div>
    )
}

const styles = {
    fullPage: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '16px'
    },
    inline: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        gap: '16px'
    },
    spinner: {
        border: '3px solid #e2e8f0',
        borderTopColor: '#3b82f6',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
    },
    message: {
        margin: 0,
        fontSize: '14px',
        color: '#64748b',
        fontWeight: '500'
    }
}

export default Spinner
