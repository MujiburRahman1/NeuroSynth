export type LocalRecord = {
  id: string
  age: number
  gender: string
  diagnosis: string
  symptoms: string[]
  test_results: Record<string, any>
  treatment_plan: string[]
  narrative: string
}

export const DISEASES = [
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

export function synthesizeOne(disease: string): LocalRecord {
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
  const narrative = `Synthetic record: ${age}yo ${gender} with ${symptoms.join(', ')} consistent with ${disease}.`
  return { id, age, gender, diagnosis: disease, symptoms, test_results: tests, treatment_plan, narrative }
}

export function synthesizeBatch(disease: string, n: number) {
  const records = Array.from({ length: n }, () => synthesizeOne(disease))
  const keys = Array.from(new Set(records.flatMap(r => Object.keys(r.test_results))))
  const header = ['id','age','gender','diagnosis',...keys.map(k=>`test_${k}`),'symptoms','treatment_plan','narrative']
  const rows = [header.join(',')].concat(records.map(r => {
    const testCols = keys.map(k => String(r.test_results[k] ?? ''))
    return [
      r.id, r.age, r.gender, r.diagnosis,
      ...testCols,
      `"${r.symptoms.join('; ')}"`,
      `"${r.treatment_plan.join('; ')}"`,
      `"${r.narrative.replace(/"/g,'""')}"`
    ].join(',')
  }))
  const csv_base64 = btoa(rows.join('\n'))
  const filename = `neurosynth_${disease.replace(/\s+/g,'_').toLowerCase()}_${n}.csv`
  return { records, csv_base64, filename }
}
