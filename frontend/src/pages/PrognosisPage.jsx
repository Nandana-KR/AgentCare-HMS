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
            if (err.response?.status === 429 || detail.includes('rate limit')) { toast('Rate limit reached. Try again in a few minutes.', 'warning') }
            else { toast('Failed to generate prognosis', 'error') }
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

    const exportPDF = () => {
        const win = window.open('', '_blank')
        win.document.write(`<html><head><title>Prognosis Report</title>
            <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:40px;color:#1e293b;max-width:800px;margin:0 auto}
            h3{margin:0 0 8px;font-size:16px}p{margin:4px 0;font-size:14px;line-height:1.6}
            .section{border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;margin-bottom:12px}
            .header{text-align:center;border-bottom:2px solid #3b82f6;padding-bottom:16px;margin-bottom:20px}
            @media print{button{display:none!important}}</style></head><body>
            <div class="header"><h2>Prognosis Report</h2><p>${diagnosis?.diagnosis_text || ''} · ${new Date().toLocaleDateString('en-GB')}</p></div>
            ${report?.overall_prognosis ? `<div class="section"><h3>Overall Prognosis: ${report.overall_prognosis} (${report.confidence || 0}%)</h3><p>${report.summary || ''}</p></div>` : ''}
            ${report?.trajectory ? `<div class="section"><h3>Trajectory: ${report.trajectory.class || ''}</h3><p>Short-term: ${typeof report.trajectory.short_term === 'object' ? report.trajectory.short_term.outlook : report.trajectory.short_term || ''}</p><p>Medium-term: ${typeof report.trajectory.medium_term === 'object' ? report.trajectory.medium_term.outlook : report.trajectory.medium_term || ''}</p><p>Long-term: ${typeof report.trajectory.long_term === 'object' ? report.trajectory.long_term.outlook : report.trajectory.long_term || ''}</p></div>` : ''}
            ${report?.survival_estimate ? `<div class="section"><h3>Survival Estimate</h3><p>${Object.entries(report.survival_estimate).map(([k,v]) => `${k.replace(/_/g,' ')}: ${v}`).join(' · ')}</p></div>` : ''}
            ${report?.recommendations?.length ? `<div class="section"><h3>Recommendations</h3>${report.recommendations.map(r => `<p>• ${r}</p>`).join('')}</div>` : ''}
            ${report?.warnings?.length ? `<div class="section" style="border-color:#fecaca"><h3 style="color:#991b1b">Warnings</h3>${report.warnings.map(w => `<p style="color:#991b1b">• ${w}</p>`).join('')}</div>` : ''}
            ${report?.lifestyle_modifications?.length ? `<div class="section"><h3>Lifestyle</h3>${report.lifestyle_modifications.map(l => `<p>• ${l}</p>`).join('')}</div>` : ''}
            ${report?.follow_up_plan ? `<div class="section"><h3>Follow-up Plan</h3><p>${report.follow_up_plan}</p></div>` : ''}
            ${finalText ? `<div class="section"><h3>Final Prognosis (Doctor)</h3><p>${finalText}</p></div>` : ''}
            <div style="text-align:center;margin-top:30px;color:#94a3b8;font-size:12px">Generated by Hospital Management System · AI-Assisted Prognosis</div>
            <script>window.print()</script></body></html>`)
        win.document.close()
    }

    if (loading) return <p style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>Loading...</p>

    const progColor = { 'Excellent': '#10b981', 'Good': '#10b981', 'Fair': '#f59e0b', 'Guarded': '#f59e0b', 'Poor': '#ef4444', 'Critical': '#ef4444' }

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
                <button style={s.backBtn} onClick={() => diagnosis ? navigate(`/patients/${diagnosis.patient_id}?tab=prognosis`) : navigate(-1)}>← Back</button>
                <div style={{ flex: 1 }}>
                    <h2 style={{ color: '#0f172a', margin: '0 0 2px', fontSize: '22px', fontWeight: '700' }}>Prognosis</h2>
                    {diagnosis && <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>{diagnosis.diagnosis_text} · {diagnosis.icd_code || ''}</p>}
                </div>
                {report?.overall_prognosis && (
                    <span style={{ padding: '6px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '800', background: `${progColor[report.overall_prognosis] || '#64748b'}18`, color: progColor[report.overall_prognosis] || '#64748b' }}>
                        {report.overall_prognosis}
                    </span>
                )}
            </div>

            {/* No prognosis yet */}
            {!prognosis && (
                <div style={{ ...glass, padding: '40px', textAlign: 'center' }}>
                    {isDoctor ? (
                        <>
                            <p style={{ color: '#64748b', marginBottom: '20px' }}>Generate an AI-powered prognosis using multi-agent analysis.</p>
                            <button style={s.generateBtn} onClick={handleGenerate} disabled={generating}>
                                {generating ? 'Agents analyzing...' : 'Generate AI Prognosis'}
                            </button>
                            {generating && (
                                <div style={{ ...s.agentBox, marginTop: '20px', textAlign: 'left' }}>
                                    <div style={s.agentPulse} />
                                    <div>
                                        <p style={s.agentTitle}>Multi-Agent Prognosis Pipeline</p>
                                        <p style={s.agentSub}>Clinical Analyzer → Disease Specialist → Trajectory → Drug Safety → Guardrail → Assembler</p>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : <p style={{ color: '#64748b' }}>No prognosis generated yet.</p>}
                </div>
            )}

            {/* Prognosis exists */}
            {prognosis && report && (
                <>
                    {/* Overview */}
                    <div id="prog-overview" style={{ ...glass, padding: '20px 24px', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: progColor[report.overall_prognosis] || '#64748b' }}>{report.overall_prognosis}</h3>
                                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>Overall Prognosis</p>
                            </div>
                            {report.confidence && (
                                <div style={{ textAlign: 'center' }}>
                                    <span style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a' }}>{report.confidence}%</span>
                                    <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Confidence</p>
                                </div>
                            )}
                        </div>
                        {report.summary && <p style={{ margin: 0, fontSize: '14px', color: '#334155', lineHeight: '1.7', padding: '12px 0', borderTop: '1px solid #e2e8f0' }}>{report.summary}</p>}
                    </div>

                    {/* Clinical Factors */}
                    {report.clinical_factors && (
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                            <div style={{ ...glass, padding: '16px 20px', flex: 1 }}>
                                <h4 style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: '700', color: '#10b981', textTransform: 'uppercase' }}>Favorable</h4>
                                {(report.clinical_factors.favorable || []).map((f, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '6px', padding: '3px 0', fontSize: '13px', color: '#334155' }}>
                                        <span style={{ color: '#10b981' }}>+</span>{f}
                                    </div>
                                ))}
                            </div>
                            <div style={{ ...glass, padding: '16px 20px', flex: 1 }}>
                                <h4 style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: '700', color: '#ef4444', textTransform: 'uppercase' }}>Unfavorable</h4>
                                {(report.clinical_factors.unfavorable || []).map((f, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '6px', padding: '3px 0', fontSize: '13px', color: '#334155' }}>
                                        <span style={{ color: '#ef4444' }}>−</span>{f}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Trajectory */}
                    {report.trajectory && (
                        <div id="prog-trajectory" style={{ ...glass, padding: '20px 24px', marginBottom: '12px' }}>
                            <h3 style={s.secTitle}>Trajectory: <span style={{ color: '#3b82f6' }}>{report.trajectory.class || ''}</span></h3>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                {['short_term', 'medium_term', 'long_term'].map(key => {
                                    const t = typeof report.trajectory[key] === 'object' ? report.trajectory[key] : { outlook: report.trajectory[key] || '' }
                                    return (
                                        <div key={key} style={{ flex: 1, padding: '12px', background: 'rgba(241,245,249,0.6)', borderRadius: '10px', borderTop: '3px solid #3b82f6' }}>
                                            <span style={{ fontSize: '11px', fontWeight: '700', color: '#3b82f6', textTransform: 'uppercase' }}>{key.replace('_', ' ')}</span>
                                            <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>{t.outlook || t.expected_status || ''}</p>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Survival */}
                    {report.survival_estimate && (
                        <div id="prog-survival" style={{ ...glass, padding: '20px 24px', marginBottom: '12px' }}>
                            <h3 style={s.secTitle}>Survival Estimate</h3>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                {Object.entries(report.survival_estimate).map(([k, v]) => (
                                    <div key={k} style={{ flex: 1, textAlign: 'center', padding: '16px', background: 'rgba(16,185,129,0.06)', borderRadius: '10px', border: '1px solid rgba(16,185,129,0.15)' }}>
                                        <span style={{ fontSize: '24px', fontWeight: '800', color: '#10b981' }}>{v}</span>
                                        <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Specialists */}
                    {report.specialists_needed?.length > 0 && (
                        <div id="prog-specialists" style={{ ...glass, padding: '20px 24px', marginBottom: '12px' }}>
                            <h3 style={s.secTitle}>Specialists Needed</h3>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {report.specialists_needed.map((sp, i) => (
                                    <div key={i} style={{ padding: '10px 16px', background: 'rgba(59,130,246,0.06)', borderRadius: '10px', border: '1px solid rgba(59,130,246,0.15)' }}>
                                        <span style={{ fontWeight: '700', color: '#1e3a8a', fontSize: '13px' }}>{sp.specialty || sp}</span>
                                        {sp.reason && <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>{sp.reason}</p>}
                                        {sp.urgency && <span style={{ fontSize: '10px', fontWeight: '600', color: '#f59e0b' }}>{sp.urgency}</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Safety / Warnings */}
                    <div id="prog-safety" style={{ marginBottom: '12px' }}>
                        {report.warnings?.length > 0 && (
                            <div style={{ background: 'rgba(254,242,242,0.9)', border: '1.5px solid #fecaca', borderRadius: '10px', padding: '18px 22px', marginBottom: '12px' }}>
                                <h3 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: '700', color: '#991b1b' }}>Warnings</h3>
                                {report.warnings.map((w, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '8px', padding: '4px 0', fontSize: '13px', color: '#991b1b' }}>
                                        <span>•</span>{w}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Recommendations + Lifestyle side by side */}
                        <div style={{ display: 'flex', gap: '12px' }}>
                            {report.recommendations?.length > 0 && (
                                <div style={{ ...glass, padding: '18px 22px', flex: 1 }}>
                                    <h3 style={s.secTitle}>Recommendations</h3>
                                    {report.recommendations.map((r, i) => (
                                        <div key={i} style={{ display: 'flex', gap: '6px', padding: '3px 0', fontSize: '13px', color: '#334155' }}>
                                            <span style={{ color: '#10b981' }}>•</span>{r}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {report.lifestyle_modifications?.length > 0 && (
                                <div style={{ ...glass, padding: '18px 22px', flex: 1 }}>
                                    <h3 style={s.secTitle}>Lifestyle</h3>
                                    {report.lifestyle_modifications.map((l, i) => (
                                        <div key={i} style={{ display: 'flex', gap: '6px', padding: '3px 0', fontSize: '13px', color: '#334155' }}>
                                            <span style={{ color: '#f59e0b' }}>•</span>{l}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Follow-up Plan */}
                    {report.follow_up_plan && (
                        <div style={{ ...glass, padding: '18px 22px', marginBottom: '12px' }}>
                            <h3 style={s.secTitle}>Follow-up Plan</h3>
                            <p style={{ margin: 0, fontSize: '13px', color: '#334155', lineHeight: '1.6' }}>{report.follow_up_plan}</p>
                        </div>
                    )}

                    {/* Agent Pipeline */}
                    <div id="prog-agents" style={{ ...glass, padding: '18px 22px', marginBottom: '12px' }}>
                        <button type="button" style={s.traceToggle} onClick={() => setShowTrace(v => !v)}>
                            {showTrace ? '▾' : '▸'} Agent Pipeline ({report.total_agents} agents)
                        </button>
                        {showTrace && (
                            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {report.reasoning_trace?.map((t, i) => (
                                    <div key={i} style={{ padding: '10px 14px', background: 'rgba(241,245,249,0.8)', borderRadius: '10px', borderLeft: '3px solid #3b82f6' }}>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8' }}>Agent {t.step}</span>
                                            <span style={{ fontSize: '11px', fontWeight: '600', borderRadius: '6px', padding: '2px 8px', background: t.agent?.includes('Assembler') ? '#dcfce7' : '#dbeafe', color: t.agent?.includes('Assembler') ? '#166534' : '#1d4ed8' }}>{t.agent}</span>
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
                        <span style={s.metaBadge}>{report.model_used}</span>
                        <span style={s.metaBadge}>{report.total_agents} agents</span>
                        {report.architecture && <span style={s.metaBadge}>{report.architecture}</span>}
                    </div>

                    {/* Final Prognosis (editable) */}
                    <div style={{ ...glass, padding: '20px 24px', marginBottom: '16px' }}>
                        <h3 style={s.secTitle}>Final Prognosis {isDoctor && <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '400' }}>(editable)</span>}</h3>
                        <textarea
                            style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', lineHeight: '1.6', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', minHeight: '150px', ...(isDoctor ? {} : { background: '#f8fafc', cursor: 'default' }) }}
                            value={finalText} onChange={e => isDoctor && setFinalText(e.target.value)} readOnly={!isDoctor} />
                        <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                            {isDoctor && <button style={s.saveBtn} onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Prognosis'}</button>}
                            {isDoctor && <button style={s.regenBtn} onClick={handleGenerate} disabled={generating}>{generating ? 'Generating...' : 'Regenerate'}</button>}
                            <button style={s.exportBtn} onClick={exportPDF}>Export PDF</button>
                        </div>
                    </div>
                </>
            )}

            {/* Prognosis exists but no structured report (old format) */}
            {prognosis && !report && (
                <div style={{ ...glass, padding: '24px 28px' }}>
                    <h3 style={s.secTitle}>AI Prognosis</h3>
                    <p style={{ margin: 0, fontSize: '14px', color: '#334155', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>{prognosis.ai_suggestion}</p>
                    {isDoctor && (
                        <div style={{ marginTop: '16px' }}>
                            <textarea style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', lineHeight: '1.6', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', minHeight: '120px' }}
                                value={finalText} onChange={e => setFinalText(e.target.value)} />
                            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                                <button style={s.saveBtn} onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                                <button style={s.regenBtn} onClick={handleGenerate} disabled={generating}>{generating ? 'Generating...' : 'Regenerate'}</button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

const s = {
    backBtn: { padding: '8px 16px', background: 'rgba(255,255,255,0.7)', border: '1.5px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#475569' },
    generateBtn: { padding: '14px 28px', background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 14px rgba(59,130,246,0.3)' },
    agentBox: { background: 'linear-gradient(135deg, #0f172a, #162044)', borderRadius: '10px', padding: '20px 24px', display: 'flex', gap: '16px', alignItems: 'center' },
    agentPulse: { width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0, background: 'radial-gradient(circle, #f59e0b 30%, transparent 70%)', animation: 'pulse 1.5s ease-in-out infinite' },
    agentTitle: { color: '#f59e0b', fontSize: '14px', fontWeight: '700', margin: '0 0 4px' },
    agentSub: { color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: 0 },

    secTitle: { margin: '0 0 12px', fontSize: '14px', fontWeight: '700', color: '#0f172a' },
    traceToggle: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#64748b', padding: 0, textAlign: 'left' },
    metaBadge: { fontSize: '11px', fontWeight: '600', color: '#1e3a8a', background: 'rgba(59,130,246,0.1)', borderRadius: '6px', padding: '4px 10px' },
    saveBtn: { padding: '10px 20px', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
    regenBtn: { padding: '10px 20px', background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
    exportBtn: { padding: '10px 20px', background: 'linear-gradient(135deg, #475569, #334155)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }
}

export default PrognosisPage
