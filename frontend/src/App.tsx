import { useEffect, useMemo, useState } from 'react'
import Loader from './components/Loader'
import Toast from './components/Toast'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts'
import { synthesizeBatch } from './lib/localSynth'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

const DISEASES = [
  "Alzheimer's",
  "Parkinson's",
  "Epilepsy",
  "Stroke",
  "Brain Tumor",
  "Multiple Sclerosis",
  "Depression",
  "Anxiety",
  "PTSD",
  "Cognitive Decline",
]

type PatientRecord = {
  id: string
  age: number
  gender: string
  diagnosis: string
  symptoms: string[]
  test_results: Record<string, any>
  treatment_plan: string[]
  narrative: string
}

export default function App() {
  const [disease, setDisease] = useState<string>('')
  const [count, setCount] = useState<number>(3)
  const [loading, setLoading] = useState(false)
  const [records, setRecords] = useState<PatientRecord[]>([])
  const [csvB64, setCsvB64] = useState<string>('')
  const [filename, setFilename] = useState<string>('data.csv')
  const [error, setError] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'generated'|'insights'|'about'|'assessment'|'guide'>('about')
  const [toastText, setToastText] = useState<string>('')
  type RunSummary = { id: string; ts: number; disease: string; count: number; low: number; moderate: number; high: number }
  const [history, setHistory] = useState<RunSummary[]>([])
  // Self-assessment state (simple, on-device heuristics)
  const [saAge, setSaAge] = useState<number>(50)
  const [saMemoryIssues, setSaMemoryIssues] = useState<boolean>(false)
  const [saSeizures, setSaSeizures] = useState<boolean>(false)
  const [saSpeechTrouble, setSaSpeechTrouble] = useState<boolean>(false)
  const [saLowMood, setSaLowMood] = useState<boolean>(false)
  const [saAnxious, setSaAnxious] = useState<boolean>(false)
  const [saResult, setSaResult] = useState<{ score: number; level: 'Low'|'Moderate'|'High'; note: string }|null>(null)

  const ageData = useMemo(() => {
    const buckets: Record<string, number> = { '0-17': 0, '18-29': 0, '30-44': 0, '45-59': 0, '60-74': 0, '75+': 0 }
    for (const r of records) {
      const a = r.age
      if (a < 18) buckets['0-17']++
      else if (a < 30) buckets['18-29']++
      else if (a < 45) buckets['30-44']++
      else if (a < 60) buckets['45-59']++
      else if (a < 75) buckets['60-74']++
      else buckets['75+']++
    }
    return Object.entries(buckets).map(([name, value]) => ({ name, value }))
  }, [records])

  const symptomData = useMemo(() => {
    const freq: Record<string, number> = {}
    for (const r of records) for (const s of r.symptoms) freq[s] = (freq[s] || 0) + 1
    return Object.entries(freq).map(([name, value]) => ({ name, value }))
  }, [records])

  // Simple heuristic risk scoring to support Detect/Personalize use-cases
  function computeRiskScore(r: PatientRecord): number {
    let score = 10
    const diag = r.diagnosis
    const tests = r.test_results || {}
    const has = (k: string) => r.symptoms.map(s => s.toLowerCase()).some(s => s.includes(k))

    if (diag === "Alzheimer's" || diag === 'Cognitive Decline') {
      const mmse = Number(tests.MMSE ?? 30)
      const moca = Number(tests.MoCA ?? 27)
      score += (Math.max(0, 30 - mmse) / 30) * 40
      score += (Math.max(0, 27 - moca) / 27) * 20
      if (r.age >= 65) score += 10
      if (has('memory') || has('confusion')) score += 10
    } else if (diag === 'Depression') {
      const phq9 = Number(tests['PHQ-9'] ?? 0)
      score += (phq9 / 27) * 70
    } else if (diag === 'Anxiety') {
      const gad7 = Number(tests['GAD-7'] ?? 0)
      score += (gad7 / 21) * 60
    } else if (diag === 'Stroke') {
      const nihss = Number(tests.NIHSS ?? 0)
      score += (nihss / 42) * 80
      if (has('slurred') || has('hemiparesis') || has('facial')) score += 10
    } else if (diag === 'Epilepsy') {
      if ((tests.EEG || '').toString().toLowerCase() === 'abnormal') score += 40
      if (has('seizure')) score += 30
    } else if (diag === 'Brain Tumor') {
      if (has('seizure')) score += 25
      if (has('headache')) score += 15
      if (has('cognitive')) score += 20
    } else if (diag === 'Multiple Sclerosis') {
      if (has('optic') || has('numbness') || has('spasticity')) score += 30
    }

    return Math.max(0, Math.min(100, Math.round(score)))
  }

  function riskLevel(score: number): 'Low'|'Moderate'|'High' {
    if (score >= 60) return 'High'
    if (score >= 30) return 'Moderate'
    return 'Low'
  }

  const riskData = useMemo(() => {
    const buckets: Record<'Low'|'Moderate'|'High', number> = { Low: 0, Moderate: 0, High: 0 }
    for (const r of records) {
      const s = computeRiskScore(r)
      buckets[riskLevel(s)]++
    }
    return Object.entries(buckets).map(([name, value]) => ({ name, value }))
  }, [records])

  function runSelfAssessment() {
    let score = 10
    // Weight signals based on currently selected disease when possible
    if (disease === "Alzheimer's" || disease === 'Cognitive Decline') {
      if (saAge >= 65) score += 15
      if (saMemoryIssues) score += 40
    } else if (disease === 'Stroke') {
      if (saSpeechTrouble) score += 40
      if (saSeizures) score += 10
    } else if (disease === 'Epilepsy') {
      if (saSeizures) score += 50
    } else if (disease === 'Depression') {
      if (saLowMood) score += 50
    } else if (disease === 'Anxiety') {
      if (saAnxious) score += 50
    } else {
      // Generic
      if (saMemoryIssues) score += 20
      if (saSeizures) score += 20
      if (saSpeechTrouble) score += 20
      if (saLowMood) score += 20
      if (saAnxious) score += 20
    }
    if (saAge > 75) score += 10
    score = Math.max(0, Math.min(100, Math.round(score)))
    const level = riskLevel(score)
    const note = level === 'High'
      ? 'This screening suggests elevated risk. Consider seeking professional medical evaluation.'
      : level === 'Moderate'
      ? 'Some risk indicators present. Monitor symptoms and consider a check-up.'
      : 'Low risk indicators based on inputs.'
    setSaResult({ score, level, note })
  }

  // Disease guide content for a marketing/education style page per disease
  type LinkItem = { label: string; url: string }
  const DISEASE_GUIDE: Record<string, { overview: string; symptoms: string[]; tests: string[]; links: LinkItem[] }> = {
    "Alzheimer's": {
      overview: "Neurodegenerative disorder characterized by progressive memory and cognitive decline.",
      symptoms: ["memory loss","disorientation","word-finding difficulty","impaired judgment"],
      tests: ["MMSE","MoCA","Neuropsychological testing","MRI"],
      links: [
        { label: 'WHO overview', url: 'https://www.who.int/news-room/fact-sheets/detail/dementia' },
        { label: 'Alzheimer\'s Association', url: 'https://www.alz.org/' }
      ]
    },
    "Parkinson's": {
      overview: "Movement disorder due to dopaminergic neuron loss affecting motor and non-motor function.",
      symptoms: ["tremor","rigidity","bradykinesia","postural instability"],
      tests: ["Clinical exam","UPDRS","DaTscan (select cases)"],
      links: [
        { label: 'Parkinson\'s Foundation', url: 'https://www.parkinson.org/' },
        { label: 'NINDS PD', url: 'https://www.ninds.nih.gov/health-information/disorders/parkinsons-disease' }
      ]
    },
    Epilepsy: {
      overview: "Neurological condition with a predisposition to generate epileptic seizures.",
      symptoms: ["seizures","aura","post-ictal fatigue"],
      tests: ["EEG","MRI","CT (acute)"],
      links: [
        { label: 'ILAE', url: 'https://www.ilae.org/' },
        { label: 'CDC Epilepsy', url: 'https://www.cdc.gov/epilepsy/' }
      ]
    },
    Stroke: {
      overview: "Acute vascular event causing focal neurological deficits due to infarct or hemorrhage.",
      symptoms: ["hemiparesis","facial droop","slurred speech","vision loss"],
      tests: ["CT/CTA","MRI/MRA","NIHSS"],
      links: [
        { label: 'American Stroke Association', url: 'https://www.stroke.org/' }
      ]
    },
    "Brain Tumor": {
      overview: "Abnormal growth of brain cells; presentations depend on location and grade.",
      symptoms: ["headache","seizures","nausea","cognitive changes"],
      tests: ["MRI with contrast","Biopsy (when indicated)"],
      links: [
        { label: 'ABTA', url: 'https://www.abta.org/' }
      ]
    },
    "Multiple Sclerosis": {
      overview: "Immune-mediated demyelinating disease of the central nervous system.",
      symptoms: ["optic neuritis","numbness","spasticity","fatigue"],
      tests: ["MRI","CSF (OCBs)","McDonald criteria"],
      links: [
        { label: 'National MS Society', url: 'https://www.nationalmssociety.org/' }
      ]
    },
    Depression: {
      overview: "Mood disorder with persistent low mood and anhedonia impacting daily function.",
      symptoms: ["low mood","sleep disturbance","anhedonia","poor concentration"],
      tests: ["PHQ-9"],
      links: [
        { label: 'WHO: Depression', url: 'https://www.who.int/news-room/fact-sheets/detail/depression' }
      ]
    },
    Anxiety: {
      overview: "Characterized by excessive worry, restlessness, and autonomic symptoms.",
      symptoms: ["restlessness","tachycardia","sweating","insomnia"],
      tests: ["GAD-7"],
      links: [
        { label: 'NIMH Anxiety', url: 'https://www.nimh.nih.gov/health/topics/anxiety-disorders' }
      ]
    },
    PTSD: {
      overview: "Trauma- and stressor-related disorder with intrusive memories and hyperarousal.",
      symptoms: ["flashbacks","avoidance","hypervigilance","nightmares"],
      tests: ["PCL-5 (screening)"],
      links: [
        { label: 'VA PTSD', url: 'https://www.ptsd.va.gov/' }
      ]
    },
    "Cognitive Decline": {
      overview: "Decline in cognitive domains that may precede or accompany dementias.",
      symptoms: ["forgetfulness","word-finding difficulty","slowed processing"],
      tests: ["MoCA","MMSE","Neuropsych testing"],
      links: [
        { label: 'NIH Cognitive Health', url: 'https://www.nia.nih.gov/health/topics/cognitive-health' }
      ]
    }
  }

  // URL sync for shareability
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const qDisease = params.get('disease') || ''
    const qCount = Number(params.get('count') || '')
    const qTab = params.get('tab') as any
    if (qDisease) setDisease(qDisease)
    if (!Number.isNaN(qCount) && qCount > 0) setCount(qCount)
    if (qTab && ['generated','insights','about','assessment'].includes(qTab)) setActiveTab(qTab)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    if (disease) params.set('disease', disease)
    if (count) params.set('count', String(count))
    if (activeTab) params.set('tab', activeTab)
    const url = `${location.pathname}?${params.toString()}`
    window.history.replaceState(null, '', url)
  }, [disease, count, activeTab])

  // Load run history
  useEffect(() => {
    try {
      const raw = localStorage.getItem('neurogen_history')
      if (raw) setHistory(JSON.parse(raw))
    } catch {}
  }, [])

  async function onGenerate() {
    setLoading(true)
    setError('')
    try {
      const resp = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disease_type: disease, num_records: count })
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      setRecords(data.records)
      setCsvB64(data.csv_base64)
      setFilename(data.filename)
    } catch (e: any) {
      // Fallback: client-side synthetic generator (silent)
      const local = synthesizeBatch(disease, count)
      setRecords(local.records as unknown as PatientRecord[])
      setCsvB64(local.csv_base64)
      setFilename(local.filename)
    } finally {
      setLoading(false)
      setActiveTab('generated')
      // Save run summary to localStorage history
      try {
        const buckets: Record<'Low'|'Moderate'|'High', number> = { Low: 0, Moderate: 0, High: 0 }
        for (const r of records) {
          const s = computeRiskScore(r)
          buckets[riskLevel(s)]++
        }
        const entry: RunSummary = { id: crypto.randomUUID(), ts: Date.now(), disease, count, low: buckets.Low, moderate: buckets.Moderate, high: buckets.High }
        const next = [entry, ...history].slice(0, 10)
        setHistory(next)
        localStorage.setItem('neurogen_history', JSON.stringify(next))
      } catch {}
    }
  }

  function downloadCsv() {
    const a = document.createElement('a')
    a.href = `data:text/csv;base64,${csvB64}`
    a.download = filename
    a.click()
  }

  return (
    <div className="min-h-screen bg-brand-50 flex">
      <aside className="w-80 bg-white border-r border-slate-200 px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <svg className="h-7 w-7 text-brand-600" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2c-4.97 0-9 3.582-9 8 0 2.23 1.02 4.233 2.67 5.67.38.33.33.94-.12 1.18-.8.43-1.33 1.05-1.33 1.86 0 1.38 1.78 2.29 3.33 1.55 1.19-.57 2.55-.88 4.45-.88s3.26.31 4.45.88c1.55.74 3.33-.17 3.33-1.55 0-.81-.53-1.43-1.33-1.86-.45-.24-.5-.85-.12-1.18A7.94 7.94 0 0 0 21 10c0-4.418-4.03-8-9-8z"/>
          </svg>
          <div>
            <div className="text-xl font-semibold">NeuroSynth</div>
            <div className="text-slate-500 text-sm">Synthetic data engine</div>
          </div>
        </div>

        <div>
          <h3 className="text-slate-900 font-medium mb-3">Generation Controls</h3>
          <p className="text-sm text-slate-600 mb-4">Select a disease and number of records to generate.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-600">Disease Type</label>
              <select className="mt-1 w-full border rounded px-2 py-2 bg-white" value={disease} onChange={e => setDisease(e.target.value)}>
                <option value="" disabled>Select a disease</option>
                {DISEASES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600">Number of Records</label>
              <input
                type="number"
                min={1}
                className="mt-1 w-full border rounded px-2 py-2"
                value={count}
                onChange={e => {
                  const raw = e.target.value || '0'
                  const noLeadingZeros = raw.replace(/^0+(?=\d)/, '')
                  const num = parseInt(noLeadingZeros || '0')
                  setCount(Number.isNaN(num) ? 0 : num)
                }}
              />
            </div>
            <div className="flex items-center gap-3">
              <button onClick={onGenerate} className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded disabled:opacity-60 shadow-sm" disabled={loading || !disease}>
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4h12v2H4zM4 9h12v2H4zM4 14h7v2H4z"/></svg>
                Generate Data
              </button>
              {loading && <Loader />}
            </div>
            {csvB64 && (
              <button onClick={downloadCsv} className="w-full border border-brand-600 text-brand-700 px-4 py-2 rounded hover:bg-brand-50">Download CSV</button>
            )}
            {error && <p className="text-red-600">{error}</p>}
          </div>
        </div>
      </aside>

      <main className="flex-1 px-6 py-6">
        <h1 className="text-2xl font-semibold text-slate-900">Synthetic Data Dashboard</h1>

        <div className="mt-4 bg-brand-50 border border-brand-100 rounded-lg shadow-sm p-2">
          <div className="flex gap-2">
            <button onClick={() => setActiveTab('generated')} className={`flex items-center gap-2 px-3 py-2 rounded-md border transition-colors ${activeTab==='generated' ? 'bg-transparent text-brand-700 border-brand-500' : 'border-brand-200 text-slate-700 hover:bg-brand-100 hover:text-brand-700 hover:border-brand-300'}`}>
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4h12v2H4zM4 9h12v2H4zM4 14h12v2H4z"/></svg>
              Generated Data
            </button>
            <button onClick={() => setActiveTab('insights')} className={`flex items-center gap-2 px-3 py-2 rounded-md border transition-colors ${activeTab==='insights' ? 'bg-transparent text-brand-700 border-brand-500' : 'border-brand-200 text-slate-700 hover:bg-brand-100 hover:text-brand-700 hover:border-brand-300'}`}>
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M3 3h2v14H3zM8 8h2v9H8zM13 5h2v12h-2zM18 10h2v7h-2z"/></svg>
              Data Insights
            </button>
            <button onClick={() => setActiveTab('assessment')} className={`flex items-center gap-2 px-3 py-2 rounded-md border transition-colors ${activeTab==='assessment' ? 'bg-transparent text-brand-700 border-brand-500' : 'border-brand-200 text-slate-700 hover:bg-brand-100 hover:text-brand-700 hover:border-brand-300'}`}>
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 12H9v-2h2v2zm0-4H9V6h2v4z"/></svg>
              Self-Assessment
            </button>
            <button onClick={() => setActiveTab('guide')} className={`flex items-center gap-2 px-3 py-2 rounded-md border transition-colors ${activeTab==='guide' ? 'bg-transparent text-brand-700 border-brand-500' : 'border-brand-200 text-slate-700 hover:bg-brand-100 hover:text-brand-700 hover:border-brand-300'}`}>
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4h12v2H4zM4 8h12v2H4zM4 12h12v2H4zM4 16h12v2H4z"/></svg>
              Disease Guide
            </button>
            <button onClick={() => setActiveTab('about')} className={`flex items-center gap-2 px-3 py-2 rounded-md border transition-colors ${activeTab==='about' ? 'bg-white text-brand-700 border-brand-300' : 'border-brand-200 text-slate-700 hover:bg-brand-100 hover:text-brand-700 hover:border-brand-300'}`}>
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a7 7 0 100 14A7 7 0 009 2zm0 4a1 1 0 110 2 1 1 0 010-2zm-1 4h2v4H8v-4z"/></svg>
              About
            </button>
            <div className="flex-1" />
            <button onClick={() => {
              navigator.clipboard.writeText(location.href)
              setToastText('Shareable link copied')
              setTimeout(()=>setToastText(''), 2500)
            }} className="px-3 py-2 border rounded text-slate-700 border-brand-200 hover:bg-brand-100 hover:text-brand-700 hover:border-brand-300 transition-colors">Share Link</button>
          </div>
        </div>

        {activeTab === 'about' && (
          <section className="mt-6 bg-white rounded-lg shadow p-6 border border-slate-200 space-y-4">
            <div>
              <h2 className="text-xl font-semibold">About NeuroSynth</h2>
              <p className="text-slate-600">The Engine for the Next Generation of Neurological AI</p>
            </div>
            <div className="space-y-3">
              <div>
                <h3 className="font-medium">The Challenge: Data Scarcity in Neuroscience</h3>
                <p className="text-slate-700">Progress in AI-powered diagnostics for diseases like Alzheimer's, Parkinson's, and PTSD is often blocked by a major hurdle: the lack of large, high-quality, and privacy-compliant datasets.</p>
              </div>
              <div>
                <h3 className="font-medium">Our Solution: A Synthetic Data Generation Platform</h3>
                <p className="text-slate-700">NeuroSynth generates realistic, structured, and safe synthetic data for a wide range of neurological and mental health conditions.</p>
              </div>
              <div>
                <h3 className="font-medium">How NeuroSynth Empowers Detection and Research</h3>
                <ul className="list-disc pl-5 text-slate-700 space-y-1">
                  <li>Train and validate new AI models for early disease detection.</li>
                  <li>Simulate patient populations to test treatment personalization algorithms.</li>
                  <li>Develop better tools without compromising privacy.</li>
                </ul>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'guide' && (
          <section className="mt-6 bg-white rounded-lg shadow p-6 border border-slate-200">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h2 className="text-2xl font-semibold">Disease Guide</h2>
                <p className="text-slate-600 mt-1">Educational overview for common conditions. Not medical advice.</p>
              </div>
              <div>
                <select className="border rounded px-2 py-2" value={disease} onChange={e=>setDisease(e.target.value)}>
                  <option value="" disabled>Select disease</option>
                  {DISEASES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            {disease && (
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <div className="p-5 rounded-lg border bg-brand-50/40">
                    <h3 className="text-xl font-medium">{disease}</h3>
                    <p className="mt-2 text-slate-700">{DISEASE_GUIDE[disease]?.overview}</p>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium text-slate-700">Common Symptoms</h4>
                        <ul className="list-disc pl-5 text-slate-700 mt-1 space-y-1">
                          {DISEASE_GUIDE[disease]?.symptoms.map((s,i)=>(<li key={i}>{s}</li>))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium text-slate-700">Typical Tests</h4>
                        <ul className="list-disc pl-5 text-slate-700 mt-1 space-y-1">
                          {DISEASE_GUIDE[disease]?.tests.map((s,i)=>(<li key={i}>{s}</li>))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="border rounded p-4">
                    <h4 className="font-medium">Quick Generate</h4>
                    <p className="text-sm text-slate-600">Common presets to explore patterns.</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {[100,1000,10000].map(n => (
                        <button key={n} onClick={()=>{ setCount(n); setActiveTab('generated'); }} className="border rounded px-3 py-2 hover:bg-slate-50">{n.toLocaleString()}</button>
                      ))}
                    </div>
                  </div>
                  <div className="border rounded p-4">
                    <h4 className="font-medium">Resources</h4>
                    <ul className="list-disc pl-5 text-slate-700 mt-1 space-y-1">
                      {DISEASE_GUIDE[disease]?.links.map((l,i)=>(<li key={i}><a className="text-brand-700 hover:underline" href={l.url} target="_blank" rel="noreferrer">{l.label}</a></li>))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === 'generated' && (
          <section className="mt-6 bg-white rounded-lg shadow p-4 border border-slate-200">
            <h2 className="text-lg font-medium mb-3">Generated Records</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left p-2">ID</th>
                    <th className="text-left p-2">Age</th>
                    <th className="text-left p-2">Gender</th>
                    <th className="text-left p-2">Diagnosis</th>
                    <th className="text-left p-2">Symptoms</th>
                    <th className="text-left p-2">Treatment</th>
                    <th className="text-left p-2">Risk</th>
                    <th className="text-left p-2">Narrative</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => (
                    <tr key={r.id} className="border-b">
                      <td className="p-2">{r.id.slice(0,8)}</td>
                      <td className="p-2">{r.age}</td>
                      <td className="p-2">{r.gender}</td>
                      <td className="p-2">{r.diagnosis}</td>
                      <td className="p-2">{r.symptoms.join(', ')}</td>
                      <td className="p-2">{r.treatment_plan.join(', ')}</td>
                      <td className="p-2">
                        {(() => { const s = computeRiskScore(r); const lvl = riskLevel(s); return (
                          <span className={`px-2 py-1 rounded text-xs ${lvl==='High'?'bg-red-100 text-red-700':lvl==='Moderate'?'bg-amber-100 text-amber-700':'bg-emerald-100 text-emerald-700'}`}>{lvl} ({s})</span>
                        )})()}
                      </td>
                      <td className="p-2 max-w-xl whitespace-pre-wrap">{r.narrative}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'insights' && (
          <section className="mt-6 bg-white rounded-lg shadow p-4 border border-slate-200">
            <h2 className="text-lg font-medium mb-3">Data Insights</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-64">
                <h3 className="text-slate-600 mb-2">Age Distribution</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageData}>
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="h-64">
                <h3 className="text-slate-600 mb-2">Symptom Frequency</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={symptomData} dataKey="value" nameKey="name" outerRadius={90}>
                      {symptomData.map((_, i) => (
                        <Cell key={i} fill={["#60a5fa","#93c5fd","#2563eb","#1e40af","#1d4ed8"][i % 5]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="h-64 md:col-span-2">
                <h3 className="text-slate-600 mb-2">Risk Distribution</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={riskData}>
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#1d4ed8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mt-6">
                  <h3 className="text-slate-600">Run History</h3>
                  <button onClick={() => {
                    const total = records.length
                    const riskSummary = riskData.map(d=>`${d.name}:${d.value}`).join(', ')
                    const text = `NeuroSynth summary\nDisease: ${disease}\nRecords: ${count}\nGenerated: ${total}\nRisk: ${riskSummary}`
                    navigator.clipboard.writeText(text)
                    setToastText('Summary copied')
                    setTimeout(()=>setToastText(''), 2500)
                  }} className="px-3 py-1.5 border rounded text-sm hover:bg-slate-50">Copy Summary</button>
                </div>
                <div className="overflow-x-auto mt-2">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="text-left p-2">When</th>
                        <th className="text-left p-2">Disease</th>
                        <th className="text-left p-2">Count</th>
                        <th className="text-left p-2">Low</th>
                        <th className="text-left p-2">Moderate</th>
                        <th className="text-left p-2">High</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map(h => (
                        <tr key={h.id} className="border-b">
                          <td className="p-2">{new Date(h.ts).toLocaleString()}</td>
                          <td className="p-2">{h.disease}</td>
                          <td className="p-2">{h.count}</td>
                          <td className="p-2">{h.low}</td>
                          <td className="p-2">{h.moderate}</td>
                          <td className="p-2">{h.high}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'assessment' && (
          <section className="mt-6 bg-white rounded-lg shadow p-6 border border-slate-200">
            <h2 className="text-lg font-medium mb-4">Self-Assessment</h2>
            <p className="text-sm text-slate-600 mb-4">This interactive screening is for educational purposes only and not a diagnosis.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              <div>
                <label className="block text-sm text-slate-600">Disease Context</label>
                <select className="mt-1 w-full border rounded px-2 py-2 bg-white" value={disease} onChange={e => setDisease(e.target.value)}>
                  <option value="">General</option>
                  {DISEASES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600">Age</label>
                <input type="number" min={0} className="mt-1 w-full border rounded px-2 py-2" value={saAge} onChange={e => setSaAge(parseInt(e.target.value || '0'))} />
              </div>
              <div>
                <button onClick={runSelfAssessment} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded">Assess Risk</button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex items-center gap-2"><input type="checkbox" checked={saMemoryIssues} onChange={e=>setSaMemoryIssues(e.target.checked)} /> Memory issues / confusion</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={saSeizures} onChange={e=>setSaSeizures(e.target.checked)} /> Seizures / aura</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={saSpeechTrouble} onChange={e=>setSaSpeechTrouble(e.target.checked)} /> Speech trouble / weakness</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={saLowMood} onChange={e=>setSaLowMood(e.target.checked)} /> Low mood / anhedonia</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={saAnxious} onChange={e=>setSaAnxious(e.target.checked)} /> Restlessness / anxiety</label>
            </div>
            {saResult && (
              <div className="mt-6 flex items-center gap-4">
                <div className={`px-3 py-2 rounded text-sm ${saResult.level==='High'?'bg-red-100 text-red-700':saResult.level==='Moderate'?'bg-amber-100 text-amber-700':'bg-emerald-100 text-emerald-700'}`}>
                  Risk: {saResult.level} ({saResult.score})
                </div>
                <p className="text-slate-700">{saResult.note}</p>
              </div>
            )}
          </section>
        )}
      </main>
      {toastText && <Toast text={toastText} />}
    </div>
  )
}
