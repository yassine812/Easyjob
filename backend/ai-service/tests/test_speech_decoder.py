"""Decode through the real speech dependency, independent of model inference."""
import wave
import numpy as np
from faster_whisper.audio import decode_audio


def test_whisper_decoder_accepts_real_audio_without_pyav_api_errors(tmp_path):
    sample_rate = 16000
    samples = (np.sin(np.arange(3200) * 2 * np.pi * 440 / sample_rate) * 12000).astype('<i2')
    audio = tmp_path / 'synthetic-tone.wav'
    with wave.open(str(audio), 'wb') as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(sample_rate)
        output.writeframes(samples.tobytes())
    decoded = decode_audio(str(audio), sampling_rate=sample_rate)
    assert len(decoded) == len(samples)
    assert decoded.dtype == np.float32
    np.testing.assert_allclose(decoded, samples.astype(np.float32) / 32768.0)
