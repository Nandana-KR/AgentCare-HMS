import { createContext, useContext, useState, useCallback } from 'react'

const ConfirmCtx = createContext(null)

export function ConfirmProvider({ children }) {
    const [state, setState] = useState(null)

    const confirm = useCallback((message) => {
        return new Promise(resolve => {
            setState({ message, resolve })
        })
    }, [])

    const handleClose = (result) => {
        state?.resolve(result)
        setState(null)
    }

    return (
        <ConfirmCtx.Provider value={confirm}>
            {children}
            {state && (
                <div style={s.overlay} onClick={() => handleClose(false)}>
                    <div style={s.modal} onClick={e => e.stopPropagation()}>
                        <div style={s.icon}>?</div>
                        <p style={s.message}>{state.message}</p>
                        <div style={s.buttons}>
                            <button style={s.cancelBtn} onClick={() => handleClose(false)}>
                                Cancel
                            </button>
                            <button style={s.okBtn} onClick={() => handleClose(true)}>
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmCtx.Provider>
    )
}

export const useConfirm = () => useContext(ConfirmCtx)

const s = {
    overlay: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 10000
    },
    modal: {
        background: 'white', borderRadius: '16px', padding: '32px',
        maxWidth: '380px', width: '90%', textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        animation: 'fadeIn 0.15s ease-out'
    },
    icon: {
        width: '48px', height: '48px', borderRadius: '50%',
        background: 'linear-gradient(135deg, #dbeafe, #e0f2fe)',
        color: '#1e3a8a', fontSize: '22px', fontWeight: '700',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px'
    },
    message: {
        color: '#1e293b', fontSize: '15px', fontWeight: '500',
        lineHeight: '1.5', margin: '0 0 24px'
    },
    buttons: {
        display: 'flex', gap: '10px', justifyContent: 'center'
    },
    cancelBtn: {
        padding: '10px 24px', background: '#f1f5f9', color: '#475569',
        border: '1.5px solid #e2e8f0', borderRadius: '10px',
        fontSize: '14px', fontWeight: '600', cursor: 'pointer', flex: 1
    },
    okBtn: {
        padding: '10px 24px', background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
        color: 'white', border: 'none', borderRadius: '10px',
        fontSize: '14px', fontWeight: '700', cursor: 'pointer', flex: 1,
        boxShadow: '0 4px 14px rgba(59,130,246,0.3)'
    }
}
