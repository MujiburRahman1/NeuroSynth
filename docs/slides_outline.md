# NeuroGen — Slide Outline (with speaker notes)

## 1) Title
- NeuroGen: Synthetic Data Dashboard
- Tagline: Detect • Connect • Personalize
- Screenshot + logo; hackathon, team, date
Notes: One‑liner: "Privacy‑safe synthetic neurology data in seconds."

## 2) The Problem
- Patient data is scarce, sensitive, and slow to access
- Research needs large, structured datasets now
- Privacy/compliance bottlenecks experimentation
Notes: Set urgency and context.

## 3) Our Solution
- Generate realistic, structured neurology datasets on demand
- Built‑in Insights and CSV export
- Educational Self‑Assessment for early signals
Notes: Safety + usefulness.

## 4) Live Demo (What you can do)
- Choose disease & record count → Generate
- Per‑record Risk + narrative
- Insights: Age, Symptoms, Risk
- Self‑Assessment (educational)
- Disease Guide + Quick Generate
Notes: Keep demo fast and visual.

## 5) Detect (Early detection)
- Risk badge (Low/Moderate/High) at record level
- Risk Distribution for cohort triage
- Self‑Assessment runs on‑device (no PHI)
Notes: Not medical advice.

## 6) Connect (Collaboration)
- Share Link (stateful URL)
- Copy Summary button
- Local Run History
Notes: Designed for teams.

## 7) Personalize (Guided exploration)
- Disease Guide with overview, tests, resources
- Quick Generate presets (100/1k/10k)
- Narratives add human‑readable context
Notes: Smooth researcher workflow.

## 8) Architecture
- React + Vite + TS + Tailwind + Recharts
- Serverless API `/api/generate` + local fallback
- Netlify/Vercel deploy; SPA + function routing
- CSV export; URL‑synced state
Notes: Modern, fast, deployable.

## 9) Privacy & Safety
- Synthetic data only; no real PHI
- Self‑Assessment = educational disclaimer
- Optional narrative enrichment; safe fallback
Notes: Address ethics/compliance.

## 10) Scalability & Roadmap
- Pagination/virtualization for 100k+ rows
- Batched generation & progress
- FHIR/HL7 export; differential privacy toggle
- Lightweight on‑device model for risk scoring
Notes: Clear growth path.

## 11) Impact & Use Cases
- Accelerate AI prototyping and benchmarking
- Education/training datasets
- Simulate cohorts for treatment algorithms
- Shareable demos for stakeholders
Notes: Tie to Detect/Connect/Personalize.

## 12) Call to Action
- Try the demo • Share feedback • Pilot partners
- QR link / URL
Notes: Close with energy and a clear ask.


