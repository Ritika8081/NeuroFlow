"""
Test all filter dropdown/preset combinations from the UI.
Run: cd backend && python test_filter_combinations.py
"""
import numpy as np
from fastapi.testclient import TestClient
from main import app

# Mirror UI filter presets
FILTER_PRESETS = {
    "research": {"bandpass_low": 1, "bandpass_high": 45, "highpass_freq": 0.5, "lowpass_freq": 45, "notch_freq": 50},
    "clinical": {"bandpass_low": 0.5, "bandpass_high": 50, "highpass_freq": 0.1, "lowpass_freq": 70, "notch_freq": 50},
    "neurofeedback": {"bandpass_low": 4, "bandpass_high": 30, "highpass_freq": 2, "lowpass_freq": 30, "notch_freq": 50},
    "sleep": {"bandpass_low": 0.1, "bandpass_high": 30, "highpass_freq": 0.1, "lowpass_freq": 30, "notch_freq": 50},
    "teaching": {"bandpass_low": 1, "bandpass_high": 45, "highpass_freq": 0.5, "lowpass_freq": 45, "notch_freq": 50},
}
NOTCH_OPTIONS = [50, 60]


def make_payload(filters, fs=160, n_samples=3000):
    t = np.arange(n_samples) / fs
    sig = np.sin(2 * np.pi * 10 * t) + 0.3 * np.sin(2 * np.pi * 50 * t)
    data = [sig.tolist(), (sig * 0.9).tolist()]
    base = {
        "channels": 2,
        "sampling_rate": fs,
        "channel_names": ["Ch1", "Ch2"],
        "duration_sec": n_samples // fs,
        "data": data,
    }
    for k, v in filters.items():
        base[k] = v  # include even None to disable filters
    return base


def run_all_combinations():
    client = TestClient(app)
    results = []

    # 1. All 5 presets × 2 notch = 10
    for preset_name, preset in FILTER_PRESETS.items():
        for notch in NOTCH_OPTIONS:
            filters = {**preset, "notch_freq": notch}
            payload = make_payload(filters)
            r = client.post("/clean", json=payload)
            status = "PASS" if r.status_code == 200 else "FAIL"
            err = r.json().get("error", r.text[:80]) if r.status_code != 200 else ""
            cleaned_valid = False
            if r.status_code == 200:
                out = r.json()
                c = np.array(out.get("cleaned_data", []))
                cleaned_valid = c.size > 0 and not np.any(np.isnan(c)) and not np.any(np.isinf(c))
            results.append((f"{preset_name} + notch {notch}Hz", status, r.status_code, err, cleaned_valid))

    # 2. Edge: notch only (no bandpass/highpass/lowpass)
    for notch in NOTCH_OPTIONS:
        payload = make_payload({"notch_freq": notch})
        r = client.post("/clean", json=payload)
        status = "PASS" if r.status_code == 200 else "FAIL"
        err = r.json().get("error", "") if r.status_code != 200 else ""
        cleaned_valid = r.status_code == 200 and "cleaned_data" in r.json()
        results.append((f"notch-only {notch}Hz", status, r.status_code, err, cleaned_valid))

    # 3. Bandpass only
    payload = make_payload({"bandpass_low": 4, "bandpass_high": 45, "notch_freq": None})
    r = client.post("/clean", json=payload)
    results.append(("bandpass-only 4-45Hz", "PASS" if r.status_code == 200 else "FAIL", r.status_code, r.json().get("error", ""), r.status_code == 200))

    # 4. All filters disabled (only baseline)
    payload = make_payload({"bandpass_low": None, "bandpass_high": None, "highpass_freq": None, "lowpass_freq": None, "notch_freq": None})
    r = client.post("/clean", json=payload)
    results.append(("baseline-only (no filters)", "PASS" if r.status_code == 200 else "FAIL", r.status_code, r.json().get("error", ""), r.status_code == 200))

    return results


if __name__ == "__main__":
    print("Testing all filter dropdown combinations...\n")
    results = run_all_combinations()
    passed = sum(1 for _, s, _, _, _ in results if s == "PASS")
    failed = sum(1 for _, s, _, _, _ in results if s == "FAIL")
    for name, status, code, err, valid in results:
        mark = "✓" if status == "PASS" and valid else "✗"
        extra = f" ({err[:50]}...)" if err else ""
        print(f"  {mark} {name}: {status} [{code}]{extra}")
    print(f"\n{'='*55}")
    print(f"Passed: {passed} / {len(results)}")
    if failed:
        print(f"Failed: {failed}")
    else:
        print("All combinations OK.")
