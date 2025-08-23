## NeuroSynth

AI-powered synthetic medical record generator for neurological and mental health conditions. Privacy-safe GAN + GPT-5 narratives with a React dashboard.

### Stack
- Backend: FastAPI, PyTorch, Pandas, Pydantic
- ML: Simple GAN scaffold (Generator/Discriminator), post-processing to records
- LLM: GPT-5 (fallback local templating if key missing)
- Frontend: React (Vite + TS) + Tailwind + Recharts
- Deploy: Docker, Render/Heroku, Vercel/Netlify

### Run (backend)
1. Python 3.11 recommended
2. `cd backend`
3. `python -m venv .venv && .venv\\Scripts\\activate` (Windows PowerShell)
4. `pip install -r requirements.txt`
5. Set env vars (copy `.env.example` to `.env`), add `GPT5_API_KEY`
6. `python uvicorn_app.py`

API: `http://localhost:8000`
- POST `/generate` body: `{ "disease_type": "Epilepsy", "num_records": 50 }`
- GET `/stats`

### Run (frontend)
1. `cd frontend`
2. `npm i`
3. `npm run dev`

Frontend: `http://localhost:5173`

To point to a remote API, create `frontend/.env`:
```
VITE_API_BASE=https://your-backend.onrender.com
```

### Docker (backend)
```
docker build -t neurosynth-backend ./backend
ocker run --rm -p 8000:8000 --env-file backend/.env neurosynth-backend
```

### Notes
- This is a hackathon-ready scaffold. Replace `SimpleGAN.train_gan` with a real training loop plus a dataset loader that encodes categorical fields and normalizes numerics to [-1, 1].
- The generation service enriches records with GPT-5 if key is configured; otherwise uses a safe fallback string template.
- Add diseases or domain rules in `app/services/postprocess.py`.
