import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axiosInstance from '../api/axiosInstance'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { glass } from '../styles/glass'

const fmtDateTime = d => new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit'
})

function DiagnosisForm() {
    const { patientId } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const toast = useToast()
    const isDoctor = user?.role === 'doctor'

    const [patient,      setPatient]      = useState(null)
    const [appointments, setAppointments] = useState([])
    const [apptId,       setApptId]       = useState('')
    const [loadingData,  setLoadingData]  = useState(true)
    const [loading,      setLoading]      = useState(false)
    const [error,        setError]        = useState(null)

    const [symptoms,      setSymptoms]      = useState('')
    const [diagnosisText, setDiagnosisText] = useState('')
    const [icdCode,       setIcdCode]       = useState('')
    const [prescription,  setPrescription]  = useState('')
    const [followUp,      setFollowUp]      = useState('')

    const [aiRunning,  setAiRunning]  = useState(false)
    const [aiReport,   setAiReport]   = useState(null)
    const [showTrace,  setShowTrace]  = useState(false)

    const [isListening, setIsListening] = useState(false)
    const [activeField, setActiveField] = useState(null)
    const recognitionRef = useRef(null)

    useEffect(() => {
        Promise.all([
            axiosInstance.get(`/api/v1/patients/${patientId}`),
            axiosInstance.get(`/api/v1/appointments/patient/${patientId}`)
        ]).then(([p, a]) => {
            setPatient(p.data)
            const valid = a.data.filter(x => x.status !== 'cancelled')
            setAppointments(valid)
            if (valid.length === 1) setApptId(valid[0].id)
        }).catch(() => setError('Failed to load patient data'))
          .finally(() => setLoadingData(false))
    }, [patientId])

    useEffect(() => {
        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition
        recognitionRef.current = new SR()
        recognitionRef.current.continuous = true
        recognitionRef.current.interimResults = true
        recognitionRef.current.lang = 'en-US'
        recognitionRef.current.onresult = event => {
            let t = ''
            for (let i = 0; i < event.results.length; i++) t += event.results[i][0].transcript
            if (activeField === 'symptoms')     setSymptoms(t)
            if (activeField === 'diagnosis')    setDiagnosisText(t)
            if (activeField === 'prescription') setPrescription(t)
            if (activeField === 'followup')     setFollowUp(t)
        }
        recognitionRef.current.onend = () => { setIsListening(false); setActiveField(null) }
    }, [activeField])

    const toggleVoice = field => {
        if (!recognitionRef.current) {
            toast('Voice not supported. Use Chrome.', 'warning')
            return
        }
        if (isListening) { recognitionRef.current.stop(); return }
        setActiveField(field)
        setIsListening(true)
        recognitionRef.current.start()
    }

    const runAgent = async () => {
        if (!symptoms.trim()) { toast('Enter symptoms first', 'warning'); return }
        setAiRunning(true)
        setAiReport(null)
        try {
            const res = await axiosInstance.post('/api/v1/diagnoses/ai-diagnose', {
                patient_id: patientId, symptoms
            })
            const r = res.data
            setAiReport(r)
            setDiagnosisText(r.diagnosis_text || '')
            setIcdCode(r.icd_code || '')
            setPrescription(r.prescription || '')
            setFollowUp(r.follow_up || '')
            toast('AI agent completed — review before saving', 'success')
        } catch {
            toast('AI agent failed. Fill manually.', 'error')
        } finally {
            setAiRunning(false)
        }
    }

    const handleSubmit = async e => {
        e.preventDefault()
        if (!apptId) { setError('Select an appointment first.'); return }
        setLoading(true)
        setError(null)
        try {
            await axiosInstance.post('/api/v1/diagnoses/', {
                patient_id: patientId, appointment_id: apptId,
                symptoms, diagnosis_text: diagnosisText,
                icd_code: icdCode || null,
                prescription: prescription || null,
                follow_up: followUp || null
            })
            toast('Diagnosis saved', 'success')
            navigate(`/patients/${patientId}?tab=diagnoses`)
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to save.')
        } finally {
            setLoading(false)
        }
    }

    if (loadingData) return <p style={s.center}>Loading...</p>

    return (
        <div style={s.page}>
            {/* Header */}
            <div style={s.header}>
                <button style={s.backBtn} onClick={() => navigate(`/patients/${patientId}?tab=diagnoses`)}>← Back</button>
                <div>
                    <h2 style={s.title}>New Diagnosis</h2>
                    {patient && <p style={s.subtitle}>{patient.full_name}</p>}
                </div>
            </div>

            {!isDoctor && <div style={s.warnBox}>Only doctors can submit diagnoses.</div>}
            {appointments.length === 0 && <div style={s.warnBox}>No appointments found. Book one first.</div>}

            <div style={s.columns}>
                {/* ── LEFT: Form ── */}
                <div style={s.formCol}>
                    <div style={{ ...glass, padding: '28px 32px' }}>
                        {error && <div style={s.errorBox}>{error}</div>}
                        <form onSubmit={handleSubmit} style={s.form}>
                            {/* Appointment */}
                            <div style={s.field}>
                                <label style={s.label}>Appointment *</label>
                                {appointments.length === 0 ? (
                                    <p style={{ color: '#ef4444', fontSize: '13px', margin: 0 }}>None available</p>
                                ) : (
                                    <select style={s.input} value={apptId} onChange={e => setApptId(e.target.value)} required>
                                        <option value="">— Select —</option>
                                        {appointments.map(a => (
                                            <option key={a.id} value={a.id}>{fmtDateTime(a.scheduled_at)} · {a.status}</option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {/* Symptoms + Voice */}
                            <VoiceField label="Symptoms *" value={symptoms} onChange={setSymptoms}
                                field="symptoms" active={activeField} listening={isListening} onVoice={toggleVoice} required />

                            {/* AI Agent Button */}
                            {isDoctor && symptoms.trim().length > 3 && (
                                <button type="button" style={s.aiBtn} onClick={runAgent} disabled={aiRunning}>
                                    {aiRunning ? (
                                        <span style={s.aiBtnInner}>
                                            <span style={s.spinner} />
                                            Agent is investigating...
                                        </span>
                                    ) : '🧠 AI Agent — Diagnose'}
                                </button>
                            )}

                            {/* Agent Running Animation */}
                            {aiRunning && (
                                <div style={s.agentBox}>
                                    <div style={s.agentPulse} />
                                    <div>
                                        <p style={s.agentTitle}>ReAct Agent Running</p>
                                        <p style={s.agentSub}>Reasoning → Calling tools → Observing → Repeating...</p>
                                        <p style={s.agentSub}>Checking emergency flags, patient history, vitals, medications, similar cases...</p>
                                    </div>
                                </div>
                            )}

                            {/* Diagnosis fields (auto-filled by AI) */}
                            <VoiceField label="Diagnosis *" value={diagnosisText} onChange={setDiagnosisText}
                                field="diagnosis" active={activeField} listening={isListening} onVoice={toggleVoice} required />

                            <div style={s.field}>
                                <label style={s.label}>ICD Code</label>
                                <input style={s.input} value={icdCode} onChange={e => setIcdCode(e.target.value)} placeholder="e.g. J06.9" />
                            </div>

                            <VoiceField label="Prescription" value={prescription} onChange={setPrescription}
                                field="prescription" active={activeField} listening={isListening} onVoice={toggleVoice} />

                            <VoiceField label="Follow Up" value={followUp} onChange={setFollowUp}
                                field="followup" active={activeField} listening={isListening} onVoice={toggleVoice} />

                            <button type="submit" style={{
                                ...s.submitBtn,
                                ...(appointments.length === 0 ? { opacity: 0.5, cursor: 'not-allowed' } : {})
                            }} disabled={loading || appointments.length === 0}>
                                {loading ? 'Saving...' : 'Save Diagnosis'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* ── RIGHT: AI Report ── */}
                {aiReport && (
                    <div style={s.reportCol}>

                        {/* Urgency Banner */}
                        {aiReport.urgency === 'emergency' && (
                            <div style={s.emergencyBanner}>EMERGENCY — Immediate attention required</div>
                        )}

                        {/* Confidence Overview */}
                        {aiReport.confidence_breakdown && (
                            <div style={s.reportCard}>
                                <h3 style={s.reportTitle}>Confidence Breakdown</h3>
                                <div style={s.confGrid}>
                                    {Object.entries(aiReport.confidence_breakdown).map(([k, v]) => (
                                        <div key={k} style={s.confItem}>
                                            <div style={s.confBar}>
                                                <div style={{ ...s.confFill, width: `${v}%`, background: v >= 70 ? '#10b981' : v >= 40 ? '#f59e0b' : '#ef4444' }} />
                                            </div>
                                            <span style={s.confLabel}>{k.replace(/_/g, ' ')}</span>
                                            <span style={s.confVal}>{v}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Differentials */}
                        {aiReport.differentials?.length > 0 && (
                            <div style={s.reportCard}>
                                <h3 style={s.reportTitle}>Differential Diagnoses</h3>
                                {aiReport.differentials.map((d, i) => (
                                    <div key={i} style={s.diffRow}>
                                        <div style={s.diffHeader}>
                                            <span style={s.diffRank}>#{i + 1}</span>
                                            <span style={s.diffName}>{d.diagnosis}</span>
                                            <span style={{
                                                ...s.confBadge,
                                                background: d.confidence >= 70 ? '#dcfce7' : d.confidence >= 40 ? '#fef9c3' : '#fee2e2',
                                                color: d.confidence >= 70 ? '#166534' : d.confidence >= 40 ? '#854d0e' : '#991b1b'
                                            }}>{d.confidence}%</span>
                                        </div>
                                        <p style={s.diffCode}>ICD: {d.icd_code}</p>
                                        <p style={s.diffReason}>{d.reasoning}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Warnings */}
                        {aiReport.warnings?.length > 0 && (
                            <div style={s.warningCard}>
                                <h3 style={s.warningTitle}>Safety Warnings</h3>
                                {aiReport.warnings.map((w, i) => (
                                    <div key={i} style={s.warningRow}><span style={s.warningDot} />{w}</div>
                                ))}
                            </div>
                        )}

                        {/* Recommended Tests */}
                        {aiReport.recommended_tests?.length > 0 && (
                            <div style={s.reportCard}>
                                <h3 style={s.reportTitle}>Recommended Tests</h3>
                                <div style={s.tagList}>
                                    {aiReport.recommended_tests.map((t, i) => (
                                        <span key={i} style={s.tag}>{t}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Watchlist */}
                        {aiReport.watchlist?.length > 0 && (
                            <div style={s.reportCard}>
                                <h3 style={s.reportTitle}>Watchlist</h3>
                                {aiReport.watchlist.map((w, i) => (
                                    <div key={i} style={s.watchRow}><span style={s.watchDot} />{w}</div>
                                ))}
                            </div>
                        )}

                        {/* Lifestyle */}
                        {aiReport.lifestyle_advice && (
                            <div style={s.reportCard}>
                                <h3 style={s.reportTitle}>Lifestyle Advice</h3>
                                <p style={s.reportText}>{aiReport.lifestyle_advice}</p>
                            </div>
                        )}

                        {/* Clinical Notes */}
                        {aiReport.clinical_notes && (
                            <div style={s.reportCard}>
                                <h3 style={s.reportTitle}>Clinical Notes</h3>
                                <p style={s.reportText}>{aiReport.clinical_notes}</p>
                            </div>
                        )}

                        {/* Reasoning Trace (collapsible) */}
                        {aiReport.reasoning_trace?.length > 0 && (
                            <div style={s.reportCard}>
                                <button type="button" style={s.traceToggle} onClick={() => setShowTrace(v => !v)}>
                                    {showTrace ? '▾' : '▸'} Agent Reasoning Trace ({aiReport.total_steps} steps, {aiReport.tools_called?.length} tool calls)
                                </button>
                                {showTrace && (
                                    <div style={s.traceList}>
                                        {aiReport.reasoning_trace.map((t, i) => (
                                            <div key={i} style={s.traceStep}>
                                                <div style={s.traceHeader}>
                                                    <span style={s.traceNum}>Step {t.step}</span>
                                                    <span style={{
                                                        ...s.traceAction,
                                                        background: t.type === 'final' ? '#dcfce7' : '#dbeafe',
                                                        color: t.type === 'final' ? '#166534' : '#1d4ed8'
                                                    }}>
                                                        {t.type === 'final' ? 'FINAL ANSWER' : t.action}
                                                    </span>
                                                </div>
                                                <p style={s.traceThought}>{t.thought}</p>
                                                {t.observation_summary && (
                                                    <p style={s.traceObs}>→ {t.observation_summary}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Meta */}
                        <div style={s.metaBar}>
                            <span style={{
                                ...s.urgBadge,
                                background: aiReport.urgency === 'emergency' ? '#fee2e2' : aiReport.urgency === 'urgent' ? '#fef9c3' : '#dcfce7',
                                color: aiReport.urgency === 'emergency' ? '#991b1b' : aiReport.urgency === 'urgent' ? '#854d0e' : '#166534'
                            }}>{(aiReport.urgency || 'routine').toUpperCase()}</span>
                            <span style={s.modelBadge}>{aiReport.model_used}</span>
                            <span style={s.modelBadge}>{aiReport.total_steps} steps</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function VoiceField({ label, value, onChange, field, active, listening, onVoice, required }) {
    const isActive = listening && active === field
    return (
        <div style={s.field}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={s.label}>{label}</label>
                <button type="button" onClick={() => onVoice(field)} style={{
                    ...s.voiceBtn,
                    background: isActive ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
                }}>{isActive ? '■ Stop' : '🎤 Speak'}</button>
            </div>
            <textarea style={s.textarea} value={value} onChange={e => onChange(e.target.value)}
                placeholder={`${label.replace(' *', '')}...`} rows={3} required={required} />
            {isActive && <p style={{ color: '#ef4444', fontSize: '12px', margin: '4px 0 0', fontWeight: '600' }}>Listening...</p>}
        </div>
    )
}

const s = {
    page: { maxWidth: '1200px', margin: '0 auto' },
    center: { textAlign: 'center', padding: '60px', color: '#94a3b8' },
    header: { display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '24px' },
    backBtn: { padding: '8px 16px', background: 'rgba(255,255,255,0.7)', border: '1.5px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#475569', marginTop: '4px' },
    title: { color: '#0f172a', margin: '0 0 2px', fontSize: '22px', fontWeight: '700' },
    subtitle: { color: '#64748b', margin: 0, fontSize: '14px' },

    columns: { display: 'flex', gap: '24px', alignItems: 'flex-start' },
    formCol: { flex: '1 1 480px', minWidth: 0 },
    reportCol: { flex: '1 1 420px', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '14px' },

    form: { display: 'flex', flexDirection: 'column', gap: '16px' },
    field: { display: 'flex', flexDirection: 'column', gap: '6px' },
    label: { fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' },
    input: { padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', background: 'white', outline: 'none', boxSizing: 'border-box', width: '100%', color: '#0f172a' },
    textarea: { padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', background: 'white', outline: 'none', boxSizing: 'border-box', width: '100%', color: '#0f172a', resize: 'vertical', fontFamily: 'inherit' },
    voiceBtn: { padding: '4px 12px', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' },

    aiBtn: {
        padding: '16px 24px', background: 'linear-gradient(135deg, #0f172a, #1e3a8a)',
        color: 'white', border: 'none', borderRadius: '14px',
        fontSize: '16px', fontWeight: '700', cursor: 'pointer',
        boxShadow: '0 6px 24px rgba(30,58,138,0.35)', textAlign: 'center',
        transition: 'transform 0.1s', position: 'relative', overflow: 'hidden'
    },
    aiBtnInner: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
    spinner: {
        width: '16px', height: '16px', border: '2.5px solid rgba(255,255,255,0.3)',
        borderTopColor: 'white', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite', display: 'inline-block'
    },

    agentBox: {
        background: 'linear-gradient(135deg, #0f172a, #1e1b4b)',
        borderRadius: '14px', padding: '20px 24px',
        display: 'flex', gap: '16px', alignItems: 'center'
    },
    agentPulse: {
        width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
        background: 'radial-gradient(circle, #f59e0b 30%, transparent 70%)',
        animation: 'pulse 1.5s ease-in-out infinite'
    },
    agentTitle: { color: '#f59e0b', fontSize: '14px', fontWeight: '700', margin: '0 0 4px' },
    agentSub: { color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: '0 0 2px' },

    submitBtn: {
        padding: '13px', background: 'linear-gradient(135deg, #6d28d9, #8b5cf6)',
        color: 'white', border: 'none', borderRadius: '10px',
        fontSize: '15px', fontWeight: '700', cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(139,92,246,0.3)'
    },

    warnBox: { background: '#fef9c3', border: '1px solid #fde68a', color: '#854d0e', borderRadius: '10px', padding: '12px 16px', fontSize: '13px', marginBottom: '16px' },
    errorBox: { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '10px', padding: '12px 16px', fontSize: '13px', marginBottom: '8px' },

    emergencyBanner: {
        background: 'linear-gradient(135deg, #dc2626, #991b1b)',
        color: 'white', borderRadius: '14px', padding: '16px 24px',
        fontSize: '16px', fontWeight: '800', textAlign: 'center',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        animation: 'pulse 1s ease-in-out infinite'
    },

    reportCard: { ...glass, padding: '18px 22px' },
    reportTitle: { margin: '0 0 12px', fontSize: '15px', fontWeight: '700', color: '#0f172a' },
    reportText: { margin: 0, fontSize: '13px', color: '#475569', lineHeight: '1.6' },

    confGrid: { display: 'flex', flexDirection: 'column', gap: '10px' },
    confItem: { display: 'flex', alignItems: 'center', gap: '10px' },
    confBar: { flex: 1, height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' },
    confFill: { height: '100%', borderRadius: '4px', transition: 'width 0.6s ease' },
    confLabel: { fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'capitalize', minWidth: '100px' },
    confVal: { fontSize: '12px', fontWeight: '700', color: '#0f172a', minWidth: '32px', textAlign: 'right' },

    diffRow: { padding: '12px 0', borderBottom: '1px solid rgba(226,232,240,0.6)' },
    diffHeader: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' },
    diffRank: { fontSize: '11px', fontWeight: '800', color: '#3b82f6', background: 'rgba(59,130,246,0.1)', borderRadius: '6px', padding: '2px 6px' },
    diffName: { fontSize: '14px', fontWeight: '700', color: '#0f172a', flex: 1 },
    confBadge: { fontSize: '12px', fontWeight: '700', borderRadius: '8px', padding: '3px 10px' },
    diffCode: { fontSize: '11px', color: '#64748b', margin: '2px 0' },
    diffReason: { fontSize: '12px', color: '#475569', margin: '4px 0 0', lineHeight: '1.5' },

    warningCard: { background: 'rgba(254,242,242,0.9)', border: '1.5px solid #fecaca', borderRadius: '16px', padding: '18px 22px' },
    warningTitle: { margin: '0 0 10px', fontSize: '15px', fontWeight: '700', color: '#991b1b' },
    warningRow: { display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '5px 0', fontSize: '13px', color: '#991b1b' },
    warningDot: { width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', flexShrink: 0, marginTop: '6px' },

    watchRow: { display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '5px 0', fontSize: '13px', color: '#475569' },
    watchDot: { width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b', flexShrink: 0, marginTop: '6px' },

    tagList: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
    tag: { fontSize: '12px', fontWeight: '600', color: '#1d4ed8', background: 'rgba(59,130,246,0.1)', borderRadius: '8px', padding: '4px 12px' },

    traceToggle: {
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: '13px', fontWeight: '600', color: '#64748b', padding: 0, textAlign: 'left'
    },
    traceList: { marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' },
    traceStep: { padding: '10px 14px', background: 'rgba(241,245,249,0.8)', borderRadius: '10px', borderLeft: '3px solid #3b82f6' },
    traceHeader: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' },
    traceNum: { fontSize: '11px', fontWeight: '700', color: '#94a3b8' },
    traceAction: { fontSize: '11px', fontWeight: '600', borderRadius: '6px', padding: '2px 8px' },
    traceThought: { fontSize: '12px', color: '#334155', margin: '0 0 4px', lineHeight: '1.5', fontStyle: 'italic' },
    traceObs: { fontSize: '11px', color: '#059669', margin: 0, fontWeight: '600' },

    metaBar: { display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' },
    urgBadge: { fontSize: '11px', fontWeight: '700', borderRadius: '6px', padding: '4px 10px' },
    modelBadge: { fontSize: '11px', fontWeight: '600', color: '#6d28d9', background: 'rgba(139,92,246,0.1)', borderRadius: '6px', padding: '4px 10px' }
}

export default DiagnosisForm
