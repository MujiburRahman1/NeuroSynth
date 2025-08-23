import type { VercelRequest, VercelResponse } from '@vercel/node'

const DISEASES = [
  "Alzheimer's","Parkinson's","Epilepsy","Stroke","Brain Tumor","Multiple Sclerosis","Depression","Anxiety","PTSD","Cognitive Decline"
]

const SYMPTOMS: Record<string, string[]> = {
  "Alzheimer's": ["memory loss","confusion","disorientation","task difficulty"],
  "Parkinson's": ["tremor","rigidity","bradykinesia","balance issues"],
  Epilepsy: ["seizures","aura","fatigue post-ictal","staring spells"],
  Stroke: ["hemiparesis","slurred speech","facial droop","vision loss"],
  "Brain Tumor": ["headache","nausea","seizures","cognitive changes"],
  "Multiple Sclerosis": ["numbness","optic neuritis","spasticity","fatigue"],
  Depression: ["low mood","anhedonia","sleep disturbance","poor concentration"],
  Anxiety: ["restlessness","tachycardia","sweating","insomnia"],
  PTSD: ["flashbacks","hypervigilance","avoidance","nightmares"],
  "Cognitive Decline": ["forgetfulness","word-finding difficulty","slowed processing","disorientation"],
}

function randInt(min: number, max: number) { return Math.floor(Math.random()*(max-min+1))+min }
function pick<T>(arr: T[], n: number) { return [...arr].sort(()=>0.5-Math.random()).slice(0,n) }

function randomRecord(disease: string) {
  const id = crypto.randomUUID()
  const age = randInt(18, 95)
  const gender = ["Male","Female","Other"][randInt(0,2)]
  const sx = SYMPTOMS[disease] || ["nonspecific symptom"]
  const symptoms = pick(sx, Math.min(3, sx.length))
  const tests: Record<string, any> = {}
  if (disease === "Alzheimer's" || disease === "Cognitive Decline") {
    tests.MMSE = randInt(0,30); tests.MoCA = randInt(0,27)
  } else if (disease === "Depression") {
    tests["PHQ-9"] = randInt(0,27)
  } else if (disease === "Anxiety") {
    tests["GAD-7"] = randInt(0,21)
  } else if (disease === "Stroke") {
    tests.NIHSS = randInt(0,42)
  } else if (disease === "Epilepsy") {
    tests.EEG = Math.random() > 0.5 ? "abnormal" : "normal"
  }
  const planPool = ["CBT","SSRIs","rehabilitation","physiotherapy","supportive care","lifestyle changes"]
  const treatment_plan = pick(planPool, randInt(1,3))
  return { id, age, gender, diagnosis: disease, symptoms, test_results: tests, treatment_plan, narrative: "" }
}

async function enrich(record: any) {
  const key = process.env.GPT5_API_KEY
  if (!key) return { ...record, narrative: `Synthetic note for ${record.diagnosis} — no key configured.` }

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-5',
      temperature: 0.7,
      messages: [
        { role: 'system', content: 'You are a clinical AI that writes concise, neutral medical notes (3-5 sentences). No PII.' },
        { role: 'user', content: `Create a medical note for this synthetic patient: ${JSON.stringify(record)}` }
      ]
    })
  })
  if (!resp.ok) return { ...record, narrative: 'Synthetic note.' }
  const data = await resp.json()
  const narrative = data?.choices?.[0]?.message?.content?.trim() || 'Synthetic note.'
  return { ...record, narrative }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { disease_type, num_records } = req.body || {}
  const disease = DISEASES.includes(disease_type) ? disease_type : DISEASES[0]
  const n = Math.max(Number(num_records) || 10, 1)

  const raw = Array.from({ length: n }, () => randomRecord(disease))
  const records = await Promise.all(raw.map(enrich))

  const keys = Array.from(new Set(records.flatMap(r => Object.keys(r.test_results))))
  const header = ['id','age','gender','diagnosis', ...keys.map(k=>`test_${k}`), 'symptoms','treatment_plan','narrative']
  const rows = [header.join(',')].concat(records.map(r => {
    const testCols = keys.map(k => String(r.test_results[k] ?? ''))
    return [
      r.id, r.age, r.gender, r.diagnosis,
      ...testCols,
      `"${r.symptoms.join('; ')}"`,
      `"${r.treatment_plan.join('; ')}"`,
      `"${(r.narrative||'').replace(/"/g,'""')}"`
    ].join(',')
  }))
  const csv = Buffer.from(rows.join('\n')).toString('base64')

  return res.status(200).json({ disease_type: disease, records, csv_base64: csv, filename: `neurosynth_${disease.replace(/\s+/g,'_').toLowerCase()}_${n}.csv` })
}


