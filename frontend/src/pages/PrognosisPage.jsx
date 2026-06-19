import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axiosInstance from '../api/axiosInstance'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { glass } from '../styles/glass'

function PrognosisPage() {
    const { diagnosisId } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const toast = useToast()
    const isDoctor = user?.role === 'doctor'

    const [diagnosis, setDiagnosis] = useState(null)
    const [prognosis, setPrognosis] = useState(null)
    const [report, setReport] = useState(null)
    const [finalText, setFinalText] = useState('')
    const [loading, setLoading] = useState(true)
    const [generating, setGenerating] = useState(false)
    const [saving, setSaving] = useState(false)
    const [showTrace, setShowTrace] = useState(false)

    useEffect(() => { fetchData() }, [diagnosisId])

    const fetchData = async () => {
        setLoading(true)
        const [diagRes, progRes] = await Promise.allSettled([
            axiosInstance.get(`/api/v1/diagnoses/${diagnosisId}`),
            axiosInstance.get(`/api/v1/prognosis/diagnosis/${diagnosisId}`)
        ])
        if (diagRes.status === 'rejected') { setLoading(false); return }
        setDiagnosis(diagRes.value.data)
        if (progRes.status === 'fulfilled' && progRes.value.data.length > 0) {
            const existing = progRes.value.data[0]
            setPrognosis(existing)
            setFinalText(existing.final_prognosis || '')
            try { setReport(JSON.parse(existing.ai_suggestion)) } catch { setReport(null) }
        }
        setLoading(false)
    }

    const handleGenerate = async () => {
        setGenerating(true)
        try {
            const res = await axiosInstance.post('/api/v1/prognosis/generate', { diagnosis_id: diagnosisId })
            setPrognosis(res.data)
            setFinalText(res.data.final_prognosis || '')
            try { setReport(JSON.parse(res.data.ai_suggestion)) } catch { setReport(null) }
            toast('Prognosis generated', 'success')
        } catch (err) {
            const detail = err.response?.data?.detail || ''
            if (err.response?.status === 429 || detail.includes('rate limit')) {
                toast('AI model rate limit reached. Try again in a few minutes.', 'warning')
            } else {
                toast('Failed to generate prognosis', 'error')
            }
        } finally { setGenerating(false) }
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            await axiosInstance.patch(`/api/v1/prognosis/${prognosis.id}/save`, { final_prognosis: finalText })
            toast('Prognosis saved', 'success')
        } catch { toast('Failed to save', 'error') }
        finally { setSaving(false) }
    }

    if (loading) return <p style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>Loading...</p>

    const prognosisColor = {
        'Excellent': '#10b981', 'Good': '#10b981', 'Fair': '#f59e0b',
        'Guarded': '#f59e0b', 'Poor': '#ef4444', 'Critical': '#ef4444'
    }

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
                <button style={s.backBtn} onClick={() => diagnosis ? navigate(`/patients/${diagnosis.patient_id}?tab=prognosis`) : navigate(-1)}>← Back</button>
                <div>
                    <h2 style={{ color: '#0f172a', margin: '0 0 2px', fontSize: '22px', fontWeight: '700' }}>Prognosis</h2>
                    {diagnosis && <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>{diagnosis.diagnosis_text} · {diagnosis.icd_code || ''}</p>}
                </div>
            </div>

            {/* No prognosis yet */}
            {!prognosis && (
                <div style={{ ...glass, padding: '40px', textAlign: 'center' }}>
                    {isDoctor ? (
                        <>
                            <p style={{ color: '#64748b', marginBottom: '20px' }}>No prognosis generated yet. Generate an AI-powered prognosis using multi-agent analysis.</p>
                            <button style={s.generateBtn} onClick={handleGenerate} disabled={generating}>
                                {generating ? 'Agents analyzing...' : 'Generate AI Prognosis'}
                            </button>
                            {generating && (
                                <div style={{ ...s.agentBox, marginTop: '20px', textAlign: 'left' }}>
                                    <div style={s.agentPulse} />
                                    <div>
                                        <p style={s.agentTitle}>Multi-Agent Prognosis Running</p>
                                        <p style={s.agentSub}>Clinical Analyzer → Disease Specialist → Trajectory Predictor → Drug Safety → Report Assembler</p>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : <p style={{ color: '#64748b' }}>No prognosis generated for this diagnosis yet.</p>}
                </div>
            )}

            {/* Prognosis exists */}
            {prognosis && (
                <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
                    {/* LEFT — Structured Report */}
                    <div style={{ flex: '1 1 480px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>

                        {/* Overall Prognosis Badge */}
                        {report?.overall_prognosis && (
                            <div style={{ ...glass, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Overall Prognosis</p>
                                    <h3 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: prognosisColor[report.overall_prognosis] || '#64748b' }}>{report.overall_prognosis}</h3>
                                </div>
                                {report.confidence && (
                                    <div style={{ textAlign: 'center' }}>
                                        <span style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a' }}>{report.confidence}%</span>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Confidence</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {report?.summary && <div style={{ ...glass, padding: '18px 22px' }}><p style={{ margin: 0, fontSize: '14px', color: '#334155', lineHeight: '1.7' }}>{report.summary}</p></div>}

                        {/* Trajectory */}
                        {report?.trajectory && (
                            <div style={{ ...glass, padding: '18px 22px' }}>
                                <h3 style={s.cardTitle}>Trajectory: {report.trajectory.class || ''}</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {['short_term', 'medium_term', 'long_term'].map(key => {
                                        const t = typeof report.trajectory[key] === 'object' ? report.trajectory[key] : { outlook: report.trajectory[key] || '' }
                                        return (
                                            <div key={key} style={{ padding: '10px 14px', background: 'rgba(241,245,249,0.6)', borderRadius: '8px', borderLeft: '3px solid #3b82f6' }}>
                                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#3b82f6', textTransform: 'uppercase' }}>{key.replace('_', ' ')}</span>
                                                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#334155' }}>{t.outlook || t.expected_status || ''}</p>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Survival */}
                        {report?.survival_estimate && (
                            <div style={{ ...glass, padding: '18px 22px' }}>
                                <h3 style={s.cardTitle}>Survival Estimate</h3>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    {Object.entries(report.survival_estimate).map(([k, v]) => (
                                        <div key={k} style={{ flex: 1, textAlign: 'center', padding: '12px', background: 'rgba(16,185,129,0.08)', borderRadius: '10px' }}>
                                            <span style={{ fontSize: '20px', fontWeight: '800', color: '#10b981' }}>{v}</span>
                                            <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b', fontWeight: '600' }}>{k.replace('_', ' ')}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Recommendations */}
                        {report?.recommendations?.length > 0 && (
                            <div style={{ ...glass, padding: '18px 22px' }}>
                                <h3 style={s.cardTitle}>Recommendations</h3>
                                {report.recommendations.map((r, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '8px', padding: '5px 0', fontSize: '13px', color: '#334155' }}>
                                        <span style={{ color: '#10b981', fontWeight: '700' }}>•</span>{r}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Warnings */}
                        {report?.warnings?.length > 0 && (
                            <div style={{ background: 'rgba(254,242,242,0.9)', border: '1.5px solid #fecaca', borderRadius: '16px', padding: '18px 22px' }}>
                                <h3 style={{ margin: '0 0 10px', fontSize: '15px', fontWeight: '700', color: '#991b1b' }}>Warnings</h3>
                                {report.warnings.map((w, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '8px', padding: '5px 0', fontSize: '13px', color: '#991b1b' }}>
                                        <span>•</span>{w}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Specialists */}
                        {report?.specialists_needed?.length > 0 && (
                            <div style={{ ...glass, padding: '18px 22px' }}>
                                <h3 style={s.cardTitle}>Specialists Needed</h3>
                                {report.specialists_needed.map((sp, i) => (
                                    <div key={i} style={{ padding: '8px 12px', background: 'rgba(139,92,246,0.06)', borderRadius: '8px', marginBottom: '6px' }}>
                                        <span style={{ fontWeight: '700', color: '#6d28d9', fontSize: '13px' }}>{sp.specialty || sp}</span>
                                        {sp.reason && <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>{sp.reason}</p>}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Lifestyle */}
                        {report?.lifestyle_modifications?.length > 0 && (
                            <div style={{ ...glass, padding: '18px 22px' }}>
                                <h3 style={s.cardTitle}>Lifestyle Modifications</h3>
                                {report.lifestyle_modifications.map((l, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '8px', padding: '5px 0', fontSize: '13px', color: '#334155' }}>
                                        <span style={{ color: '#f59e0b' }}>•</span>{l}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* RIGHT — Agent Trace + Final Prognosis */}
                    <div style={{ flex: '1 1 420px', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

                        {/* Agent Pipeline */}
                        {report?.reasoning_trace?.length > 0 && (
                            <div style={{ ...glass, padding: '18px 22px' }}>
                                <button type="button" style={s.traceToggle} onClick={() => setShowTrace(v => !v)}>
                                    {showTrace ? '▾' : '▸'} Agent Pipeline ({report.total_agents} agents)
                                </button>
                                {showTrace && (
                                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {report.reasoning_trace.map((t, i) => (
                                            <div key={i} style={{ padding: '10px 14px', background: 'rgba(241,245,249,0.8)', borderRadius: '10px', borderLeft: '3px solid #8b5cf6' }}>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                                                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8' }}>Agent {t.step}</span>
                                                    <span style={{ fontSize: '11px', fontWeight: '600', borderRadius: '6px', padding: '2px 8px', background: t.agent?.includes('Assembler') ? '#dcfce7' : '#dbeafe', color: t.agent?.includes('Assembler') ? '#166534' : '#1d4ed8' }}>{t.agent}</span>
                                                </div>
                                                <p style={{ fontSize: '12px', color: '#334155', margin: '0 0 4px', fontStyle: 'italic' }}>{t.thought}</p>
                                                {t.sources?.length > 0 && (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
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

                        {/* Meta */}
                        {report && (
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                <span style={{ fontSize: '11px', fontWeight: '600', color: '#6d28d9', background: 'rgba(139,92,246,0.1)', borderRadius: '6px', padding: '4px 10px' }}>{report.model_used}</span>
                                <span style={{ fontSize: '11px', fontWeight: '600', color: '#6d28d9', background: 'rgba(139,92,246,0.1)', borderRadius: '6px', padding: '4px 10px' }}>{report.total_agents} agents</span>
                                {report.architecture && <span style={{ fontSize: '11px', fontWeight: '600', color: '#6d28d9', background: 'rgba(139,92,246,0.1)', borderRadius: '6px', padding: '4px 10px' }}>{report.architecture}</span>}
                            </div>
                        )}

                        {/* Final Prognosis (editable) */}
                        <div style={{ ...glass, padding: '18px 22px' }}>
                            <h3 style={s.cardTitle}>Final Prognosis {isDoctor && <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '400' }}>(editable)</span>}</h3>
                            <textarea
                                style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', lineHeight: '1.6', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', minHeight: '200px', ...(isDoctor ? {} : { background: '#f8fafc', cursor: 'default' }) }}
                                value={finalText}
                                onChange={e => isDoctor && setFinalText(e.target.value)}
                                readOnly={!isDoctor}
                            />
                            {isDoctor && (
                                <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                                    <button style={s.saveBtn} onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Prognosis'}</button>
                                    <button style={s.regenBtn} onClick={handleGenerate} disabled={generating}>{generating ? 'Generating...' : 'Regenerate'}</button>
                                </div>
                            )}
                        </div>

                        {/* Follow-up Plan */}
                        {report?.follow_up_plan && (
                            <div style={{ ...glass, padding: '18px 22px' }}>
                                <h3 style={s.cardTitle}>Follow-up Plan</h3>
                                <p style={{ margin: 0, fontSize: '13px', color: '#334155', lineHeight: '1.6' }}>{report.follow_up_plan}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

const s = {
    backBtn: { padding: '8px 16px', background: 'rgba(255,255,255,0.7)', border: '1.5px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#475569' },
    generateBtn: { padding: '14px 28px', background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 14px rgba(59,130,246,0.3)' },
    agentBox: { background: 'linear-gradient(135deg, #0f172a, #1e1b4b)', borderRadius: '10px', padding: '20px 24px', display: 'flex', gap: '16px', alignItems: 'center' },
    agentPulse: { width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0, background: 'radial-gradient(circle, #f59e0b 30%, transparent 70%)', animation: 'pulse 1.5s ease-in-out infinite' },
    agentTitle: { color: '#f59e0b', fontSize: '14px', fontWeight: '700', margin: '0 0 4px' },
    agentSub: { color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: '0 0 2px' },
    cardTitle: { margin: '0 0 12px', fontSize: '15px', fontWeight: '700', color: '#0f172a' },
    traceToggle: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#64748b', padding: 0, textAlign: 'left' },
    saveBtn: { padding: '10px 20px', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
    regenBtn: { padding: '10px 20px', background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }
}

export default PrognosisPage
