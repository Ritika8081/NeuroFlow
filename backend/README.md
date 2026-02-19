# NeuroFlow Lab Backend

## Run FastAPI server

Activate your Python environment and run:

```
cd backend
uvicorn main:app --reload
```

Server runs at `http://localhost:8000`.

## Setup

Create a virtual environment and install dependencies:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Endpoints

- `GET /health` — Health check
- `POST /upload` — EEG file upload (.edf, .csv, .mat)
- `POST /parse` — Parse uploaded EEG (body: `{ "tmp_path": "..." }`)
- `POST /clean` — Clean EEG with filters (bandpass, notch, etc.)
- `GET /datasets/physionet/info` — PhysioNet EEG Motor Movement/Imagery dataset info
- `POST /datasets/physionet/load` — Load PhysioNet data (body: `{ "subject": 1, "runs": [4,8,12] }`)
- `POST /bandpower` — Compute frequency band power from EEG data

## PhysioNet Dataset

The [EEG Motor Movement/Imagery](https://physionet.org/content/eegmmidb/1.0.0/) dataset is loaded via MNE. On first request, data is downloaded to `~/mne_data` (or `MNE_DATASETS_EEGBCI_PATH`).
