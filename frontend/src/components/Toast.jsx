import { createContext, useContext, useState, useCallback } from 'react'

const ToastCtx = createContext(null)

const STYLE = {
    success: { bg: 'rgba(240,253,244,0.96)', color: '#166534', border: '#bbf7d0', icon: '✓' },
    error:   { bg: 'rgba(254,242,242,0.96)', color: '#991b1b', border: '#fecaca', icon: '✕' },
    warning: { bg: 'rgba(255,251,235,0.96)', color: '#92400e', border: '#fde68a', icon: '⚠' }
}

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([])

    const toast = useCallback((msg, type = 'success') => {
        const id = Date.now()
        setToasts(prev => [...prev, { id, msg, type }])
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
    }, [])

    return (
        <ToastCtx.Provider value={toast}>
            {children}
            <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none' }}>
                {toasts.map(t => {
                    const st = STYLE[t.type] || STYLE.success
                    return (
                        <div key={t.id} style={{
                            padding: '12px 18px',
                            borderRadius: '12px',
                            fontSize: '14px',
                            fontWeight: '600',
                            boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
                            backdropFilter: 'blur(12px)',
                            border: `1px solid ${st.border}`,
                            background: st.bg,
                            color: st.color,
                            maxWidth: '320px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <span style={{ fontSize: '16px', flexShrink: 0 }}>{st.icon}</span>
                            {t.msg}
                        </div>
                    )
                })}
            </div>
        </ToastCtx.Provider>
    )
}

export const useToast = () => useContext(ToastCtx)
