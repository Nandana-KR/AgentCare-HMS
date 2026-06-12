import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axiosInstance from '../api/axiosInstance'

function PrognosisPage() {
    const { diagnosisId } = useParams()
    const navigate = useNavigate()

    const [diagnosis, setDiagnosis] = useState(null)
    const [prognosis, setPrognosis] = useState(null)
    const [finalText, setFinalText] = useState('')
    const [loading, setLoading] = useState(true)
    const [generating, setGenerating] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const [saved, setSaved] = useState(false)

    useEffect(() => {
        fetchData()
    }, [diagnosisId])

    const fetchData = async () => {
        setLoading(true)
        try {
            // Fetch diagnosis details
            const diagRes = await axiosInstance.get(
                `/api/v1/diagnoses/${diagnosisId}`
            )
            setDiagnosis(diagRes.data)

            // Check if prognosis already exists
            const progRes = await axiosInstance.get(
                `/api/v1/prognosis/diagnosis/${diagnosisId}`
            )

            if (progRes.data.length > 0) {
                const existing = progRes.data[0]
                setPrognosis(existing)
                setFinalText(
                    existing.final_prognosis || existing.ai_suggestion
                )
            }
        } catch (err) {
            setError('Failed to load data')
        } finally {
            setLoading(false)
        }
    }

    const handleGenerate = async () => {
        setGenerating(true)
        setError(null)
        try {
            const res = await axiosInstance.post(
                '/api/v1/prognosis/generate',
                { diagnosis_id: diagnosisId }
            )
            setPrognosis(res.data)
            setFinalText(res.data.ai_suggestion)
        } catch (err) {
            setError('Failed to generate prognosis. Try again.')
        } finally {
            setGenerating(false)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        setError(null)
        try {
            await axiosInstance.patch(
                `/api/v1/prognosis/${prognosis.id}/save`,
                { final_prognosis: finalText }
            )
            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
        } catch (err) {
            setError('Failed to save prognosis')
        } finally {
            setSaving(false)
        }
    }

    if (loading) return (
        <p style={styles.loading}>Loading...</p>
    )

    return (
        <div style={styles.container}>

            {/* Header */}
            <div style={styles.header}>
                <button
                    style={styles.backBtn}
                    onClick={() => navigate(-1)}
                >
                    ← Back
                </button>
                <h2 style={styles.title}>Prognosis</h2>
            </div>

            {/* Diagnosis Summary */}
            {diagnosis && (
                <div style={styles.diagnosisCard}>
                    <h3 style={styles.cardTitle}>Diagnosis Summary</h3>
                    <div style={styles.row}>
                        <span style={styles.label}>Symptoms</span>
                        <span style={styles.value}>
                            {diagnosis.symptoms}
                        </span>
                    </div>
                    <div style={styles.row}>
                        <span style={styles.label}>Diagnosis</span>
                        <span style={styles.value}>
                            {diagnosis.diagnosis_text}
                        </span>
                    </div>
                    {diagnosis.icd_code && (
                        <div style={styles.row}>
                            <span style={styles.label}>ICD Code</span>
                            <span style={styles.value}>
                                {diagnosis.icd_code}
                            </span>
                        </div>
                    )}
                </div>
            )}

            {error && (
                <div style={styles.errorBanner}>{error}</div>
            )}

            {saved && (
                <div style={styles.successBanner}>
                    ✅ Prognosis saved successfully
                </div>
            )}

            {/* State 1 — No prognosis yet */}
            {prognosis === null && (
                <div style={styles.generateSection}>
                    <p style={styles.generateText}>
                        No prognosis generated yet.
                        Click the button below to get an
                        AI-powered prognosis based on the
                        patient's full medical history.
                    </p>
                    <button
                        style={styles.generateBtn}
                        onClick={handleGenerate}
                        disabled={generating}
                    >
                        {generating
                            ? '⏳ Generating...'
                            : '🤖 Generate AI Prognosis'}
                    </button>
                    {generating && (
                        <p style={styles.generatingText}>
                            AI is analyzing patient history...
                            this may take a few seconds.
                        </p>
                    )}
                </div>
            )}

            {/* State 2 — Prognosis exists */}
            {prognosis !== null && (
                <div style={styles.prognosisSection}>

                    {/* AI Suggestion — read only */}
                    <div style={styles.aiSection}>
                        <div style={styles.aiHeader}>
                            <h3 style={styles.cardTitle}>
                                AI Suggestion
                            </h3>
                            <span style={styles.modelBadge}>
                                {prognosis.model_used}
                            </span>
                        </div>
                        <div style={styles.aiText}>
                            {prognosis.ai_suggestion}
                        </div>
                    </div>

                    {/* Editable final prognosis */}
                    <div style={styles.editSection}>
                        <h3 style={styles.cardTitle}>
                            Final Prognosis
                            <span style={styles.editNote}>
                                (edit if needed)
                            </span>
                        </h3>
                        <textarea
                            style={styles.textarea}
                            value={finalText}
                            onChange={(e) =>
                                setFinalText(e.target.value)
                            }
                            rows={10}
                        />
                    </div>

                    {/* Action buttons */}
                    <div style={styles.actions}>
                        <button
                            style={styles.saveBtn}
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : 'Save Final Prognosis'}
                        </button>

                        <button
                            style={styles.regenerateBtn}
                            onClick={handleGenerate}
                            disabled={generating}
                        >
                            {generating
                                ? 'Generating...'
                                : '🔄 Regenerate'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

const styles = {
    container: {
        padding: '24px',
        maxWidth: '800px',
        margin: '0 auto'
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '24px'
    },
    backBtn: {
        padding: '8px 16px',
        backgroundColor: '#e2e8f0',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer'
    },
    title: {
        color: '#1a365d',
        margin: 0
    },
    diagnosisCard: {
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        marginBottom: '20px'
    },
    cardTitle: {
        color: '#2d3748',
        margin: '0 0 12px 0',
        fontSize: '16px'
    },
    row: {
        display: 'flex',
        gap: '12px',
        marginBottom: '8px'
    },
    label: {
        fontSize: '13px',
        color: '#718096',
        fontWeight: '600',
        minWidth: '90px'
    },
    value: {
        fontSize: '14px',
        color: '#2d3748'
    },
    errorBanner: {
        backgroundColor: '#fed7d7',
        color: '#9b2c2c',
        padding: '12px 16px',
        borderRadius: '8px',
        marginBottom: '16px'
    },
    successBanner: {
        backgroundColor: '#c6f6d5',
        color: '#276749',
        padding: '12px 16px',
        borderRadius: '8px',
        marginBottom: '16px'
    },
    generateSection: {
        backgroundColor: 'white',
        padding: '32px',
        borderRadius: '10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        textAlign: 'center'
    },
    generateText: {
        color: '#718096',
        marginBottom: '20px',
        lineHeight: '1.6'
    },
    generateBtn: {
        padding: '14px 28px',
        backgroundColor: '#805ad5',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontSize: '16px',
        cursor: 'pointer'
    },
    generatingText: {
        color: '#805ad5',
        marginTop: '16px',
        fontSize: '14px'
    },
    prognosisSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
    },
    aiSection: {
        backgroundColor: '#faf5ff',
        padding: '20px',
        borderRadius: '10px',
        border: '1px solid #d6bcfa'
    },
    aiHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px'
    },
    modelBadge: {
        fontSize: '11px',
        backgroundColor: '#805ad5',
        color: 'white',
        padding: '3px 10px',
        borderRadius: '12px'
    },
    aiText: {
        fontSize: '14px',
        color: '#2d3748',
        lineHeight: '1.7',
        whiteSpace: 'pre-wrap'
    },
    editSection: {
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
    },
    editNote: {
        fontSize: '12px',
        color: '#a0aec0',
        fontWeight: '400',
        marginLeft: '8px'
    },
    textarea: {
        width: '100%',
        padding: '12px',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        fontSize: '14px',
        lineHeight: '1.6',
        resize: 'vertical',
        fontFamily: 'inherit',
        boxSizing: 'border-box'
    },
    actions: {
        display: 'flex',
        gap: '12px'
    },
    saveBtn: {
        padding: '12px 24px',
        backgroundColor: '#38a169',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        fontSize: '15px',
        cursor: 'pointer'
    },
    regenerateBtn: {
        padding: '12px 24px',
        backgroundColor: '#805ad5',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        fontSize: '15px',
        cursor: 'pointer'
    },
    loading: {
        textAlign: 'center',
        padding: '40px',
        color: '#718096'
    }
}

export default PrognosisPage