"""
API integration test for /clean endpoint.
Run with backend server: uvicorn main:app --reload
Then: cd backend && python test_api.py
Or run via TestClient (no server needed):
  python -c "from test_api import run_tests; run_tests()"
"""
import numpy as np


def run_tests_via_testclient():
    """Run tests using FastAPI TestClient (no live server)."""
    from fastapi.testclient import TestClient
    from main import app
    client = TestClient(app)

    fs = 160
    n_samples = 2000
    t = np.arange(n_samples) / fs
    # Signal: 10 Hz + 50 Hz (noise)
    sig = np.sin(2 * np.pi * 10 * t) + 0.5 * np.sin(2 * np.pi * 50 * t)
    data = [sig.tolist(), (sig * 0.8).tolist()]  # 2 channels

    payload = {
        "channels": 2,
        "sampling_rate": fs,
        "channel_names": ["Ch1", "Ch2"],
        "duration_sec": n_samples // fs,
        "data": data,
        "bandpass_low": 4,
        "bandpass_high": 45,
        "notch_freq": 50,
    }

    r = client.post("/clean", json=payload)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    out = r.json()
    assert "cleaned_data" in out
    cleaned = np.array(out["cleaned_data"])
    assert cleaned.shape == (2, n_samples)
    assert not np.any(np.isnan(cleaned))
    assert not np.any(np.isinf(cleaned))
    assert np.abs(np.mean(cleaned)) < 0.5
    print("✓ /clean API: 200 OK, valid cleaned data")

    # Test with only notch (no bandpass)
    payload2 = {**payload, "bandpass_low": None, "bandpass_high": None}
    r2 = client.post("/clean", json=payload2)
    assert r2.status_code == 200
    print("✓ /clean API: works with notch-only")

    # Test health
    r3 = client.get("/health")
    assert r3.status_code == 200 and r3.json().get("status") == "ok"
    print("✓ /health OK")


if __name__ == "__main__":
    run_tests_via_testclient()
    print("\nAll API tests passed.")
