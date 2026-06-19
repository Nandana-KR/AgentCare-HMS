export const colors = {
    primary: '#3b82f6',
    primaryDark: '#1e3a8a',
    accent: '#8b5cf6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    text: {
        dark: '#0f172a',
        body: '#334155',
        secondary: '#64748b',
        muted: '#94a3b8'
    },
    border: '#e2e8f0',
    bg: {
        input: 'white',
        hover: 'rgba(241,245,249,0.6)'
    }
}

export const gradients = {
    primary: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
    accent: 'linear-gradient(135deg, #6d28d9, #8b5cf6)',
    dark: 'linear-gradient(135deg, #0f172a, #1e3a8a)',
    success: 'linear-gradient(135deg, #10b981, #059669)',
    danger: 'linear-gradient(135deg, #dc2626, #991b1b)',
    tableHeader: 'linear-gradient(135deg, #0f172a, #1e3a8a)'
}

export const radius = {
    sm: '6px',
    md: '10px',
    lg: '14px',
    xl: '16px',
    full: '50%'
}

export const shadows = {
    sm: '0 2px 8px rgba(0,0,0,0.06)',
    md: '0 4px 14px rgba(59,130,246,0.2)',
    lg: '0 6px 24px rgba(30,58,138,0.25)'
}

export const fonts = {
    label: { fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' },
    body: { fontSize: '14px', color: '#334155' },
    small: { fontSize: '12px', color: '#64748b' },
    title: { fontSize: '22px', fontWeight: '700', color: '#0f172a' },
    section: { fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.1em' }
}

export const buttons = {
    primary: {
        padding: '12px 24px', background: gradients.primary,
        color: 'white', border: 'none', borderRadius: radius.md,
        fontSize: '15px', fontWeight: '700', cursor: 'pointer',
        boxShadow: shadows.md
    },
    accent: {
        padding: '12px 24px', background: gradients.accent,
        color: 'white', border: 'none', borderRadius: radius.md,
        fontSize: '15px', fontWeight: '700', cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(139,92,246,0.3)'
    },
    outline: {
        padding: '4px 12px', fontSize: '12px', fontWeight: '600',
        background: 'rgba(59,130,246,0.1)', color: '#3b82f6',
        border: '1.5px solid rgba(59,130,246,0.2)', borderRadius: radius.sm,
        cursor: 'pointer'
    },
    back: {
        padding: '8px 16px', background: 'rgba(255,255,255,0.7)',
        border: '1.5px solid #e2e8f0', borderRadius: '8px',
        cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#475569'
    }
}

export const input = {
    padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: radius.md,
    fontSize: '14px', background: 'white', outline: 'none',
    boxSizing: 'border-box', width: '100%', color: '#0f172a'
}

export const search = {
    padding: '7px 14px', border: '1.5px solid #e2e8f0', borderRadius: '8px',
    fontSize: '13px', outline: 'none', width: '220px', color: '#0f172a', background: 'white'
}
