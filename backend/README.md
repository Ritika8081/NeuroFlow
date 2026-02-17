# NeuroFlow Lab Backend

## Run FastAPI server

Activate your Python environment and run:

```
uvicorn main:app --reload
```

## Endpoints

- `/health` (GET): Health check
- `/upload` (POST): EEG file upload
- `/parse` (POST): EEG file parsing

## Requirements

Install dependencies:

```
pip install -r requirements.txt
```

## EEG File Formats Supported

- .edf
- .csv
- .mat

## Example Test

1. Upload EEG file via `/upload`
2. Parse EEG file via `/parse`
