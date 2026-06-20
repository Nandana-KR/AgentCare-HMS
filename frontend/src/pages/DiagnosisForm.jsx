import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axiosInstance from '../api/axiosInstance'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { glass } from '../styles/glass'

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
    const [liveAgents, setLiveAgents] = useState([])
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
                    if (d.ai_report) { try { setAiReport(JSON.parse(d.ai_report)) } catch {} }
                    setStep(d.diagnosis_text === 'Pending AI analysis' ? 'saved' : 'complete')
                } else {
                    const dRes = await axiosInstance.get(`/api/v1/diagnoses/patient/${patientId}`)
                    const pending = dRes.data.find(d => d.diagnosis_text === 'Pending AI analysis')
                    if (pending) { setSymptoms(pending.symptoms || ''); setSavedId(pending.id); setStep('saved') }
                }
            } catch { setError('Failed to load patient data') }
            finally { setLoadingData(false) }
        }
        load()
    }, [patientId, diagnosisId])

    const activeFieldRef = useRef(null)

    useEffect(() => {
        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return
        if (recognitionRef.current) return
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition
        const rec = new SR()
        rec.continuous = true
        rec.interimResults = true
        rec.lang = 'en-US'
        rec.onresult = event => {
            let t = ''
            for (let i = 0; i < event.results.length; i++) t += event.results[i][0].transcript
            const field = activeFieldRef.current
            if (field === 'symptoms') setSymptoms(t)
            if (field === 'diagnosis') setDiagnosisText(t)
            if (field === 'prescription') setPrescription(t)
            if (field === 'followup') setFollowUp(t)
        }
        rec.onerror = event => {
            setIsListening(false); setActiveField(null); activeFieldRef.current = null
            if (event.error === 'not-allowed') toast('Microphone access denied. Allow microphone in browser settings.', 'error')
            else if (event.error === 'no-speech') toast('No speech detected. Try again.', 'warning')
            else if (event.error === 'network') toast('Voice recognition needs internet connection.', 'error')
            else toast(`Voice error: ${event.error}. Try again.`, 'warning')
        }
        rec.onend = () => { setIsListening(false); setActiveField(null); activeFieldRef.current = null }
        recognitionRef.current = rec
    }, [])

    const toggleVoice = field => {
        if (!recognitionRef.current) {
            toast('Voice not supported in this browser. Use Chrome or Edge.', 'warning')
            return
        }
        if (isListening) { recognitionRef.current.stop(); return }
        activeFieldRef.current = field
        setActiveField(field)
        setIsListening(true)
        try {
            recognitionRef.current.start()
        } catch (e) {
            setIsListening(false); setActiveField(null); activeFieldRef.current = null
            toast('Voice failed to start. Check microphone permissions.', 'error')
        }
    }

    const saveSymptoms = async () => {
        if (!symptoms.trim()) { toast('Enter symptoms first', 'warning'); return }
        if (!activeAppointment) { toast('No active appointment found', 'error'); return }
        setLoading(true); setError(null)
        try {
            const res = await axiosInstance.post('/api/v1/diagnoses/', { patient_id: patientId, appointment_id: activeAppointment.id, symptoms })
            setSavedId(res.data.id); setStep('saved'); toast('Saved', 'success')
        } catch (err) { setError(err.response?.data?.detail || 'Failed to save.') }
        finally { setLoading(false) }
    }

    const runAgent = async () => {
        if (!savedId) { toast('Save symptoms first', 'warning'); return }
        setAiRunning(true); setAiReport(null); setLiveAgents([])
        const wsUrl = axiosInstance.defaults.baseURL?.replace('https://', 'wss://').replace('http://', 'ws://') || ''
        let ws = null
        try { ws = new WebSocket(`${wsUrl}/ws/diagnosis/${crypto.randomUUID()}`); ws.onmessage = e => { setLiveAgents(prev => [...prev, JSON.parse(e.data)]) } } catch {}
        try {
            const res = await axiosInstance.post('/api/v1/diagnoses/ai-diagnose', { patient_id: patientId, symptoms })
            const r = res.data
            setAiReport(r); setDiagnosisText(r.diagnosis_text || ''); setIcdCode(r.icd_code || '')
            setPrescription(r.prescription || ''); setFollowUp(r.follow_up || '')
            setStep('ai-done'); toast('AI diagnosis generated', 'success')
        } catch (err) {
            const detail = err.response?.data?.detail || ''
            if (err.response?.status === 429 || detail.includes('rate limit')) { toast('Rate limit reached. Try again in a few minutes.', 'warning') }
            else { toast('AI agent failed. Fill manually.', 'error'); setStep('ai-done') }
        } finally { setAiRunning(false); if (ws) ws.close() }
    }

    const skipAI = () => { setStep('ai-done'); toast('Fill diagnosis manually', 'info') }

    const saveFinal = async () => {
        if (!diagnosisText.trim()) { toast('Diagnosis is required', 'warning'); return }
        setLoading(true); setError(null)
        try {
            await axiosInstance.patch(`/api/v1/diagnoses/${savedId}`, {
                diagnosis_text: diagnosisText, icd_code: icdCode || null,
                prescription: prescription || null, follow_up: followUp || null,
                ai_report: aiReport ? JSON.stringify(aiReport) : null
            })
            setStep('complete'); toast('Diagnosis finalized', 'success')
        } catch (err) { setError(err.response?.data?.detail || 'Failed to save.') }
        finally { setLoading(false) }
    }

    const exportPDF = () => {
        const el = document.getElementById('diagnosis-report')
        if (!el) return
        const win = window.open('', '_blank')
        win.document.write(`<html><head><title>Diagnosis Report - ${patient?.full_name || ''}</title>
            <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:40px;color:#1e293b;max-width:800px;margin:0 auto}
            h3{margin:0 0 8px;font-size:16px}p{margin:4px 0;font-size:14px;line-height:1.6}
            .section{border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;margin-bottom:12px}
            .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
            .badge{display:inline-block;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700}
            .header{text-align:center;border-bottom:2px solid #3b82f6;padding-bottom:16px;margin-bottom:20px}
            @media print{button{display:none!important}}</style></head><body>
            <div class="header"><h2>Diagnosis Report</h2><p>${patient?.full_name || ''} · ${new Date().toLocaleDateString('en-GB')}</p></div>
            <div class="section"><h3>Patient Complaint</h3><p>${symptoms}</p></div>
            <div class="section"><h3>Diagnosis</h3><p>${diagnosisText}</p><p><strong>ICD Code:</strong> ${icdCode || 'N/A'}</p></div>
            <div class="section"><h3>Prescription</h3><p>${prescription || 'None'}</p></div>
            <div class="section"><h3>Follow Up</h3><p>${followUp || 'None'}</p></div>
            ${aiReport?.differentials?.length ? `<div class="section"><h3>Differential Diagnoses</h3>${aiReport.differentials.map((d,i) => `<p><strong>#${i+1} ${d.diagnosis}</strong> (ICD: ${d.icd_code}) — ${d.confidence}%<br/>${d.reasoning}</p>`).join('')}</div>` : ''}
            ${aiReport?.warnings?.length ? `<div class="section" style="border-color:#fecaca"><h3 style="color:#991b1b">Safety Warnings</h3>${aiReport.warnings.map(w => `<p style="color:#991b1b">• ${w}</p>`).join('')}</div>` : ''}
            ${aiReport?.recommended_tests?.length ? `<div class="section"><h3>Recommended Tests</h3><p>${aiReport.recommended_tests.join(', ')}</p></div>` : ''}
            ${aiReport?.lifestyle_advice ? `<div class="section"><h3>Lifestyle Advice</h3><p>${aiReport.lifestyle_advice}</p></div>` : ''}
            ${aiReport?.confidence_breakdown ? `<div class="section"><h3>Confidence</h3><p>${Object.entries(aiReport.confidence_breakdown).map(([k,v]) => `${k.replace(/_/g,' ')}: ${v}%`).join(' · ')}</p></div>` : ''}
            <div style="text-align:center;margin-top:30px;color:#94a3b8;font-size:12px">Generated by Hospital Management System · AI-Assisted Diagnosis</div>
            <script>window.print()</script></body></html>`)
        win.document.close()
    }

    if (loadingData) return <p style={s.center}>Loading...</p>

    const stepNum = step === 'input' ? 1 : step === 'saved' ? 2 : step === 'ai-done' ? 3 : 4
    const steps = ['Record', 'AI Analysis', 'Review', 'Complete']

    return (
        <div style={s.page}>
            {/* Header */}
            <div style={s.header}>
                <button style={s.backBtn} onClick={() => navigate(`/patients/${patientId}?tab=diagnoses`)}>← Back</button>
                <div style={{ flex: 1 }}>
                    <h2 style={s.title}>{step === 'complete' ? 'Diagnosis' : 'New Diagnosis'}</h2>
                    {patient && <p style={s.subtitle}>{patient.full_name}</p>}
                </div>
                {aiReport?.urgency && aiReport.urgency !== 'routine' && (
                    <span style={{ ...s.urgencyBadge, background: aiReport.urgency === 'emergency' ? '#fee2e2' : '#fef9c3', color: aiReport.urgency === 'emergency' ? '#991b1b' : '#854d0e' }}>
                        {aiReport.urgency.toUpperCase()}
                    </span>
                )}
            </div>

            {/* Step Indicator */}
            <div style={s.stepBar}>
                {steps.map((label, i) => (
                    <div key={i} style={s.stepItem}>
                        <div style={{ ...s.stepCircle, background: i + 1 <= stepNum ? 'linear-gradient(135deg, #1e3a8a, #3b82f6)' : '#e2e8f0', color: i + 1 <= stepNum ? 'white' : '#94a3b8' }}>
                            {i + 1 < stepNum ? '✓' : i + 1}
                        </div>
                        <span style={{ ...s.stepLabel, color: i + 1 <= stepNum ? '#1e3a8a' : '#94a3b8' }}>{label}</span>
                        {i < 3 && <div style={{ ...s.stepLine, background: i + 1 < stepNum ? '#3b82f6' : '#e2e8f0' }} />}
                    </div>
                ))}
            </div>

            {!isDoctor && <div style={s.warnBox}>Only doctors can submit diagnoses.</div>}
            {step === 'input' && !activeAppointment && <div style={s.warnBox}>No active appointment found. Book one first.</div>}
            {error && <div style={s.errorBox}>{error}</div>}

            {/* STEP 1: Input */}
            {step === 'input' && (
                <div style={{ ...glass, padding: '28px 32px' }}>
                    <VoiceField label="Patient Complaint / Notes" value={symptoms} onChange={setSymptoms}
                        field="symptoms" active={activeField} listening={isListening} onVoice={toggleVoice} required rows={8} />
                    <button style={{ ...s.submitBtn, marginTop: '16px', ...((!activeAppointment || !isDoctor) ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
                        onClick={saveSymptoms} disabled={loading || !activeAppointment || !isDoctor}>
                        {loading ? 'Saving...' : 'Save & Continue'}
                    </button>
                </div>
            )}

            {/* STEP 2: AI Generate */}
            {step === 'saved' && (
                <div>
                    <div style={{ ...glass, padding: '20px 24px', marginBottom: '14px' }}>
                        <label style={s.label}>Patient Complaint</label>
                        <p style={{ margin: '6px 0 0', fontSize: '14px', color: '#334155' }}>{symptoms}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button style={{ ...s.submitBtn, flex: 1 }} onClick={runAgent} disabled={aiRunning}>
                            {aiRunning ? 'Agents analyzing...' : 'Generate AI Diagnosis'}
                        </button>
                        <button style={{ ...s.outlineBtn }} onClick={skipAI} disabled={aiRunning}>
                            Skip AI →
                        </button>
                    </div>
                    {aiRunning && (
                        <div style={{ ...s.agentBox, marginTop: '14px' }}>
                            <div style={s.agentPulse} />
                            <div style={{ flex: 1 }}>
                                <p style={s.agentTitle}>Multi-Agent Pipeline</p>
                                {liveAgents.length === 0 ? <p style={s.agentSub}>Starting agents...</p> : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                                        {liveAgents.map((a, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ color: '#10b981', fontSize: '12px' }}>✓</span>
                                                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>{a.agent}</span>
                                            </div>
                                        ))}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ width: '12px', height: '12px', border: '2px solid #f59e0b', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                                            <span style={{ color: '#f59e0b', fontSize: '12px' }}>Running...</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* STEP 3: Review */}
            {step === 'ai-done' && (
                <div>
                    {aiReport && (
                        <>
                            {/* Urgency Banner */}
                            {aiReport.urgency === 'emergency' && (
                                <div style={s.emergencyBanner}>EMERGENCY — Immediate attention required</div>
                            )}

                            {/* Overview */}
                            <div id="sec-overview" style={{ ...glass, padding: '20px 24px', marginBottom: '12px' }}>
                                <h3 style={s.sectionTitle}>Confidence Breakdown</h3>
                                {aiReport.confidence_breakdown && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {Object.entries(aiReport.confidence_breakdown).map(([k, v]) => (
                                            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ flex: 1, height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', borderRadius: '4px', width: `${v}%`, background: v >= 70 ? '#10b981' : v >= 40 ? '#f59e0b' : '#ef4444', transition: 'width 0.6s' }} />
                                                </div>
                                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'capitalize', minWidth: '100px' }}>{k.replace(/_/g, ' ')}</span>
                                                <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', minWidth: '32px', textAlign: 'right' }}>{v}%</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Differentials */}
                            {aiReport.differentials?.length > 0 && (
                                <div id="sec-differentials" style={{ ...glass, padding: '20px 24px', marginBottom: '12px' }}>
                                    <h3 style={s.sectionTitle}>Differential Diagnoses</h3>
                                    {aiReport.differentials.map((d, i) => (
                                        <div key={i} style={{ padding: '10px 0', borderBottom: i < aiReport.differentials.length - 1 ? '1px solid rgba(226,232,240,0.6)' : 'none' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                <span style={{ fontSize: '11px', fontWeight: '800', color: '#3b82f6', background: 'rgba(59,130,246,0.1)', borderRadius: '6px', padding: '2px 6px' }}>#{i + 1}</span>
                                                <span style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', flex: 1 }}>{d.diagnosis}</span>
                                                <span style={{ fontSize: '12px', fontWeight: '700', borderRadius: '8px', padding: '3px 10px', background: d.confidence >= 70 ? '#dcfce7' : d.confidence >= 40 ? '#fef9c3' : '#fee2e2', color: d.confidence >= 70 ? '#166534' : d.confidence >= 40 ? '#854d0e' : '#991b1b' }}>{d.confidence}%</span>
                                            </div>
                                            <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0' }}>ICD: {d.icd_code}</p>
                                            <p style={{ fontSize: '12px', color: '#475569', margin: '4px 0 0', lineHeight: '1.5' }}>{d.reasoning}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Safety */}
                            <div id="sec-safety" style={{ marginBottom: '12px' }}>
                                {aiReport.warnings?.length > 0 && (
                                    <div style={{ background: 'rgba(254,242,242,0.9)', border: '1.5px solid #fecaca', borderRadius: '10px', padding: '18px 22px' }}>
                                        <h3 style={{ margin: '0 0 10px', fontSize: '15px', fontWeight: '700', color: '#991b1b' }}>Safety Warnings</h3>
                                        {aiReport.warnings.map((w, i) => (
                                            <div key={i} style={{ display: 'flex', gap: '8px', padding: '4px 0', fontSize: '13px', color: '#991b1b' }}>
                                                <span style={{ color: '#ef4444' }}>•</span>{w}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Tests & Watchlist */}
                            <div id="sec-tests" style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                                {aiReport.recommended_tests?.length > 0 && (
                                    <div style={{ ...glass, padding: '18px 22px', flex: 1 }}>
                                        <h3 style={s.sectionTitle}>Recommended Tests</h3>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                            {aiReport.recommended_tests.map((t, i) => (
                                                <span key={i} style={{ fontSize: '12px', fontWeight: '600', color: '#1e3a8a', background: 'rgba(59,130,246,0.1)', borderRadius: '6px', padding: '4px 12px' }}>{t}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {aiReport.watchlist?.length > 0 && (
                                    <div style={{ ...glass, padding: '18px 22px', flex: 1 }}>
                                        <h3 style={s.sectionTitle}>Watchlist</h3>
                                        {aiReport.watchlist.map((w, i) => (
                                            <div key={i} style={{ display: 'flex', gap: '8px', padding: '3px 0', fontSize: '13px', color: '#475569' }}>
                                                <span style={{ color: '#f59e0b' }}>•</span>{w}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Advice */}
                            <div id="sec-advice" style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                                {aiReport.lifestyle_advice && (
                                    <div style={{ ...glass, padding: '18px 22px', flex: 1 }}>
                                        <h3 style={s.sectionTitle}>Lifestyle Advice</h3>
                                        <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: '1.6' }}>{aiReport.lifestyle_advice}</p>
                                    </div>
                                )}
                                {aiReport.clinical_notes && (
                                    <div style={{ ...glass, padding: '18px 22px', flex: 1 }}>
                                        <h3 style={s.sectionTitle}>Clinical Notes</h3>
                                        <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: '1.6' }}>{aiReport.clinical_notes}</p>
                                    </div>
                                )}
                            </div>

                            {/* Agent Findings */}
                            <div style={{ ...glass, padding: '20px 24px', marginBottom: '12px' }}>
                                <h3 style={s.sectionTitle}>Agent Findings</h3>
                                <AgentCard title="Triage Agent" color="#3b82f6" items={[
                                    `Urgency: ${aiReport.urgency || 'routine'}`,
                                    ...(aiReport.reasoning_trace?.filter(t => t.agent?.includes('Triage')).map(t => t.thought) || [])
                                ]} />
                                <AgentCard title="Patient Context (Database)" color="#10b981" items={[
                                    ...(aiReport.reasoning_trace?.filter(t => t.agent?.includes('Context')).map(t => t.thought) || [])
                                ]} />
                                <AgentCard title="Clinical Matcher (WHO ICD-10 RAG)" color="#8b5cf6" items={[
                                    `Diagnosis: ${aiReport.diagnosis_text || ''}`,
                                    `ICD Code: ${aiReport.icd_code || 'N/A'}`,
                                    `Differentials: ${(aiReport.differentials || []).map(d => `${d.diagnosis} (${d.confidence}%)`).join(', ') || 'None'}`,
                                    `Tests: ${(aiReport.recommended_tests || []).join(', ') || 'None'}`,
                                    ...(aiReport.reasoning_trace?.filter(t => t.agent?.includes('Matcher')).map(t => t.thought) || [])
                                ]} />
                                <AgentCard title="Drug Safety (OpenFDA + ChromaDB)" color="#f59e0b" items={[
                                    ...(aiReport.warnings || []).map(w => `Warning: ${w}`),
                                    ...(aiReport.reasoning_trace?.filter(t => t.agent?.includes('Safety')).map(t => t.thought) || [])
                                ]} />
                                <AgentCard title="Guardrail Agent" color={aiReport.warnings?.length ? '#ef4444' : '#10b981'} items={[
                                    ...(aiReport.reasoning_trace?.filter(t => t.agent?.includes('Guardrail')).map(t => t.thought) || [])
                                ]} />
                                <AgentCard title="Diagnosis Synthesizer" color="#1e3a8a" items={[
                                    `Prescription: ${aiReport.prescription || 'None'}`,
                                    `Follow Up: ${aiReport.follow_up || 'None'}`,
                                    `Lifestyle: ${aiReport.lifestyle_advice || 'None'}`,
                                    ...(aiReport.reasoning_trace?.filter(t => t.agent?.includes('Synthesizer')).map(t => t.thought) || [])
                                ]} />
                            </div>

                            {/* Agent Pipeline */}
                            <div id="sec-agents" style={{ ...glass, padding: '18px 22px', marginBottom: '12px' }}>
                                <button type="button" style={s.traceToggle} onClick={() => setShowTrace(v => !v)}>
                                    {showTrace ? '▾' : '▸'} Agent Pipeline ({aiReport.total_steps} agents)
                                </button>
                                {showTrace && (
                                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {aiReport.reasoning_trace?.map((t, i) => (
                                            <div key={i} style={{ padding: '10px 14px', background: 'rgba(241,245,249,0.8)', borderRadius: '10px', borderLeft: '3px solid #3b82f6' }}>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                                                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8' }}>Agent {t.step}</span>
                                                    <span style={{ fontSize: '11px', fontWeight: '600', borderRadius: '6px', padding: '2px 8px', background: t.agent?.includes('Synthesizer') ? '#dcfce7' : '#dbeafe', color: t.agent?.includes('Synthesizer') ? '#166534' : '#1d4ed8' }}>{t.agent}</span>
                                                </div>
                                                <p style={{ fontSize: '12px', color: '#334155', margin: '0 0 4px', fontStyle: 'italic' }}>{t.thought}</p>
                                                {t.details && Object.keys(t.details).length > 0 && (
                                                    <div style={{ marginTop: '6px', padding: '8px 12px', background: 'rgba(255,255,255,0.7)', borderRadius: '8px', fontSize: '11px', color: '#475569' }}>
                                                        {Object.entries(t.details).map(([k, v]) => (
                                                            <div key={k} style={{ padding: '2px 0' }}>
                                                                <span style={{ fontWeight: '700', color: '#334155', textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}: </span>
                                                                <span>{Array.isArray(v) ? v.map(item => typeof item === 'object' ? JSON.stringify(item) : item).join(', ') || 'None' : typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {t.sources?.length > 0 && (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                                                        {t.sources.map((src, j) => (
                                                            <span key={j} style={{ fontSize: '10px', fontWeight: '600', color: '#059669', background: 'rgba(16,185,129,0.1)', borderRadius: '4px', padding: '2px 8px' }}>{src}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Meta */}
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                                <span style={s.metaBadge}>{(aiReport.urgency || 'routine').toUpperCase()}</span>
                                <span style={s.metaBadge}>{aiReport.model_used}</span>
                                <span style={s.metaBadge}>{aiReport.total_steps} agents</span>
                                {aiReport.architecture && <span style={s.metaBadge}>{aiReport.architecture}</span>}
                            </div>
                        </>
                    )}

                    {/* Editable Fields */}
                    <div style={{ ...glass, padding: '24px 28px' }}>
                        <h3 style={{ ...s.sectionTitle, marginBottom: '16px' }}>Diagnosis Details {aiReport ? '(AI-filled, editable)' : '(fill manually)'}</h3>
                        <VoiceField label="Diagnosis *" value={diagnosisText} onChange={setDiagnosisText}
                            field="diagnosis" active={activeField} listening={isListening} onVoice={toggleVoice} required />
                        <div style={s.fieldRow}>
                            <div style={{ flex: 1 }}>
                                <label style={s.label}>ICD Code</label>
                                <input style={s.input} value={icdCode} onChange={e => setIcdCode(e.target.value)} placeholder="e.g. J06.9" />
                            </div>
                        </div>
                        <VoiceField label="Prescription" value={prescription} onChange={setPrescription}
                            field="prescription" active={activeField} listening={isListening} onVoice={toggleVoice} />
                        <VoiceField label="Follow Up" value={followUp} onChange={setFollowUp}
                            field="followup" active={activeField} listening={isListening} onVoice={toggleVoice} />
                        <button style={{ ...s.submitBtn, marginTop: '16px' }} onClick={saveFinal} disabled={loading}>
                            {loading ? 'Saving...' : 'Save Final Diagnosis'}
                        </button>
                    </div>
                </div>
            )}

            {/* STEP 4: Complete */}
            {step === 'complete' && (
                <div id="diagnosis-report">
                    <div style={{ ...glass, padding: '24px 28px', marginBottom: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                            <span style={s.checkCircle}>✓</span>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>Diagnosis Complete</h3>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <DetailCard label="Patient" value={patient?.full_name} />
                            <DetailCard label="ICD Code" value={icdCode} />
                            <DetailCard label="Patient Complaint" value={symptoms} full />
                            <DetailCard label="Diagnosis" value={diagnosisText} full />
                            <DetailCard label="Prescription" value={prescription} full />
                            <DetailCard label="Follow Up" value={followUp} full />
                        </div>
                    </div>

                    {aiReport && (
                        <>
                            {aiReport.confidence_breakdown && (
                                <div style={{ ...glass, padding: '20px 24px', marginBottom: '12px' }}>
                                    <h3 style={s.sectionTitle}>Confidence Breakdown</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {Object.entries(aiReport.confidence_breakdown).map(([k, v]) => (
                                            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ flex: 1, height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', borderRadius: '4px', width: `${v}%`, background: v >= 70 ? '#10b981' : v >= 40 ? '#f59e0b' : '#ef4444', transition: 'width 0.6s' }} />
                                                </div>
                                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'capitalize', minWidth: '100px' }}>{k.replace(/_/g, ' ')}</span>
                                                <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', minWidth: '32px', textAlign: 'right' }}>{v}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {aiReport.differentials?.length > 0 && (
                                <div style={{ ...glass, padding: '20px 24px', marginBottom: '12px' }}>
                                    <h3 style={s.sectionTitle}>Differential Diagnoses</h3>
                                    {aiReport.differentials.map((d, i) => (
                                        <div key={i} style={{ padding: '10px 0', borderBottom: i < aiReport.differentials.length - 1 ? '1px solid rgba(226,232,240,0.6)' : 'none' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '11px', fontWeight: '800', color: '#3b82f6', background: 'rgba(59,130,246,0.1)', borderRadius: '6px', padding: '2px 6px' }}>#{i + 1}</span>
                                                <span style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', flex: 1 }}>{d.diagnosis}</span>
                                                <span style={{ fontSize: '12px', fontWeight: '700', borderRadius: '8px', padding: '3px 10px', background: d.confidence >= 70 ? '#dcfce7' : d.confidence >= 40 ? '#fef9c3' : '#fee2e2', color: d.confidence >= 70 ? '#166534' : d.confidence >= 40 ? '#854d0e' : '#991b1b' }}>{d.confidence}%</span>
                                            </div>
                                            <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0' }}>ICD: {d.icd_code}</p>
                                            <p style={{ fontSize: '12px', color: '#475569', margin: '4px 0 0', lineHeight: '1.5' }}>{d.reasoning}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {aiReport.warnings?.length > 0 && (
                                <div style={{ background: 'rgba(254,242,242,0.9)', border: '1.5px solid #fecaca', borderRadius: '10px', padding: '18px 22px', marginBottom: '12px' }}>
                                    <h3 style={{ margin: '0 0 10px', fontSize: '15px', fontWeight: '700', color: '#991b1b' }}>Safety Warnings</h3>
                                    {aiReport.warnings.map((w, i) => (
                                        <div key={i} style={{ display: 'flex', gap: '8px', padding: '4px 0', fontSize: '13px', color: '#991b1b' }}><span>•</span>{w}</div>
                                    ))}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                                {aiReport.recommended_tests?.length > 0 && (
                                    <div style={{ ...glass, padding: '18px 22px', flex: 1 }}>
                                        <h3 style={s.sectionTitle}>Recommended Tests</h3>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                            {aiReport.recommended_tests.map((t, i) => (
                                                <span key={i} style={{ fontSize: '12px', fontWeight: '600', color: '#1e3a8a', background: 'rgba(59,130,246,0.1)', borderRadius: '6px', padding: '4px 12px' }}>{t}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {aiReport.watchlist?.length > 0 && (
                                    <div style={{ ...glass, padding: '18px 22px', flex: 1 }}>
                                        <h3 style={s.sectionTitle}>Watchlist</h3>
                                        {aiReport.watchlist.map((w, i) => (
                                            <div key={i} style={{ display: 'flex', gap: '8px', padding: '3px 0', fontSize: '13px', color: '#475569' }}><span style={{ color: '#f59e0b' }}>•</span>{w}</div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                                {aiReport.lifestyle_advice && (
                                    <div style={{ ...glass, padding: '18px 22px', flex: 1 }}>
                                        <h3 style={s.sectionTitle}>Lifestyle Advice</h3>
                                        <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: '1.6' }}>{aiReport.lifestyle_advice}</p>
                                    </div>
                                )}
                                {aiReport.clinical_notes && (
                                    <div style={{ ...glass, padding: '18px 22px', flex: 1 }}>
                                        <h3 style={s.sectionTitle}>Clinical Notes</h3>
                                        <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: '1.6' }}>{aiReport.clinical_notes}</p>
                                    </div>
                                )}
                            </div>

                            {/* Agent Detailed Findings */}
                            {aiReport.agent_details && (
                                <div style={{ ...glass, padding: '20px 24px', marginBottom: '12px' }}>
                                    <h3 style={s.sectionTitle}>Agent Findings</h3>

                                    {aiReport.agent_details.triage && (
                                        <AgentCard title="Triage Agent" color="#3b82f6"
                                            items={[
                                                `Urgency: ${aiReport.agent_details.triage.urgency || 'routine'}`,
                                                `Assessment: ${aiReport.agent_details.triage.initial_assessment || ''}`,
                                                `Key Symptoms: ${(aiReport.agent_details.triage.key_symptoms || []).join(', ')}`,
                                                `Systems: ${(aiReport.agent_details.triage.systems_involved || []).join(', ')}`
                                            ]} />
                                    )}

                                    {aiReport.agent_details.patient_context && (
                                        <AgentCard title="Patient Context" color="#10b981"
                                            items={[
                                                `Age: ${aiReport.agent_details.patient_context.profile?.age || 'Unknown'}, Gender: ${aiReport.agent_details.patient_context.profile?.gender || 'N/A'}`,
                                                `Vitals: ${aiReport.agent_details.patient_context.vitals?.anomalies?.length ? aiReport.agent_details.patient_context.vitals.anomalies.join(', ') : 'Normal'}`,
                                                `Trend: ${aiReport.agent_details.patient_context.vitals_trend_analysis || 'No data'}`,
                                                `Allergies: ${aiReport.agent_details.patient_context.allergies || 'None'}`,
                                                `Active Medications: ${aiReport.agent_details.patient_context.medications?.active_medications?.length || 0}`
                                            ]} />
                                    )}

                                    {aiReport.agent_details.clinical_match?.primary_diagnosis && (
                                        <AgentCard title="Clinical Matcher (RAG)" color="#8b5cf6"
                                            items={[
                                                `Primary: ${aiReport.agent_details.clinical_match.primary_diagnosis.title} (${aiReport.agent_details.clinical_match.primary_diagnosis.code}) — ${aiReport.agent_details.clinical_match.primary_diagnosis.confidence}%`,
                                                `Treatment: ${aiReport.agent_details.clinical_match.recommended_treatment || 'N/A'}`,
                                                `Tests: ${(aiReport.agent_details.clinical_match.recommended_tests || []).join(', ') || 'None'}`,
                                                `Red Flags: ${(aiReport.agent_details.clinical_match.red_flags_to_watch || []).join(', ') || 'None'}`
                                            ]} />
                                    )}

                                    {aiReport.agent_details.drug_safety && (
                                        <AgentCard title="Drug Safety (OpenFDA + RAG)" color="#f59e0b"
                                            items={[
                                                `Drugs Checked: ${(aiReport.agent_details.drug_safety.interactions_checked || []).join(', ') || 'None'}`,
                                                `Safe to Prescribe: ${aiReport.agent_details.drug_safety.safe_to_prescribe ? 'YES' : 'NO'}`,
                                                ...(aiReport.agent_details.drug_safety.warnings || []).map(w => `Warning: ${w}`)
                                            ]} />
                                    )}

                                    {aiReport.agent_details.guardrail && (
                                        <AgentCard title="Guardrail Agent" color={aiReport.agent_details.guardrail.passed ? '#10b981' : '#ef4444'}
                                            items={[
                                                `Status: ${aiReport.agent_details.guardrail.passed ? 'All checks passed' : 'Issues found'}`,
                                                ...(aiReport.agent_details.guardrail.issues || [])
                                            ]} />
                                    )}
                                </div>
                            )}

                            {/* Agent Pipeline Trace */}
                            {aiReport.reasoning_trace?.length > 0 && (
                                <div style={{ ...glass, padding: '18px 22px', marginBottom: '12px' }}>
                                    <button type="button" style={s.traceToggle} onClick={() => setShowTrace(v => !v)}>
                                        {showTrace ? '▾' : '▸'} Agent Pipeline Trace ({aiReport.total_steps} agents)
                                    </button>
                                    {showTrace && (
                                        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {aiReport.reasoning_trace.map((t, i) => (
                                                <div key={i} style={{ padding: '10px 14px', background: 'rgba(241,245,249,0.8)', borderRadius: '10px', borderLeft: '3px solid #3b82f6' }}>
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                                                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8' }}>Agent {t.step}</span>
                                                        <span style={{ fontSize: '11px', fontWeight: '600', borderRadius: '6px', padding: '2px 8px', background: t.agent?.includes('Synthesizer') ? '#dcfce7' : '#dbeafe', color: t.agent?.includes('Synthesizer') ? '#166534' : '#1d4ed8' }}>{t.agent}</span>
                                                    </div>
                                                    <p style={{ fontSize: '12px', color: '#334155', margin: '0 0 4px', fontStyle: 'italic' }}>{t.thought}</p>
                                                    {t.sources?.length > 0 && (
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                                                            {t.sources.map((src, j) => (
                                                                <span key={j} style={{ fontSize: '10px', fontWeight: '600', color: '#059669', background: 'rgba(16,185,129,0.1)', borderRadius: '4px', padding: '2px 8px' }}>{src}</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                                <span style={s.metaBadge}>{(aiReport.urgency || 'routine').toUpperCase()}</span>
                                <span style={s.metaBadge}>{aiReport.model_used}</span>
                                <span style={s.metaBadge}>{aiReport.total_steps} agents</span>
                            </div>
                        </>
                    )}

                    <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                        <button style={s.backBtn} onClick={() => navigate(`/patients/${patientId}?tab=diagnoses`)}>← Back to Patient</button>
                        <button style={s.exportBtn} onClick={() => exportPDF()}>Export PDF</button>
                    </div>
                </div>
            )}
        </div>
    )
}

function AgentCard({ title, color, items }) {
    return (
        <div style={{ padding: '12px 16px', marginBottom: '8px', borderLeft: `3px solid ${color}`, background: 'rgba(241,245,249,0.5)', borderRadius: '0 10px 10px 0' }}>
            <h4 style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: '700', color }}>{title}</h4>
            {items.filter(Boolean).map((item, i) => (
                <p key={i} style={{ margin: '2px 0', fontSize: '12px', color: '#475569', lineHeight: '1.5' }}>{item}</p>
            ))}
        </div>
    )
}

function DetailCard({ label, value, full }) {
    if (!value) return null
    return (
        <div style={{ padding: '12px 16px', background: 'rgba(241,245,249,0.6)', borderRadius: '10px', border: '1px solid #e2e8f0', ...(full ? { gridColumn: '1 / -1' } : {}) }}>
            <label style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px', display: 'block' }}>{label}</label>
            <p style={{ margin: 0, fontSize: '14px', color: '#0f172a', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{value}</p>
        </div>
    )
}

function VoiceField({ label, value, onChange, field, active, listening, onVoice, required, rows = 3 }) {
    const isActive = listening && active === field
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
                <button type="button" onClick={() => onVoice(field)} style={{
                    padding: '4px 12px', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '600',
                    background: isActive ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
                }}>{isActive ? '■ Stop' : 'Speak'}</button>
            </div>
            <textarea style={{ padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', background: 'white', outline: 'none', boxSizing: 'border-box', width: '100%', color: '#0f172a', resize: 'vertical', fontFamily: 'inherit' }}
                value={value} onChange={e => onChange(e.target.value)} placeholder={`${label.replace(' *', '')}...`} rows={rows} required={required} />
            {isActive && <p style={{ color: '#ef4444', fontSize: '12px', margin: '4px 0 0', fontWeight: '600' }}>Listening...</p>}
        </div>
    )
}

const s = {
    page: { maxWidth: '1000px', margin: '0 auto' },
    center: { textAlign: 'center', padding: '60px', color: '#94a3b8' },
    header: { display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' },
    backBtn: { padding: '8px 16px', background: 'rgba(255,255,255,0.7)', border: '1.5px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#475569' },
    title: { color: '#0f172a', margin: '0 0 2px', fontSize: '22px', fontWeight: '700' },
    subtitle: { color: '#64748b', margin: 0, fontSize: '14px' },
    urgencyBadge: { padding: '6px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', letterSpacing: '0.08em' },

    stepBar: { display: 'flex', alignItems: 'center', marginBottom: '24px' },
    stepItem: { display: 'flex', alignItems: 'center', gap: '8px' },
    stepCircle: { width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', flexShrink: 0 },
    stepLabel: { fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' },
    stepLine: { width: '40px', height: '3px', borderRadius: '2px', flexShrink: 0 },

    field: { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' },
    fieldRow: { display: 'flex', gap: '12px', marginBottom: '8px' },
    label: { fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' },
    input: { padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', background: 'white', outline: 'none', boxSizing: 'border-box', width: '100%', color: '#0f172a', marginTop: '6px' },

    submitBtn: { padding: '13px', background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', color: 'white', border: 'none', borderRadius: '10px', width: '100%', fontSize: '15px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 14px rgba(59,130,246,0.3)' },
    outlineBtn: { padding: '13px 24px', background: 'transparent', color: '#64748b', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },

    sectionTitle: { margin: '0 0 12px', fontSize: '14px', fontWeight: '700', color: '#0f172a' },

    agentBox: { background: 'linear-gradient(135deg, #0f172a, #162044)', borderRadius: '10px', padding: '20px 24px', display: 'flex', gap: '16px', alignItems: 'center' },
    agentPulse: { width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0, background: 'radial-gradient(circle, #f59e0b 30%, transparent 70%)', animation: 'pulse 1.5s ease-in-out infinite' },
    agentTitle: { color: '#f59e0b', fontSize: '14px', fontWeight: '700', margin: '0 0 4px' },
    agentSub: { color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: 0 },

    checkCircle: { width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '700' },

    emergencyBanner: { background: 'linear-gradient(135deg, #dc2626, #991b1b)', color: 'white', borderRadius: '10px', padding: '14px 20px', fontSize: '15px', fontWeight: '800', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.08em', animation: 'pulse 1s ease-in-out infinite', marginBottom: '12px' },

    traceToggle: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#64748b', padding: 0, textAlign: 'left' },

    metaBadge: { fontSize: '11px', fontWeight: '600', color: '#1e3a8a', background: 'rgba(59,130,246,0.1)', borderRadius: '6px', padding: '4px 10px' },

    exportBtn: { padding: '8px 20px', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },

    warnBox: { background: '#fef9c3', border: '1px solid #fde68a', color: '#854d0e', borderRadius: '10px', padding: '12px 16px', fontSize: '13px', marginBottom: '16px' },
    errorBox: { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '10px', padding: '12px 16px', fontSize: '13px', marginBottom: '16px' }
}

export default DiagnosisForm
