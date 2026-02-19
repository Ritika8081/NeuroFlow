"""
Test script to verify EEG filters work correctly.
Run: cd backend && python test_filters.py
"""
import numpy as np
from scipy.fft import fft, fftfreq
from scipy.signal import periodogram

# Import backend filter functions
from main import (
    bandpass_filter,
    highpass_filter,
    lowpass_filter,
    notch_filter,
    baseline_correction,
    clean_eeg,
)


def power_at_freq(signal, fs, target_freq, bandwidth=1.0):
    """Return power around target_freq (Hz)."""
    n = len(signal)
    Y = np.abs(fft(signal, n=min(4096, n))) ** 2
    freqs = fftfreq(min(4096, n), 1 / fs)
    mask = (np.abs(freqs - target_freq) <= bandwidth) | (np.abs(freqs + target_freq) <= bandwidth)
    return np.mean(Y[mask])


def total_power(signal):
    """Total power (variance) of signal."""
    return np.var(signal)


def create_test_signal(fs=160, duration=2.0, freqs_amps=None):
    """Create multi-tone test signal. freqs_amps: [(freq_hz, amplitude), ...]"""
    if freqs_amps is None:
        freqs_amps = [(10, 1.0), (50, 0.5), (25, 0.3)]
    n = int(fs * duration)
    t = np.arange(n) / fs
    sig = np.zeros(n)
    for f, a in freqs_amps:
        sig += a * np.sin(2 * np.pi * f * t)
    return sig.reshape(1, -1)


def test_baseline_correction():
    """Baseline correction should zero the mean per channel."""
    data = create_test_signal(freqs_amps=[(5, 10.0)])  # DC offset sim via bias
    data = data + 50  # Add DC offset
    corrected = baseline_correction(data)
    mean_per_ch = np.mean(corrected, axis=1)
    assert np.allclose(mean_per_ch, 0, atol=1e-10), f"Mean should be 0, got {mean_per_ch}"
    print("✓ Baseline correction: mean = 0 per channel")


def test_highpass_filter():
    """Highpass should attenuate low frequencies."""
    fs = 256
    data = create_test_signal(fs=fs, freqs_amps=[(0.5, 1.0), (20, 1.0)])
    filtered = highpass_filter(data, cutoff=2, fs=fs)
    p_low_raw = power_at_freq(data[0], fs, 0.5)
    p_low_filt = power_at_freq(filtered[0], fs, 0.5)
    p_high_filt = power_at_freq(filtered[0], fs, 20)
    atten_low = p_low_filt / (p_low_raw + 1e-12)
    assert atten_low < 0.2, f"Low freq should be attenuated, got ratio {atten_low}"
    assert p_high_filt > 0.1 * total_power(filtered[0]), "High freq should remain"
    print(f"✓ Highpass (2 Hz): low-freq attenuation ratio = {atten_low:.4f}")


def test_lowpass_filter():
    """Lowpass should attenuate high frequencies."""
    fs = 256
    data = create_test_signal(fs=fs, freqs_amps=[(10, 1.0), (60, 1.0)])
    filtered = lowpass_filter(data, cutoff=30, fs=fs)
    p_high_raw = power_at_freq(data[0], fs, 60)
    p_high_filt = power_at_freq(filtered[0], fs, 60)
    p_low_filt = power_at_freq(filtered[0], fs, 10)
    atten_high = p_high_filt / (p_high_raw + 1e-12)
    assert atten_high < 0.3, f"High freq (60 Hz) should be attenuated, got ratio {atten_high}"
    assert p_low_filt > 0.1 * total_power(filtered[0]), "Low freq should remain"
    print(f"✓ Lowpass (30 Hz): high-freq (60 Hz) attenuation ratio = {atten_high:.4f}")


