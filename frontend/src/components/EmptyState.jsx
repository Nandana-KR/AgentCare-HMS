/**
 * Reusable empty state component.
 * Shows a friendly message with optional action button when no data exists.
 */
function EmptyState({ icon, title, description, actionLabel, onAction }) {
    return (
        <div style={styles.container}>
            {icon && <div style={styles.icon}>{icon}</div>}
            <h3 style={styles.title}>{title}</h3>
            {description && <p style={styles.description}>{description}</p>}
            {actionLabel && onAction && (
                <button style={styles.button} onClick={onAction}>
                    {actionLabel}
                </button>
            )}
        </div>
    )
}

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 24px',
        textAlign: 'center'
    },
    icon: {
        fontSize: '48px',
        marginBottom: '16px',
        opacity: 0.6
    },
    title: {
        margin: '0 0 8px',
        fontSize: '18px',
        fontWeight: '600',
        color: '#1e293b'
    },
    description: {
        margin: '0 0 20px',
        fontSize: '14px',
        color: '#64748b',
        maxWidth: '360px',
        lineHeight: '1.5'
    },
    button: {
        padding: '10px 24px',
        background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
        color: 'white',
        border: 'none',
        borderRadius: '10px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer'
    }
}

export default EmptyState
