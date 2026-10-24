#!/usr/bin/env python3
"""Compose the original AI or Real kiosk score with deterministic local synthesis.

Requires Python 3 and NumPy. SoundFile is preferred for Vorbis encoding; FFmpeg
is a fallback. No samples, downloads, learned music model, or
copyrighted recordings are used. Every oscillator, note, envelope, and rhythm
is defined below. Run from any directory; outputs are relative to this project.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import shutil
import subprocess
import wave

import numpy as np

SAMPLE_RATE = 44100
BPM = 90
BARS = 16
BEATS_PER_BAR = 4
SEED = 24012026
TARGET_RMS_DBFS = -20.5
PEAK_CEILING_DBFS = -1.2
# D minor 9 -> B-flat major 9 -> F major 9 -> C add9. Four bars per chord.
PAD_CHORDS = (
    (50, 53, 57, 60, 64),
    (46, 53, 57, 60, 62),
    (48, 53, 57, 60, 64),
    (48, 55, 60, 62, 64),
)
BASS_ROOTS = (38, 34, 29, 36)
ARP_PATTERNS = (
    (0, 2, 4, 2, 1, 3, 4, 2),
    (0, 2, 3, 2, 1, 2, 4, 3),
    (0, 2, 4, 3, 1, 3, 4, 2),
    (0, 3, 4, 2, 1, 3, 4, 3),
)


def db(value: float) -> float:
    return 20 * math.log10(max(float(value), 1e-15))


def frequency(midi: float) -> float:
    return 440 * 2 ** ((midi - 69) / 12)


def gentle_spectrum(signal: np.ndarray, cutoff: float) -> np.ndarray:
    """A smooth low-pass used only for locally synthesized noise."""
    bins = np.fft.rfftfreq(len(signal), 1 / SAMPLE_RATE)
    response = np.exp(-0.5 * (bins / cutoff) ** 2)
    return np.fft.irfft(np.fft.rfft(signal) * response, n=len(signal))


def compose() -> np.ndarray:
    beat = 60 / BPM
    length = int(round(BARS * BEATS_PER_BAR * beat * SAMPLE_RATE))
    duration = length / SAMPLE_RATE
    rng = np.random.default_rng(SEED)
    bus = np.zeros((length, 2), dtype=np.float64)

    def add(signal: np.ndarray, start_beat: float, gain: float, pan: float = 0) -> None:
        # All note tails wrap at the loop boundary, including ambience and drums.
        # Equal-power pan avoids large changes in perceived note loudness.
        position = int(round(start_beat * beat * SAMPLE_RATE)) % length
        left = math.cos((pan + 1) * math.pi / 4) * gain
        right = math.sin((pan + 1) * math.pi / 4) * gain
        stereo = signal[:, None] * np.array([left, right])[None, :]
        first = min(len(signal), length - position)
        bus[position:position + first] += stereo[:first]
        if first < len(signal):
            bus[:len(signal) - first] += stereo[first:]

    # Slow, soft pads have rounded attacks and releases rather than an overall
    # fade-in/out. The last chord's release carries through the start of the loop.
    for chord_index, notes in enumerate(PAD_CHORDS):
        start = chord_index * 16
        sustain_beats = 16
        release_beats = 3
        n = int(round((sustain_beats + release_beats) * beat * SAMPLE_RATE))
        t = np.arange(n) / SAMPLE_RATE
        attack = np.sin(np.minimum(t / (2.5 * beat), 1) * np.pi / 2) ** 2
        release = np.ones(n)
        release_at = sustain_beats * beat
        tail = t >= release_at
        release[tail] = np.cos(np.minimum((t[tail] - release_at) / (release_beats * beat), 1) * np.pi / 2) ** 2
        envelope = attack * release
        for voice, note in enumerate(notes):
            f = frequency(note)
            phase = rng.uniform(0, 2 * np.pi)
            # Sine-led blend with very faint second/third harmonics and detuning.
            sound = (
                0.72 * np.sin(2 * np.pi * f * t + phase)
                + 0.18 * np.sin(2 * np.pi * f * 1.0012 * t + phase + 0.21)
                + 0.075 * np.sin(2 * np.pi * f * 2 * t + phase * 0.7)
                + 0.025 * np.sin(2 * np.pi * f * 3 * t + phase * 0.4)
            )
            motion = 0.91 + 0.09 * np.sin(2 * np.pi * t / (8 * beat) + voice * 0.8)
            add(sound * envelope * motion, start, 0.060, (voice - 2) * 0.24)

    # A restrained eight-note motif, with a small answer phrase in every fourth
    # bar. Frequencies stay low enough to remain comfortable on kiosk speakers.
    for bar in range(BARS):
        chord_index = bar // 4
        notes = PAD_CHORDS[chord_index]
        pattern = ARP_PATTERNS[bar % 4]
        for step, degree in enumerate(pattern):
            if step in (3, 7) and bar % 2 == 0:
                continue
            start = bar * 4 + step * 0.5
            note = notes[degree] + 12
            n = int(round(1.45 * beat * SAMPLE_RATE))
            t = np.arange(n) / SAMPLE_RATE
            f = frequency(note)
            attack = 1 - np.exp(-t / 0.013)
            end = np.maximum(0, 1 - t / t[-1]) ** 2
            envelope = attack * np.exp(-t / 0.30) * end
            sound = np.sin(2 * np.pi * f * t) + 0.13 * np.sin(2 * np.pi * f * 2 * t)
            velocity = 0.70 if step % 2 else 1.0
            add(sound * envelope, start, 0.043 * velocity, 0.28 * math.sin(step * 1.7 + bar))

    # Warm sine bass, a sparse soft kick, and quiet brushed percussion leave
    # space for game feedback sounds and conversation around the touchscreen.
    for bar in range(BARS):
        chord_index = bar // 4
        root = BASS_ROOTS[chord_index]
        for offset in (0, 2.5):
            n = int(round(1.65 * beat * SAMPLE_RATE))
            t = np.arange(n) / SAMPLE_RATE
            f = frequency(root)
            envelope = (1 - np.exp(-t / 0.018)) * np.exp(-t / 0.65) * np.sin(np.pi * (1 - t / t[-1]) / 2) ** 2
            bass = np.sin(2 * np.pi * f * t) + 0.12 * np.sin(4 * np.pi * f * t)
            add(bass * envelope, bar * 4 + offset, 0.13 if offset == 0 else 0.085)
        for offset in (0, 2):
            n = int(0.39 * SAMPLE_RATE)
            t = np.arange(n) / SAMPLE_RATE
            f = 49 + 38 * np.exp(-t / 0.023)
            phase = 2 * np.pi * np.cumsum(f) / SAMPLE_RATE
            envelope = (1 - np.exp(-t / 0.004)) * np.exp(-t / 0.087) * (1 - t / t[-1]) ** 2
            add(np.sin(phase) * envelope, bar * 4 + offset, 0.14)
        for eighth in range(8):
            n = int(0.13 * SAMPLE_RATE)
            t = np.arange(n) / SAMPLE_RATE
            noise = rng.standard_normal(n)
            # A band-limited, brushed shaker avoids sharp white-noise hats.
            noise = gentle_spectrum(noise, 4300) - gentle_spectrum(noise, 1500)
            noise /= max(np.std(noise), 1e-10)
            envelope = (1 - np.exp(-t / 0.003)) * np.exp(-t / 0.020) * (1 - t / t[-1]) ** 2
            gain = 0.008 if eighth % 2 == 0 else 0.014
            add(noise * envelope, bar * 4 + eighth * 0.5 + 0.013, gain, (-1) ** eighth * 0.25)
        for offset in (1, 3):
            n = int(0.19 * SAMPLE_RATE)
            t = np.arange(n) / SAMPLE_RATE
            brushed = gentle_spectrum(rng.standard_normal(n), 2200)
            brushed /= max(np.std(brushed), 1e-10)
            envelope = (1 - np.exp(-t / 0.005)) * np.exp(-t / 0.035) * (1 - t / t[-1]) ** 2
            add(brushed * envelope, bar * 4 + offset, 0.013, 0.1)

    # Circular stereo ambience keeps its tails at the exact loop boundary.
    dry = bus.copy()
    for delay_beats, amount, swap in ((0.75, 0.16, True), (1.5, 0.095, False), (3, 0.052, True)):
        delay = int(round(delay_beats * beat * SAMPLE_RATE))
        reflected = np.roll(dry, delay, axis=0)
        if swap:
            reflected = reflected[:, ::-1]
        bus += amount * reflected
    # Low-frequency and high-frequency roll-offs are circular, so they cannot
    # create a fresh discontinuity at the beginning or end of the buffer.
    bins = np.fft.rfftfreq(length, 1 / SAMPLE_RATE)
    response = (1 - np.exp(-(bins / 24) ** 4)) * np.exp(-0.5 * (bins / 8600) ** 4)
    bus = np.fft.irfft(np.fft.rfft(bus, axis=0) * response[:, None], n=length, axis=0)
    bus -= np.mean(bus, axis=0)
    bus = np.tanh(bus * 1.18) / 1.18
    rms = np.sqrt(np.mean(bus ** 2))
    gain = min(10 ** (TARGET_RMS_DBFS / 20) / rms, 10 ** (PEAK_CEILING_DBFS / 20) / np.max(np.abs(bus)))
    bus *= gain
    print(json.dumps({
        'title': 'Neon Common Ground', 'tempoBpm': BPM, 'bars': BARS,
        'durationSeconds': duration, 'sampleRate': SAMPLE_RATE, 'channels': 2,
        'rmsDbfs': round(db(np.sqrt(np.mean(bus ** 2))), 3),
        'peakDbfs': round(db(np.max(np.abs(bus))), 3),
        'seamStepLinear': [float(v) for v in np.abs(bus[0] - bus[-1])],
        'seamStepDbfs': [round(db(v), 3) for v in np.abs(bus[0] - bus[-1])],
        'typicalAdjacentStepRms': float(np.sqrt(np.mean(np.diff(bus, axis=0) ** 2))),
        'dcOffset': [float(v) for v in np.mean(bus, axis=0)],
        'seed': SEED,
    }, indent=2))
    return bus


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ffmpeg', default=shutil.which('ffmpeg') or '/opt/homebrew/bin/ffmpeg')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    wav_path = root / 'outputs/media/music-loop.wav'
    ogg_path = root / 'public/media/music-loop.ogg'
    wav_path.parent.mkdir(parents=True, exist_ok=True)
    ogg_path.parent.mkdir(parents=True, exist_ok=True)
    audio = compose()
    # A 24-bit PCM master avoids audible quantization noise at quiet playback.
    pcm = np.rint(np.clip(audio, -1, 1) * 8388607).astype('<i4')
    packed = pcm.reshape(-1).view(np.uint8).reshape(-1, 4)[:, :3].tobytes()
    with wave.open(str(wav_path), 'wb') as out:
        out.setnchannels(2)
        out.setsampwidth(3)
        out.setframerate(SAMPLE_RATE)
        out.writeframes(packed)
    try:
        import soundfile as sf
    except ImportError:
        sf = None
    if sf is not None:
        sf.write(str(ogg_path), audio, SAMPLE_RATE, format='OGG', subtype='VORBIS', compression_level=0.35)
        print('Encoder: libsndfile / reference Vorbis')
    else:
        encoders = subprocess.check_output([args.ffmpeg, '-hide_banner', '-encoders'], text=True, stderr=subprocess.DEVNULL)
        codec = ['-c:a', 'libvorbis', '-q:a', '5'] if 'libvorbis' in encoders else ['-c:a', 'vorbis', '-strict', 'experimental', '-q:a', '5']
        subprocess.run([
            args.ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(wav_path),
            *codec,
            '-metadata', 'title=Neon Common Ground',
            '-metadata', 'artist=Original AI or Real application score',
            '-metadata', 'comment=Original deterministic synthesis; no sampled or third-party audio.',
            str(ogg_path),
        ], check=True)
    decoded = np.frombuffer(subprocess.check_output([
        args.ffmpeg, '-v', 'error', '-i', str(ogg_path), '-f', 'f32le', '-acodec', 'pcm_f32le', '-'
    ]), dtype='<f4').reshape(-1, 2)
    print(json.dumps({
        'decodedFrames': len(decoded),
        'decodedRmsDbfs': round(db(np.sqrt(np.mean(decoded ** 2))), 3),
        'decodedPeakDbfs': round(db(np.max(np.abs(decoded))), 3),
        'decodedSeamStepLinear': [float(v) for v in np.abs(decoded[0] - decoded[-1])],
        'decodedSeamStepDbfs': [round(db(v), 3) for v in np.abs(decoded[0] - decoded[-1])],
        'decodedTypicalAdjacentStepRms': float(np.sqrt(np.mean(np.diff(decoded, axis=0) ** 2))),
    }, indent=2))
    print(f'WAV master: {wav_path} ({wav_path.stat().st_size:,} bytes)')
    print(f'Vorbis loop: {ogg_path} ({ogg_path.stat().st_size:,} bytes)')


if __name__ == '__main__':
    main()