def test_bandpass_filter():
    """Bandpass should pass mid-band and attenuate out-of-band."""
    fs = 256
    data = create_test_signal(fs=fs, freqs_amps=[(2, 1.0), (15, 1.0), (60, 1.0)])
    filtered = bandpass_filter(data, lowcut=5, highcut=30, fs=fs)
    p_in = power_at_freq(filtered[0], fs, 15)
    p_low = power_at_freq(filtered[0], fs, 2)
    p_high = power_at_freq(filtered[0], fs, 60)
    assert p_in > 0.1 * total_power(filtered[0]), "In-band (15 Hz) should pass"
    assert p_low < 0.2 * p_in, f"Below-band (2 Hz) should be attenuated, got p_low/p_in={p_low/p_in:.4f}"
    assert p_high < 0.2 * p_in, f"Above-band (60 Hz) should be attenuated, got p_high/p_in={p_high/p_in:.4f}"
    print("✓ Bandpass (5–30 Hz): in-band passes, out-of-band attenuated")


def test_notch_filter():
    """Notch should strongly attenuate line noise (50 or 60 Hz)."""
    fs = 256
    data = create_test_signal(fs=fs, freqs_amps=[(10, 1.0), (50, 1.0)])
    filtered = notch_filter(data, notch_freq=50, fs=fs)
    p_50_raw = power_at_freq(data[0], fs, 50)
    p_50_filt = power_at_freq(filtered[0], fs, 50)
    p_10_filt = power_at_freq(filtered[0], fs, 10)
    atten_50 = p_50_filt / (p_50_raw + 1e-12)
    assert atten_50 < 0.15, f"50 Hz should be strongly attenuated, got ratio {atten_50}"
    assert p_10_filt > 0.2 * total_power(filtered[0]), "10 Hz should remain"
    print(f"✓ Notch (50 Hz): 50 Hz attenuation ratio = {atten_50:.4f}")


def test_clean_eeg_pipeline():
    """Full clean_eeg pipeline with bandpass + notch + baseline."""
    fs = 160
    data = create_test_signal(fs=fs, freqs_amps=[(1, 0.5), (15, 1.0), (50, 0.8)])
    cleaned = clean_eeg(
        data, fs,
        bandpass_low=4, bandpass_high=45,
        highpass_freq=None, lowpass_freq=None,
        notch_freq=50,
    )
    # Check mean ~ 0
    assert np.abs(np.mean(cleaned)) < 0.1, f"Mean should be ~0 after baseline, got {np.mean(cleaned)}"
    # 50 Hz should be reduced
    p_50 = power_at_freq(cleaned[0], fs, 50)
    p_15 = power_at_freq(cleaned[0], fs, 15)
    assert p_50 < 0.2 * p_15, "50 Hz should be much lower than 15 Hz after notch"
    print("✓ Full clean_eeg pipeline: bandpass + notch + baseline OK")


def test_short_data_handling():
    """Filters should handle very short data without crashing."""
    fs = 160
    data = np.random.randn(2, 20).astype(np.float64)
    for name, fn, kwargs in [
        ("bandpass", bandpass_filter, {"lowcut": 1, "highcut": 45, "fs": fs}),
        ("highpass", highpass_filter, {"cutoff": 0.5, "fs": fs}),
        ("lowpass", lowpass_filter, {"cutoff": 45, "fs": fs}),
        ("notch", notch_filter, {"notch_freq": 50, "fs": fs}),
    ]:
        out = fn(data.copy(), **kwargs)
        assert out.shape == data.shape, f"{name}: shape changed"
        assert not np.any(np.isnan(out)), f"{name}: NaNs"
        assert not np.any(np.isinf(out)), f"{name}: Infs"
    print("✓ Short data: no crash, no NaNs/Infs")


if __name__ == "__main__":
    print("Running backend filter tests...\n")
    tests = [
        test_baseline_correction,
        test_highpass_filter,
        test_lowpass_filter,
        test_bandpass_filter,
        test_notch_filter,
        test_clean_eeg_pipeline,
        test_short_data_handling,
    ]
    failed = []
    for t in tests:
        try:
            t()
        except AssertionError as e:
            print(f"✗ {t.__name__}: {e}")
            failed.append(t.__name__)
        except Exception as e:
            print(f"✗ {t.__name__}: {type(e).__name__}: {e}")
            failed.append(t.__name__)

    print("\n" + "=" * 50)
    if failed:
        print(f"FAILED: {len(failed)} test(s) - {failed}")
    else:
        print("PASSED: All filter tests succeeded.")
