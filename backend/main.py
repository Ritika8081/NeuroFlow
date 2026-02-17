
from fastapi import FastAPI, UploadFile, File, HTTPException, Body
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import tempfile
import mne
import numpy as np
import scipy.io
from scipy.signal import butter, filtfilt, iirnotch

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- FastAPI Endpoints ---
@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/upload")
async def upload_eeg(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".edf", ".csv", ".mat"]:
        raise HTTPException(status_code=400, detail="Unsupported file format")
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    return {"filename": file.filename, "tmp_path": tmp_path}

@app.post("/parse")
async def parse_eeg(payload: dict = Body(...)):
    tmp_path = payload.get("tmp_path")
    if not tmp_path:
        raise HTTPException(status_code=400, detail="Missing tmp_path")
    ext = os.path.splitext(tmp_path)[1].lower()
    try:
        if ext == ".edf":
            raw = mne.io.read_raw_edf(tmp_path, preload=True)
            data = raw.get_data()
            channels = raw.info['nchan']
            sampling_rate = int(raw.info['sfreq'])
            duration_sec = int(raw.times[-1])
            channel_names = raw.ch_names
        elif ext == ".csv":
            arr = np.loadtxt(tmp_path, delimiter=',')
            channels = arr.shape[0]
            samples = arr.shape[1]
            sampling_rate = 256  # Assume default, update as needed
            duration_sec = samples // sampling_rate
            channel_names = [f"Ch{i+1}" for i in range(channels)]
            data = arr
        elif ext == ".mat":
            mat = scipy.io.loadmat(tmp_path)
            arr = mat.get('data')
            if arr is None:
                raise Exception("No 'data' key in .mat file")
            channels = arr.shape[0]
            samples = arr.shape[1]
            sampling_rate = 256  # Assume default, update as needed
            duration_sec = samples // sampling_rate
            channel_names = [f"Ch{i+1}" for i in range(channels)]
            data = arr
        else:
            raise Exception("Unsupported file format")
        preview = data[:, :min(10, data.shape[1])].tolist()
        return JSONResponse(content={
            "channels": channels,
            "sampling_rate": sampling_rate,
            "duration_sec": duration_sec,
            "data_shape": [channels, data.shape[1]],
            "channel_names": channel_names,
            "preview": preview,
            "data": data.tolist()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def bandpass_filter(data, lowcut, highcut, fs, order=4):
    nyq = 0.5 * fs
    low = lowcut / nyq
    high = highcut / nyq
    b, a = butter(order, [low, high], btype='band')
    padlen = 3 * max(len(a), len(b))
    if data.shape[1] <= padlen:
        return data
    return filtfilt(b, a, data, axis=1)

def lowpass_filter(data, cutoff, fs, order=4):
    nyq = 0.5 * fs
    normal_cutoff = cutoff / nyq
    b, a = butter(order, normal_cutoff, btype='low')
    padlen = 3 * max(len(a), len(b))
    if data.shape[1] <= padlen:
        return data
    return filtfilt(b, a, data, axis=1)

def highpass_filter(data, cutoff, fs, order=4):
    nyq = 0.5 * fs
    normal_cutoff = cutoff / nyq
    b, a = butter(order, normal_cutoff, btype='high')
    padlen = 3 * max(len(a), len(b))
    if data.shape[1] <= padlen:
        return data
    return filtfilt(b, a, data, axis=1)

def notch_filter(data, notch_freq, fs, quality=30):
    nyq = 0.5 * fs
    freq = notch_freq / nyq
    b, a = iirnotch(freq, quality)
    padlen = 3 * max(len(a), len(b))
    if data.shape[1] <= padlen:
        return data
    return filtfilt(b, a, data, axis=1)

def baseline_correction(data):
    return data - np.mean(data, axis=1, keepdims=True)

def clean_eeg(
    data,
    fs,
    bandpass_low=None,
    bandpass_high=None,
    lowpass_freq=None,
    highpass_freq=None,
    notch_freq=50
):
    filtered = data.copy()
    # Bandpass
    if bandpass_low is not None and bandpass_high is not None:
        filtered = bandpass_filter(filtered, bandpass_low, bandpass_high, fs)
    # Highpass
    if highpass_freq is not None:
        filtered = highpass_filter(filtered, highpass_freq, fs)
    # Lowpass
    if lowpass_freq is not None:
        filtered = lowpass_filter(filtered, lowpass_freq, fs)
    # Notch (always apply)
    if notch_freq is not None:
        filtered = notch_filter(filtered, notch_freq, fs)
    # Baseline correction (always apply)
    filtered = baseline_correction(filtered)
    return filtered


@app.post("/clean")
async def clean_eeg_endpoint(payload: dict = Body(...)):
    """
    Clean EEG signal with bandpass, lowpass, highpass, notch, and baseline correction.
    Accepts parsed JSON from /parse or similar structure, or file path.
    Returns cleaned EEG JSON.
    """
    try:
        # Accepts either a tmp_path (file) or direct data
        if 'tmp_path' in payload:
            # Reuse parse logic
            parse_resp = await parse_eeg(payload)
            parsed = parse_resp.body if hasattr(parse_resp, 'body') else parse_resp
            if isinstance(parsed, bytes):
                import json
                parsed = json.loads(parsed.decode())
        else:
            parsed = payload
        import sys
        print("[DEBUG] Received payload:", payload, file=sys.stderr)
        print("[DEBUG] Parsed object:", parsed, file=sys.stderr)
        data = np.array(parsed.get('preview') or parsed.get('data') or parsed.get('cleaned_data'))
        print("[DEBUG] Data shape before reshape:", data.shape, file=sys.stderr)
        # Ensure data is 2D (channels x samples)
        if data.ndim == 1:
            data = data.reshape(1, -1)
            print("[DEBUG] Data reshaped to:", data.shape, file=sys.stderr)
        elif data.ndim != 2:
            print("[DEBUG] Invalid data shape:", data.shape, file=sys.stderr)
            return JSONResponse(status_code=400, content={"error": f"Input data must be 2D (channels x samples), got shape {data.shape}"})
        fs = int(parsed.get('sampling_rate', 256))
        channels = int(parsed.get('channels', data.shape[0]))
        channel_names = parsed.get('channel_names', [f"Ch{i+1}" for i in range(channels)])
        duration_sec = int(parsed.get('duration_sec', data.shape[1] // fs))

        # Get filter params from body
        bandpass_low = payload.get('bandpass_low')
        bandpass_high = payload.get('bandpass_high')
        lowpass_freq = payload.get('lowpass_freq')
        highpass_freq = payload.get('highpass_freq')
        notch_freq = payload.get('notch_freq', 50)

        warnings = []
        # Check if filtering will be skipped due to short data
        padlen = 27  # Conservative default for 4th order Butterworth
        if data.shape[1] <= padlen:
            warnings.append(f"Filtering skipped: data length ({data.shape[1]}) <= padlen ({padlen})")
        cleaned = clean_eeg(
            data,
            fs,
            bandpass_low=bandpass_low,
            bandpass_high=bandpass_high,
            lowpass_freq=lowpass_freq,
            highpass_freq=highpass_freq,
            notch_freq=notch_freq
        )
        response = {
            "channels": channels,
            "sampling_rate": fs,
            "duration_sec": duration_sec,
            "data_shape": [channels, data.shape[1]],
            "channel_names": channel_names,
            "cleaned_data": cleaned.tolist()
        }
        if warnings:
            response["warnings"] = warnings
        return JSONResponse(content=response)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
