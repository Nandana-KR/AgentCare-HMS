import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axiosInstance from '../api/axiosInstance'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { glass } from '../styles/glass'

const fmtDate = d => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })

function DiagnosisForm() {
    const { patientId, diagnosisId } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const toast = useToast()
    const isDoctor = user?.role === 'doctor'

    const [patient, setPatient] = useState(null)
    const [activeAppointment, setActiveAppointment] = useState(null)
    const [loadingData, setLoadingData] = useState(true)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const [step, setStep] = useState('input')
    const [savedId, setSavedId] = useState(diagnosisId || null)
    const [symptoms, setSymptoms] = useState('')
    const [diagnosisText, setDiagnosisText] = useState('')
    const [icdCode, setIcdCode] = useState('')
    const [prescription, setPrescription] = useState('')
    const [followUp, setFollowUp] = useState('')

    const [aiRunning, setAiRunning] = useState(false)
    const [aiReport, setAiReport] = useState(null)
    const [showTrace, setShowTrace] = useState(false)

    const [isListening, setIsListening] = useState(false)
    const [activeField, setActiveField] = useState(null)
    const recognitionRef = useRef(null)

    useEffect(() => {
        const load = async () => {
            try {
                const [pRes, aRes] = await Promise.all([
                    axiosInstance.get(`/api/v1/patients/${patientId}`),
                    axiosInstance.get(`/api/v1/appointments/patient/${patientId}`)
                ])
                setPatient(pRes.data)
                const scheduled = aRes.data.find(x => x.status === 'scheduled')
                setActiveAppointment(scheduled || null)

                if (diagnosisId) {
                    const dRes = await axiosInstance.get(`/api/v1/diagnoses/${diagnosisId}`)
                    const d = dRes.data
                    setSymptoms(d.symptoms || '')
                    setDiagnosisText(d.diagnosis_text || '')
                    setIcdCode(d.icd_code || '')
                    setPrescription(d.prescription || '')
                    setFollowUp(d.follow_up || '')
                    setSavedId(d.id)
                    if (d.ai_report) {
                        try { setAiReport(JSON.parse(d.ai_report)) } catch {}
                    }
                    if (d.diagnosis_text === 'Pending AI analysis') {
                        setStep('saved')
                    } else {
                        setStep('complete')
                    }
                } else {
                    const dRes = await axiosInstance.get(`/api/v1/diagnoses/patient/${patientId}`)
                    const pending = dRes.data.find(d => d.diagnosis_text === 'Pending AI analysis')
                    if (pending) {
                        setSymptoms(pending.symptoms || '')
                        setSavedId(pending.id)
                        setStep('saved')
                    }
                }
            } catch {
                setError('Failed to load patient data')
            } finally {
                setLoadingData(false)
            }
        }
        load()
    }, [patientId, diagnosisId])

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
            if (activeField === 'symptoms') setSymptoms(t)
            if (activeField === 'diagnosis') setDiagnosisText(t)
            if (activeField === 'prescription') setPrescription(t)
            if (activeField === 'followup') setFollowUp(t)
        }
        recognitionRef.current.onend = () => { setIsListening(false); setActiveField(null) }
    }, [activeField])

    const toggleVoice = field => {
        if (!recognitionRef.current) { toast('Voice not supported. Use Chrome.', 'warning'); return }
        if (isListening) { recognitionRef.current.stop(); return }
        setActiveField(field)
        setIsListening(true)
        recognitionRef.current.start()
    }

    const saveSymptoms = async () => {
        if (!symptoms.trim()) { toast('Enter symptoms first', 'warning'); return }
        if (!activeAppointment) { toast('No active appointment found', 'error'); return }
        setLoading(true)
        setError(null)
        try {
            const res = await axiosInstance.post('/api/v1/diagnoses/', {
                patient_id: patientId,
                appointment_id: activeAppointment.id,
                symptoms
            })
            setSavedId(res.data.id)
            setStep('saved')
            toast('Symptoms saved', 'success')
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to save symptoms.')
        } finally {
            setLoading(false)
        }
    }

    const runAgent = async () => {
        if (!savedId) { toast('Save symptoms first', 'warning'); return }
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
            setStep('ai-done')
            toast('AI diagnosis generated — review and edit before saving', 'success')
        } catch (err) {
            const detail = err.response?.data?.detail || ''
            if (err.response?.status === 429 || detail.includes('rate limit')) {
                toast('AI model rate limit reached (free tier). Please try again in a few minutes.', 'warning')
            } else {
                toast('AI agent failed. Fill fields manually.', 'error')
                setStep('ai-done')
            }
        } finally {
            setAiRunning(false)
        }
    }

    const saveFinal = async () => {
        if (!diagnosisText.trim()) { toast('Diagnosis is required', 'warning'); return }
        setLoading(true)
        setError(null)
        try {
            await axiosInstance.patch(`/api/v1/diagnoses/${savedId}`, {
                diagnosis_text: diagnosisText,
                icd_code: icdCode || null,
                prescription: prescription || null,
                follow_up: followUp || null,
                ai_report: aiReport ? JSON.stringify(aiReport) : null
            })
            setStep('complete')
            toast('Diagnosis finalized', 'success')
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to save diagnosis.')
        } finally {
            setLoading(false)
        }
    }

    if (loadingData) return <p style={s.center}>Loading...</p>

    const stepNum = step === 'input' ? 1 : step === 'saved' ? 2 : step === 'ai-done' ? 3 : 4
    const steps = ['Record', 'AI Analysis', 'Review', 'Complete']

    return (
        <div style={s.page}>
            {/* Header */}
            <div style={s.header}>
                <button style={s.backBtn} onClick={() => navigate(`/patients/${patientId}?tab=diagnoses`)}>← Back</button>
                <div>
                    <h2 style={s.title}>{step === 'complete' ? 'Diagnosis' : 'New Diagnosis'}</h2>
                    {patient && <p style={s.subtitle}>{patient.full_name}</p>}
                </div>
            </div>

            {/* Step Indicator */}
            <div style={s.stepBar}>
                {steps.map((label, i) => (
                    <div key={i} style={s.stepItem}>
                        <div style={{
                            ...s.stepCircle,
                            background: i + 1 <= stepNum ? 'linear-gradient(135deg, #6d28d9, #8b5cf6)' : '#e2e8f0',
                            color: i + 1 <= stepNum ? 'white' : '#94a3b8'
                        }}>{i + 1 < stepNum ? '✓' : i + 1}</div>
                        <span style={{ ...s.stepLabel, color: i + 1 <= stepNum ? '#6d28d9' : '#94a3b8' }}>{label}</span>
                        {i < 3 && <div style={{ ...s.stepLine, background: i + 1 < stepNum ? '#8b5cf6' : '#e2e8f0' }} />}
                    </div>
                ))}
            </div>

            {!isDoctor && <div style={s.warnBox}>Only doctors can submit diagnoses.</div>}
            {step === 'input' && !activeAppointment && <div style={s.warnBox}>No active appointment found. Book one first.</div>}
            {error && <div style={s.errorBox}>{error}</div>}

            <div style={s.columns}>
                {/* ── LEFT COLUMN: Form ── */}
                <div style={s.formCol}>

                    {/* STEP 1: Input */}
                    {step === 'input' && (
                        <div style={{ ...glass, padding: '28px 32px' }}>
                            <VoiceField label="Patient Complaint / Notes" value={symptoms} onChange={setSymptoms}
                                field="symptoms" active={activeField} listening={isListening} onVoice={toggleVoice} required rows={5} />
                            <button style={{
                                ...s.submitBtn, marginTop: '16px',
                                ...((!activeAppointment || !isDoctor) ? { opacity: 0.5, cursor: 'not-allowed' } : {})
                            }} onClick={saveSymptoms} disabled={loading || !activeAppointment || !isDoctor}>
                                {loading ? 'Saving...' : 'Save & Continue'}
                            </button>
                        </div>
                    )}

                    {/* STEP 2: Saved — Generate AI */}
                    {step === 'saved' && (
                        <div style={{ ...glass, padding: '28px 32px' }}>
                            <div style={s.field}>
                                <label style={s.label}>Patient Complaint</label>
                                <div style={s.readonlyBox}>{symptoms}</div>
                            </div>
                            <button style={{ ...s.aiBtn, marginTop: '20px' }} onClick={runAgent} disabled={aiRunning}>
                                {aiRunning ? (
                                    <span style={s.aiBtnInner}>
                                        <span style={s.spinner} />
                                        Agent is investigating...
                                    </span>
                                ) : 'AI Agent — Diagnose'}
                            </button>
                            {aiRunning && (
                                <div style={{ ...s.agentBox, marginTop: '16px' }}>
                                    <div style={s.agentPulse} />
                                    <div>
                                        <p style={s.agentTitle}>ReAct Agent Running</p>
                                        <p style={s.agentSub}>Reasoning → Calling tools → Observing → Repeating...</p>
                                        <p style={s.agentSub}>Checking emergency flags, patient history, vitals, medications, similar cases...</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 3: Review & Edit AI Output */}
                    {step === 'ai-done' && (
                        <div style={{ ...glass, padding: '28px 32px' }}>
                            <div style={s.field}>
                                <label style={s.label}>Patient Complaint</label>
                                <div style={s.readonlyBox}>{symptoms}</div>
                            </div>
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
                            <button style={{ ...s.submitBtn, marginTop: '16px' }} onClick={saveFinal} disabled={loading}>
                                {loading ? 'Saving...' : 'Save Final Diagnosis'}
                            </button>
                        </div>
                    )}

                    {/* STEP 4: Complete View */}
                    {step === 'complete' && (
                        <div style={{ ...glass, padding: '28px 32px' }}>
                            <div style={s.completeHeader}>
                                <span style={s.checkCircle}>✓</span>
                                <h3 style={s.completeTitle}>Diagnosis Complete</h3>
                            </div>
                            <div style={s.detailGrid}>
                                <DetailCard label="Patient Complaint" value={symptoms} />
                                <DetailCard label="Diagnosis" value={diagnosisText} />
                                <DetailCard label="ICD Code" value={icdCode} />
                                <DetailCard label="Prescription" value={prescription} />
                                <DetailCard label="Follow Up" value={followUp} />
                            </div>
                            <button style={{ ...s.backBtn, marginTop: '20px' }}
                                onClick={() => navigate(`/patients/${patientId}?tab=diagnoses`)}>
                                ← Back to Patient
                            </button>
                        </div>
                    )}
                </div>

                {/* ── RIGHT COLUMN: AI Report ── */}
                {aiReport && (step === 'ai-done' || step === 'complete') && (
                    <div style={s.reportCol}>
                        {aiReport.urgency === 'emergency' && (
                            <div style={s.emergencyBanner}>EMERGENCY — Immediate attention required</div>
                        )}

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

                        {aiReport.warnings?.length > 0 && (
                            <div style={s.warningCard}>
                                <h3 style={s.warningTitle}>Safety Warnings</h3>
                                {aiReport.warnings.map((w, i) => (
                                    <div key={i} style={s.warningRow}><span style={s.warningDot} />{w}</div>
                                ))}
                            </div>
                        )}

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

                        {aiReport.watchlist?.length > 0 && (
                            <div style={s.reportCard}>
                                <h3 style={s.reportTitle}>Watchlist</h3>
                                {aiReport.watchlist.map((w, i) => (
                                    <div key={i} style={s.watchRow}><span style={s.watchDot} />{w}</div>
                                ))}
                            </div>
                        )}

                        {aiReport.lifestyle_advice && (
                            <div style={s.reportCard}>
                                <h3 style={s.reportTitle}>Lifestyle Advice</h3>
                                <p style={s.reportText}>{aiReport.lifestyle_advice}</p>
                            </div>
                        )}

                        {aiReport.clinical_notes && (
                            <div style={s.reportCard}>
                                <h3 style={s.reportTitle}>Clinical Notes</h3>
                                <p style={s.reportText}>{aiReport.clinical_notes}</p>
                            </div>
                        )}

                        {aiReport.reasoning_trace?.length > 0 && (
                            <div style={s.reportCard}>
                                <button type="button" style={s.traceToggle} onClick={() => setShowTrace(v => !v)}>
                                    {showTrace ? '▾' : '▸'} Agent Pipeline ({aiReport.total_steps} agents)
                                </button>
                                {showTrace && (
                                    <div style={s.traceList}>
                                        {aiReport.reasoning_trace.map((t, i) => (
                                            <div key={i} style={s.traceStep}>
                                                <div style={s.traceHeader}>
                                                    <span style={s.traceNum}>Agent {t.step}</span>
                                                    <span style={{
                                                        ...s.traceAction,
                                                        background: t.agent?.includes('Synthesizer') ? '#dcfce7' : '#dbeafe',
                                                        color: t.agent?.includes('Synthesizer') ? '#166534' : '#1d4ed8'
                                                    }}>
                                                        {t.agent || t.action || 'Agent'}
                                                    </span>
                                                </div>
                                                <p style={s.traceThought}>{t.thought || t.observation_summary || ''}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div style={s.metaBar}>
                            <span style={{
                                ...s.urgBadge,
                                background: aiReport.urgency === 'emergency' ? '#fee2e2' : aiReport.urgency === 'urgent' ? '#fef9c3' : '#dcfce7',
                                color: aiReport.urgency === 'emergency' ? '#991b1b' : aiReport.urgency === 'urgent' ? '#854d0e' : '#166534'
                            }}>{(aiReport.urgency || 'routine').toUpperCase()}</span>
                            <span style={s.modelBadge}>{aiReport.model_used}</span>
                            <span style={s.modelBadge}>{aiReport.total_steps} agents</span>
                            {aiReport.architecture && <span style={s.modelBadge}>{aiReport.architecture}</span>}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function DetailCard({ label, value }) {
    if (!value) return null
    return (
        <div style={s.detailCard}>
            <label style={s.detailLabel}>{label}</label>
            <p style={s.detailValue}>{value}</p>
        </div>
    )
}

function VoiceField({ label, value, onChange, field, active, listening, onVoice, required, rows = 3 }) {
    const isActive = listening && active === field
    return (
        <div style={s.field}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={s.label}>{label}</label>
                <button type="button" onClick={() => onVoice(field)} style={{
                    ...s.voiceBtn,
                    background: isActive ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
                }}>{isActive ? '■ Stop' : 'Speak'}</button>
            </div>
            <textarea style={s.textarea} value={value} onChange={e => onChange(e.target.value)}
                placeholder={`${label.replace(' *', '')}...`} rows={rows} required={required} />
            {isActive && <p style={{ color: '#ef4444', fontSize: '12px', margin: '4px 0 0', fontWeight: '600' }}>Listening...</p>}
        </div>
    )
}

const s = {
    page: { maxWidth: '1200px', margin: '0 auto' },
    center: { textAlign: 'center', padding: '60px', color: '#94a3b8' },
    header: { display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' },
    backBtn: { padding: '8px 16px', background: 'rgba(255,255,255,0.7)', border: '1.5px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#475569', marginTop: '4px' },
    title: { color: '#0f172a', margin: '0 0 2px', fontSize: '22px', fontWeight: '700' },
    subtitle: { color: '#64748b', margin: 0, fontSize: '14px' },

    stepBar: { display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '0' },
    stepItem: { display: 'flex', alignItems: 'center', gap: '8px' },
    stepCircle: { width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', flexShrink: 0 },
    stepLabel: { fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' },
    stepLine: { width: '40px', height: '3px', borderRadius: '2px', flexShrink: 0 },

    columns: { display: 'flex', gap: '24px', alignItems: 'flex-start' },
    formCol: { flex: '1 1 480px', minWidth: 0 },
    reportCol: { flex: '1 1 420px', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '14px' },

    field: { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' },
    label: { fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' },
    input: { padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', background: 'white', outline: 'none', boxSizing: 'border-box', width: '100%', color: '#0f172a' },
    textarea: { padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', background: 'white', outline: 'none', boxSizing: 'border-box', width: '100%', color: '#0f172a', resize: 'vertical', fontFamily: 'inherit' },
    voiceBtn: { padding: '4px 12px', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' },

    readonlyBox: { padding: '12px 16px', background: 'rgba(241,245,249,0.8)', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', color: '#334155', lineHeight: '1.6', whiteSpace: 'pre-wrap' },

    aiBtn: {
        padding: '16px 24px', background: 'linear-gradient(135deg, #0f172a, #1e3a8a)',
        color: 'white', border: 'none', borderRadius: '14px', width: '100%',
        fontSize: '16px', fontWeight: '700', cursor: 'pointer',
        boxShadow: '0 6px 24px rgba(30,58,138,0.35)', textAlign: 'center'
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
        color: 'white', border: 'none', borderRadius: '10px', width: '100%',
        fontSize: '15px', fontWeight: '700', cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(139,92,246,0.3)'
    },

    warnBox: { background: '#fef9c3', border: '1px solid #fde68a', color: '#854d0e', borderRadius: '10px', padding: '12px 16px', fontSize: '13px', marginBottom: '16px' },
    errorBox: { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '10px', padding: '12px 16px', fontSize: '13px', marginBottom: '16px' },

    completeHeader: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' },
    checkCircle: { width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '700' },
    completeTitle: { margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' },

    detailGrid: { display: 'flex', flexDirection: 'column', gap: '12px' },
    detailCard: { padding: '12px 16px', background: 'rgba(241,245,249,0.6)', borderRadius: '10px', border: '1px solid #e2e8f0' },
    detailLabel: { fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px', display: 'block' },
    detailValue: { margin: 0, fontSize: '14px', color: '#0f172a', lineHeight: '1.6', whiteSpace: 'pre-wrap' },

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
