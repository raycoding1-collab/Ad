#!/usr/bin/env python3
"""Build the reel's whole soundtrack: an original score on one theme, the city's rain, the room's
quiet, and every paper flap and footstep of the picture (exported by tools/events.mjs). No voice.

usage: node tools/events.mjs && /home/user/tts/venv/bin/python tools/build_audio.py film/film.json
writes .cache/film.wav (for the video) and assets/audio/film.mp3
"""
import json, os, re, subprocess, sys
import numpy as np
import soundfile as sf
from scipy import signal




SR = 44100
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rs = np.random.RandomState(7)
TAU = 2 * np.pi

# ------------------------------------------------------------------ helpers --
def env_ar(n, a, r):
    e = np.ones(n); na, nr = min(n, int(a * SR)), min(n, int(r * SR))
    if na: e[:na] = np.sin(np.linspace(0, np.pi / 2, na)) ** 2
    if nr: e[-nr:] *= np.cos(np.linspace(0, np.pi / 2, nr)) ** 2
    return e

def place(buf, x, t, gain=1.0, pan=0.0):
    i = int(round(t * SR))
    if i >= buf.shape[0] or i + len(x) <= 0: return
    if i < 0: x = x[-i:]; i = 0
    x = x[: buf.shape[0] - i]
    th = (np.clip(pan, -1, 1) + 1) * np.pi / 4
    buf[i:i + len(x), 0] += x * gain * np.cos(th) * 1.414
    buf[i:i + len(x), 1] += x * gain * np.sin(th) * 1.414

def sos(kind, f, order=2): return signal.butter(order, f, kind, fs=SR, output='sos')
def bp(x, lo, hi, order=2): return signal.sosfilt(sos('bandpass', [lo, min(hi, SR / 2 - 100)], order), x)
def lp(x, f, order=2): return signal.sosfilt(sos('lowpass', f, order), x)
def hp(x, f, order=2): return signal.sosfilt(sos('highpass', f, order), x)

def slow_noise(n, rate, seed):
    r = np.random.RandomState(seed); k = max(4, int(n / SR * rate) + 4)
    return np.interp(np.linspace(0, k - 1, n), np.arange(k), r.rand(k))

def curve(n, pts):
    t = np.arange(n) / SR; ts, vs = zip(*pts)
    return np.interp(t, ts, vs)

def reverb(x, rt=2.4, wet=0.3, bright=3200, seed=3, pre=0.012):
    r = np.random.RandomState(seed); n = int(rt * 1.3 * SR)
    out = np.zeros_like(x)
    for ch in range(2):
        ir = r.randn(n) * np.exp(-6.9 * np.arange(n) / (rt * SR))
        ir[: int(pre * SR)] *= np.linspace(0, 1, int(pre * SR))
        ir = lp(ir, bright); ir /= np.sqrt((ir ** 2).sum())
        out[:, ch] = signal.fftconvolve(x[:, ch], ir)[: x.shape[0]]
    return x + out * wet

NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
def hz(name):
    m = re.match(r'([A-G]#?|Bb|Eb)(\d)', name); n = m.group(1)
    n = {'Bb': 'A#', 'Eb': 'D#'}.get(n, n)
    return 440 * 2 ** ((NAMES.index(n) - 9) / 12 + int(m.group(2)) - 4)

def tvec(dur): n = int(dur * SR); return n, np.arange(n) / SR

def vibrato(t, rate=5.0, depth=0.004, delay=0.3, seed=0):
    r = np.random.RandomState(seed)
    return 1 + depth * np.clip((t - delay) / 0.4, 0, 1) * np.sin(TAU * rate * t + r.rand() * 6) + 0.0015 * (slow_noise(len(t), 2, seed) - 0.5)

# -------------------------------------------------------------- instruments --
def flute(f, dur, vel=1.0):
    n, t = tvec(dur + 0.35)
    ph = TAU * np.cumsum(f * vibrato(t, 4.9, 0.0045, 0.25, rs.randint(1e6)) * (1 - 0.018 * np.exp(-t / 0.05))) / SR
    y = np.sin(ph) + 0.30 * np.sin(2 * ph + 0.4) + 0.09 * np.sin(3 * ph) + 0.035 * np.sin(4 * ph)
    breath = bp(rs.randn(n), f * 1.6, min(f * 6, 9000)) * 0.22
    e = env_ar(n, 0.085, 0.3) * (0.82 + 0.18 * np.exp(-t / 0.4))
    chiff = np.exp(-t / 0.03) * bp(rs.randn(n), 900, 3500) * 0.25
    return (y * 0.5 + breath * (0.6 + 0.4 * np.exp(-t / 0.2)) + chiff) * e * vel

def hum(f, dur, vel=1.0, vowel='m'):
    n, t = tvec(dur + 0.5)
    ph = TAU * np.cumsum(f * vibrato(t, 4.6, 0.006, 0.3, rs.randint(1e6))) / SR
    y = np.zeros(n)
    F = [(260, 190, 1), (1050, 220, 0.10), (2300, 300, 0.03)] if vowel == 'm' else [(600, 120, 1), (1040, 150, 0.45), (2400, 250, 0.12)] if vowel == 'o' else [(730, 110, 1), (1090, 140, 0.6), (2440, 200, 0.18)]
    for k in range(1, 22):
        fk = f * k
        if fk > 5000: break
        a = sum(g / (1 + ((fk - c) / b) ** 2) for c, b, g in F)
        y += np.sin(k * ph + k * 0.7) * a / k ** 0.6
    y += bp(rs.randn(n), 400, 3000) * (0.01 if vowel == 'm' else 0.02)
    return y * env_ar(n, 0.22 if vowel == 'm' else 0.35, 0.45) * vel * 0.5

def choir(f, dur, vel=1.0, vowel='a'):
    return sum(hum(f * (1 + d), dur, vel * 0.3, vowel) for d in (-0.0065, -0.0025, 0.0, 0.003, 0.0068))

def drum(vel=1.0, f0=78.0, damp=1.0):
    n, t = tvec(1.1)
    drop = 1 + 0.08 * np.exp(-t / 0.03); y = np.zeros(n)
    for ratio, amp, dec in [(1, 1, 0.42), (1.59, 0.5, 0.2), (2.14, 0.28, 0.14), (2.30, 0.2, 0.12), (2.65, 0.14, 0.09), (2.92, 0.1, 0.08), (3.6, 0.06, 0.05)]:
        y += amp * np.sin(TAU * np.cumsum(f0 * ratio * drop) / SR + rs.rand()) * np.exp(-t / (dec * damp))
    slap = lp(rs.randn(n), 1400) * np.exp(-t / 0.016) * 0.7 + bp(rs.randn(n), 1500, 4500) * np.exp(-t / 0.006) * 0.15
    return (y * 0.6 + slap * vel) * vel * np.minimum(1, t / 0.002)

def timpani(f0=73.4, vel=1.0):
    n, t = tvec(2.6); y = np.zeros(n)
    for ratio, amp, dec in [(1, 1, 1.1), (1.5, 0.6, 0.7), (1.98, 0.35, 0.5), (2.44, 0.2, 0.35)]:
        y += amp * np.sin(TAU * f0 * ratio * t * (1 + 0.02 * np.exp(-t / 0.05)) + rs.rand()) * np.exp(-t / dec)
    return (y * 0.6 + lp(rs.randn(n), 600) * np.exp(-t / 0.03) * 0.4) * vel

def shaker(vel=1.0):
    n, t = tvec(0.12)
    return bp(rs.randn(n), 4000, 10000) * np.exp(-t / 0.03) * np.minimum(1, t / 0.01) * vel * 0.6

def darbuka(kind='tek', vel=1.0):
    n, t = tvec(0.6)
    if kind == 'doum': return (np.sin(TAU * 105 * t * (1 + 0.15 * np.exp(-t / 0.02))) * np.exp(-t / 0.18) + lp(rs.randn(n), 500) * np.exp(-t / 0.01) * 0.3) * vel
    return (bp(rs.randn(n), 1200, 4500) * np.exp(-t / 0.01) * 0.5 + np.sin(TAU * 620 * t) * np.exp(-t / 0.05) * 0.3) * vel

def logdrum(f=220, vel=1.0):
    n, t = tvec(0.8)
    return (np.sin(TAU * f * t) * np.exp(-t / 0.22) + 0.4 * np.sin(TAU * f * 2.42 * t) * np.exp(-t / 0.06) + bp(rs.randn(n), 800, 3000) * np.exp(-t / 0.005) * 0.3) * vel

def additive(f, dur, amps, decays, inharm=0.0, rel=0.08, attack=0.002, pitchdrop=0.0):
    n, t = tvec(dur)
    y = np.zeros(n)
    fm = 1 + pitchdrop * np.exp(-t / 0.03)
    for k, (a, d) in enumerate(zip(amps, decays), 1):
        fk = f * k * np.sqrt(1 + inharm * k * k)
        if fk > 12000: break
        y += a * np.sin(TAU * np.cumsum(fk * fm) / SR + rs.rand() * 6) * np.exp(-t / d)
    return y * env_ar(n, attack, rel)

def pluck(f, dur=1.6, vel=1.0, bright=1.0):
    amps = [vel / k ** 1.2 * np.exp(-(k - 1) * 0.25 / bright) for k in range(1, 14)]
    decs = [1.5 * (300 / f) ** 0.3 / (1 + 0.45 * (k - 1)) for k in range(1, 14)]
    n, t = tvec(dur)
    return additive(f, dur, amps, decs, 0.00008) * 0.6 + bp(rs.randn(n), 2000, 7000) * np.exp(-t / 0.004) * 0.05 * vel

def harpsi(f, dur=1.0, vel=1.0):
    amps = [vel * (0.6 if k == 1 else 1.0) / k ** 0.7 for k in range(1, 20)]
    decs = [0.9 / (1 + 0.15 * (k - 1)) for k in range(1, 20)]
    return additive(f, dur, amps, decs, 0.00003, rel=0.05) * 0.32

def oud(f, dur=1.2, vel=1.0):
    amps = [vel * a for a in [1, 0.8, 0.6, 0.5, 0.3, 0.25, 0.15, 0.1, 0.06]]
    decs = [0.9 / (1 + 0.35 * k) for k in range(9)]
    return additive(f, dur, amps, decs, 0.0001, pitchdrop=0.012) * 0.45

def kalimba(f, dur=1.6, vel=1.0):
    n, t = tvec(dur)
    y = np.sin(TAU * f * t) * np.exp(-t / 1.0) + 0.35 * np.sin(TAU * f * 5.9 * t) * np.exp(-t / 0.08) + 0.15 * np.sin(TAU * f * 3.0 * t) * np.exp(-t / 0.3)
    return y * vel * 0.5 * np.minimum(1, t / 0.002)

def piano(f, dur=3.0, vel=1.0):
    n, t = tvec(dur + 0.3)
    y = np.zeros(n)
    for k in range(1, 16):
        fk = f * k * np.sqrt(1 + 0.0004 * k * k)
        if fk > 10000: break
        a = vel / k ** 1.1 * np.exp(-(k - 1) * (0.35 - 0.15 * vel))
        T = 2.8 * (220 / f) ** 0.45 / (1 + 0.25 * (k - 1))
        for det in (-0.0003, 0.0003):
            y += 0.5 * a * np.sin(TAU * fk * (1 + det) * t + rs.rand()) * (0.65 * np.exp(-t / (T * 0.25)) + 0.35 * np.exp(-t / (T * 1.6)))
    y += lp(rs.randn(n), 2500) * np.exp(-t / 0.008) * 0.06 * vel
    return y * env_ar(n, 0.002, 0.3) * 0.5

def celesta(f, dur=1.6, vel=1.0):
    n, t = tvec(dur)
    idx = 1.6 * np.exp(-t / 0.15)
    y = np.sin(TAU * f * t + idx * np.sin(TAU * f * 4 * t)) * np.exp(-t / 0.9) + 0.2 * np.sin(TAU * f * 2 * t) * np.exp(-t / 0.3)
    return y * vel * 0.4 * np.minimum(1, t / 0.002)

def bell(f, dur=6.0, vel=1.0):
    n, t = tvec(dur); y = np.zeros(n)
    for r_, a, d in [(0.5, 0.6, 4), (1, 1, 3), (1.19, 0.5, 2.2), (1.56, 0.4, 1.6), (2, 0.4, 1.4), (2.51, 0.25, 1.0), (3.01, 0.2, 0.7), (4.1, 0.12, 0.4)]:
        y += a * np.sin(TAU * f * r_ * t + rs.rand()) * np.exp(-t / d)
    return y * vel * 0.25

def bowed(f, dur, vel=1.0, bright=2400, attack=0.35, voices=3, vib=0.004):
    """Strings: a small section of bowed voices. Each player is a little out of tune with
    the next, and every partial drifts in level, the way real bowing never holds still."""
    n, t = tvec(dur + 0.6); y = np.zeros(n)
    for v in range(voices):
        det = 1 + (v - (voices - 1) / 2) * 0.004 + (rs.rand() - 0.5) * 0.002
        ph = TAU * np.cumsum(f * det * vibrato(t, 4.8 + v * 0.45 + rs.rand() * 0.3, vib * (0.8 + 0.4 * rs.rand()), 0.2 + 0.2 * rs.rand(), rs.randint(1e6))) / SR
        for k in range(1, 30):
            fk = f * k
            if fk > 7000: break
            a = (1 / k) / (1 + (fk / bright) ** 2) * (1 + 0.6 / (1 + ((fk - 480) / 200) ** 2) + 0.35 / (1 + ((fk - 2900) / 500) ** 2))
            shimmer = 1 + 0.35 * (slow_noise(n, 2.5 + k * 0.15, rs.randint(1e6)) - 0.5)
            y += a * shimmer * np.sin(k * ph + rs.rand() * 6)
    y += bp(rs.randn(n), 1500, 6000) * 0.012 * voices
    return y * env_ar(n, attack, 0.6) * vel * 0.28 / voices

def reed(f, dur, vel=1.0):
    """A duduk-like reed: dark, breathy, with a slow swell."""
    n, t = tvec(dur + 0.4)
    ph = TAU * np.cumsum(f * vibrato(t, 5.0, 0.005, 0.3, rs.randint(1e6)) * (1 - 0.01 * np.exp(-t / 0.06))) / SR
    y = np.zeros(n)
    for k in range(1, 18):
        fk = f * k
        if fk > 6000: break
        a = (1 / k ** 0.8) * (1.0 / (1 + ((fk - 600) / 300) ** 2) + 0.4 / (1 + ((fk - 1300) / 400) ** 2) + 0.05)
        y += a * np.sin(k * ph)
    y += bp(rs.randn(n), f * 2, f * 8) * 0.04
    swell = env_ar(n, 0.18, 0.35) * (0.8 + 0.2 * np.sin(np.pi * np.clip(t / dur, 0, 1)))
    return y * swell * vel * 0.35

def tri(f, dur=0.35, vel=1.0):
    n, t = tvec(dur)
    y = sum(((-1) ** k) / (2 * k + 1) ** 2 * np.sin(TAU * f * (2 * k + 1) * t) for k in range(6))
    return y * np.exp(-t / (dur * 0.35)) * np.minimum(1, t / 0.004) * vel * 0.6

def drone(n, freqs, seed=1):
    t = np.arange(n) / SR; out = np.zeros((n, 2)); r = np.random.RandomState(seed)
    for f, a in freqs:
        for ch in range(2):
            for det in (-0.35, 0.3):
                swell = 0.55 + 0.45 * slow_noise(n, 0.18, r.randint(1e6))
                ph = TAU * (f + det * (1 + ch * 0.3)) * t + r.rand() * 6
                out[:, ch] += a * swell * (np.sin(ph) + 0.22 * np.sin(2 * ph) + 0.08 * np.sin(3 * ph)) * 0.5
    return out


# ------------------------------------------------------- Chinese instruments --
# Everything here is kept below about 3 kHz: no piercing, chirping or whistling tones.
def smoothstep(x): x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)

def gz(f, dur=2.6, vel=1.0, bend=0.0, vib=0.0):
    """Guzheng: a bright pluck on a long string; the left hand can press it up, or shake it."""
    n, t = tvec(dur)
    fm = 2 ** (bend / 12 * smoothstep((t - 0.28) / 0.22)) * (1 + vib * np.clip((t - 0.35) / 0.3, 0, 1) * np.sin(TAU * 5.6 * t))
    y = np.zeros(n); ph = TAU * np.cumsum(f * fm) / SR
    for k in range(1, 18):
        if f * k > 4000: break
        a = vel / k ** 1.05 * (1 + 0.5 * np.exp(-((k - 3) / 1.6) ** 2)) * (abs(np.sin(np.pi * k * 0.13)) + 0.15)
        d = 2.4 * (220 / f) ** 0.35 / (1 + 0.55 * (k - 1))
        y += a * np.sin(k * ph * np.sqrt(1 + 0.00015 * k * k) + rs.rand() * 6) * np.exp(-t / d)
    y += lp(rs.randn(n), 2400) * np.exp(-t / 0.005) * 0.06 * vel
    return y * env_ar(n, 0.0015, 0.12) * 0.3

def pipa(f, dur=0.7, vel=1.0):
    n, t = tvec(dur); y = np.zeros(n); ph = TAU * f * t * (1 + 0.01 * np.exp(-t / 0.02))
    for k in range(1, 14):
        if f * k > 3800: break
        a = vel / k ** 0.9 * (1 + 0.6 * np.exp(-((k - 4) / 2) ** 2)); d = 0.9 * (220 / f) ** 0.3 / (1 + 0.7 * (k - 1))
        y += a * np.sin(k * ph + rs.rand() * 6) * np.exp(-t / d)
    y += lp(rs.randn(n), 2400) * np.exp(-t / 0.004) * 0.08 * vel
    return y * env_ar(n, 0.001, 0.06) * 0.26

def pipa_trem(f, dur, vel=1.0, rate=14.0):
    n, _ = tvec(dur + 0.6); y = np.zeros(n); k = 0
    while k / rate < dur:
        x = pipa(f, 0.5, vel * (0.75 + 0.25 * rs.rand()) * (0.8 if k % 2 else 1)); i = int(k / rate * SR); m = min(len(x), n - i); y[i:i + m] += x[:m]; k += 1
    return y * env_ar(n, 0.05, 0.3) * 0.7

def qin(f, dur=4.5, vel=1.0, slide=0.0):
    """Guqin: low, woody, long; the finger slides along the string after the pluck."""
    n, t = tvec(dur)
    fm = 2 ** (slide / 12 * smoothstep((t - 0.45) / 0.7)); ph = TAU * np.cumsum(f * fm) / SR; y = np.zeros(n)
    for k in range(1, 14):
        if f * k > 2800: break
        a = vel / k ** 1.25 * (0.25 + abs(np.sin(np.pi * k / 7.3))); d = 4.0 * (110 / f) ** 0.3 / (1 + 0.35 * (k - 1))
        y += a * np.sin(k * ph + rs.rand() * 6) * np.exp(-t / d)
    if slide: y += lp(rs.randn(n), 900) * 0.01 * vel * ((np.abs(np.gradient(fm)) * SR) > 0.02) * np.exp(-t / 2)
    y += lp(rs.randn(n), 1200) * np.exp(-t / 0.01) * 0.05 * vel
    return y * env_ar(n, 0.003, 0.4) * 0.42

def gong(f=90.0, dur=7.0, vel=1.0, bloom=0.5):
    n, t = tvec(dur); y = np.zeros(n); r = np.random.RandomState(rs.randint(1e6))
    for j in range(36):
        fr = f * (1 + j * 0.37 + r.rand() * 0.5)
        if fr > 2400: continue
        a = 1 / (1 + j * 0.25); dec = 1.5 + 4.5 * r.rand() / (1 + j * 0.08)
        sw = 1 - np.exp(-t / (bloom * (0.3 + r.rand())))
        y += a * np.sin(TAU * fr * t * (1 - 0.004 * np.exp(-t / 0.4)) + r.rand() * 6) * np.exp(-t / dec) * (0.4 + 0.6 * sw)
    y += lp(rs.randn(n), 700) * np.exp(-t / 0.05) * 0.6
    return lp(y, 2200) * vel * 0.12 * env_ar(n, 0.003, 1.0)

def bz(f, dur=5.0, vel=1.0):
    """Bianzhong: a bronze bell of the Zhou courts (two tones, a minor third apart)."""
    n, t = tvec(dur); y = np.zeros(n)
    for r_, a, d in [(1, 1, 2.6), (1.19, 0.55, 2.0), (2.0, 0.35, 1.3), (2.42, 0.3, 0.9), (2.97, 0.18, 0.6), (3.6, 0.12, 0.45), (4.3, 0.08, 0.3)]:
        if f * r_ > 2800: continue
        y += a * np.sin(TAU * f * r_ * t + rs.rand() * 6) * np.exp(-t / d)
    y += lp(rs.randn(n), 1600) * np.exp(-t / 0.006) * 0.25
    return y * vel * 0.26 * np.minimum(1, t / 0.002)

def tanggu(vel=1.0, f0=64.0): return lp(drum(vel, f0, 1.4), 2000)
def paigu(vel=1.0, f0=150.0): return lp(drum(vel, f0, 0.7), 2000) * 0.7
def muyu(vel=1.0, f=520.0):
    n, t = tvec(0.25)
    return lp(np.sin(TAU * f * t) * np.exp(-t / 0.045) + 0.3 * np.sin(TAU * f * 2.6 * t) * np.exp(-t / 0.012) + lp(rs.randn(n), 1500) * np.exp(-t / 0.004) * 0.3, 2200) * vel * 0.5

def sheng(f, dur, vel=1.0):
    """Sheng: the mouth organ, playing its open fourths and fifths."""
    return (reed(f, dur, vel) + reed(f * 1.5, dur, vel * 0.55) + reed(f * 2, dur, vel * 0.35)) * 0.55

def pad(f, dur, vel=1.0, bright=1300, attack=1.2):
    n, t = tvec(dur + 1.0); y = np.zeros(n)
    for det in (-0.006, -0.002, 0.003, 0.007):
        ph = TAU * f * (1 + det) * t + rs.rand() * 6
        for k in range(1, 24):
            fk = f * k
            if fk > 3200: break
            y += np.sin(k * ph) / k / (1 + (fk / bright) ** 2)
    return y * env_ar(n, attack, 1.0) * vel * 0.09

def pulse(f, dur=0.32, vel=1.0):
    n, t = tvec(dur); y = np.zeros(n)
    for k in range(1, 10):
        if f * k > 2400: break
        y += np.sin(TAU * f * k * t) / k ** 1.4 * np.exp(-t * (6 + k * 3))
    return y * np.minimum(1, t / 0.003) * vel * 0.3

def line(notes, beat=1.0, oct=0, kind='erhu', vel=1.0, glide=0.05):
    """A legato line on one breath or one bow: each note slides into the next (erhu, dizi, xiao, bone flute)."""
    total = sum(b for _, b in notes) * beat; n = int((total + 0.8) * SR); t = np.arange(n) / SR
    f = np.zeros(n); on = np.zeros(n); starts = np.zeros(n, dtype=bool); tt = 0.0; first = None
    for name, b in notes:
        i0, i1 = int(tt * SR), int((tt + b * beat) * SR)
        if name != 'r':
            fv = hz(name) * 2 ** oct; f[i0:] = fv; on[i0:max(i0 + 1, i1 - int(0.025 * SR))] = 1; starts[i0] = True
            if first is None: first = fv
        tt += b * beat
    f[f == 0] = first
    a = 1 - np.exp(-1 / (glide * SR)); lf = np.log(f)
    lf = signal.lfilter([a], [1, a - 1], lf, zi=signal.lfilter_zi([a], [1, a - 1]) * lf[0])[0]
    att = {'erhu': 0.07, 'dizi': 0.035, 'xiao': 0.09, 'bone': 0.06}[kind]
    b2 = 1 - np.exp(-1 / (att * SR)); env = signal.lfilter([b2], [1, b2 - 1], on)
    idx = np.arange(n); last = np.maximum.accumulate(np.where(starts, idx, 0)); since = (idx - last) / SR
    depth = {'erhu': 0.009, 'dizi': 0.005, 'xiao': 0.004, 'bone': 0.003}[kind] * np.clip((since - 0.2) / 0.35, 0, 1)
    fs = np.exp(lf) * (1 + depth * np.sin(TAU * (5.6 if kind == 'erhu' else 4.8) * t))
    if kind == 'bone': fs *= 1 + 0.006 * (slow_noise(n, 1.5, rs.randint(1e6)) - 0.5)
    ph = TAU * np.cumsum(fs) / SR; y = np.zeros(n)
    if kind == 'erhu':
        for k in range(1, 20):
            x = fs * k
            if x.mean() > 3600: break
            form = (0.35 + 1 / (1 + ((x - 950) / 350) ** 2) + 0.5 / (1 + ((x - 1900) / 450) ** 2)) / (1 + (x / 2600) ** 4)
            y += form / k ** 0.75 * np.sin(k * ph + k * 0.4)
        y = y * 0.28 + bp(rs.randn(n), 900, 2600) * 0.02
    elif kind == 'dizi':
        for k, a_ in enumerate([1, 0.5, 0.32, 0.16, 0.1, 0.06, 0.04], 1):
            if f.mean() * k > 3000: break
            buzz = 1 + (0.5 * (slow_noise(n, 30, rs.randint(1e6)) - 0.5) if k >= 3 else 0)
            y += a_ * buzz * np.sin(k * ph + k)
        y = y * 0.5 + bp(rs.randn(n), max(300, first * 1.2), 2800) * 0.07
    else:
        amps = [1, 0.18, 0.08, 0.03] if kind == 'xiao' else [1, 0.3, 0.12, 0.05]
        for k, a_ in enumerate(amps, 1): y += a_ * np.sin(k * ph + k)
        y = y * 0.55 + bp(rs.randn(n), 250 if kind == 'xiao' else 500, 1600 if kind == 'xiao' else 2400) * (0.12 if kind == 'xiao' else 0.16)
    return lp(y * env, 3200) * vel

# -------------------------------------------------------------------- score --
# One theme for the whole film, in the pentatonic gong mode on D (D E F# A B). It is first
# heard on the bone flute, nine thousand years ago, and returns with each age's instruments.
BONE = [('A4', 1.5), ('B4', 0.5), ('D5', 1), ('B4', 1), ('A4', 1), ('F#4', 1), ('E4', 2), ('E4', 0.5), ('F#4', 0.5), ('A4', 1), ('B4', 1), ('A4', 3)]
THEME_A = [('A4', 1.5), ('B4', 0.5), ('D5', 1), ('E5', 1), ('D5', 1), ('B4', 1), ('A4', 2)]
THEME_B = [('B4', 1), ('A4', 0.5), ('F#4', 0.5), ('E4', 1), ('F#4', 1), ('A4', 1.5), ('B4', 0.5), ('A4', 2)]
THEME_C = [('D5', 1), ('E5', 0.5), ('F#5', 0.5), ('E5', 1), ('D5', 1), ('B4', 1.5), ('A4', 0.5), ('D5', 2)]
SAD = [('B3', 1), ('D4', 0.5), ('E4', 0.5), ('F#4', 1.5), ('E4', 0.5), ('D4', 1), ('B3', 2), ('A3', 1), ('B3', 3)]
PROG = [['D3', 'A3', 'E4', 'F#4'], ['B2', 'F#3', 'A3', 'D4'], ['G2', 'D3', 'A3', 'B3'], ['A2', 'E3', 'A3', 'D4']]
PROG_SAD = [['B2', 'F#3', 'B3', 'D4'], ['E2', 'B2', 'D3', 'F#3'], ['G2', 'D3', 'B3', 'D4'], ['F#2', 'C#3', 'F#3', 'A3']]
PENT = ['D', 'E', 'F#', 'A', 'B']
def pent(lo, hi):
    out = []
    for o in range(1, 7):
        for p in PENT:
            nm = f'{p}{o}'
            if hz(lo) <= hz(nm) <= hz(hi): out.append(nm)
    return out

RING = {gz: 2.4, qin: 4.0, pipa: 0.8, bz: 3.5, piano: 2.6, oud: 1.0}

class Score:
    def __init__(self, dur):
        self.n = int(dur * SR); self.dry = np.zeros((self.n, 2)); self.wet = np.zeros((self.n, 2))
    def add(self, x, t, g=1.0, pan=0.0, wet=True):
        place(self.wet if wet else self.dry, x, t, g, pan)
    def phrase(self, notes, t0, inst, beat=1.0, oct=0, g=1.0, pan=0.0, legato=0.96, human=0.012, **kw):
        t = t0
        for name, beats in notes:
            if name != 'r': self.add(inst(hz(name) * 2 ** oct, max(beats * beat * legato, RING.get(inst, 0)), **kw), t + rs.randn() * human, g, pan)
            t += beats * beat
        return t
    def line(self, notes, t0, kind, beat=0.75, oct=0, g=1.0, pan=0.0, **kw):
        self.add(line(notes, beat, oct, kind, **kw), t0, g, pan); return t0 + sum(b for _, b in notes) * beat
    def chords(self, t0, bars, inst, prog=PROG, beat=0.75, g=1.0, oct=0, pan=0.0, **kw):
        for b in range(bars):
            for i, name in enumerate(prog[b % len(prog)]):
                self.add(inst(hz(name) * 2 ** oct, 4 * beat * 1.04, **kw), t0 + b * 4 * beat + rs.randn() * 0.01, g, pan + (i - 1.5) * 0.25)
    def arp(self, t0, bars, inst, prog=PROG, beat=0.75, sub=2, pattern=(0, 1, 2, 3, 2, 1, 2, 3), g=1.0, oct=1, pan=0.0, vel=0.8, **kw):
        step = beat / sub
        for b in range(bars):
            ch = prog[b % len(prog)]
            for s in range(int(4 * sub)):
                name = ch[pattern[s % len(pattern)] % len(ch)]
                self.add(inst(hz(name) * 2 ** oct, vel=vel * (1 if s % sub == 0 else 0.75), **kw), t0 + b * 4 * beat + s * step + rs.randn() * 0.006, g, pan + 0.3 * np.sin(s))
    def beats(self, t0, t1, step, inst, g=1.0, pan=0.0, accent=4, swing=0.0, **kw):
        k = 0; t = t0
        while t < t1:
            self.add(inst(vel=(1.0 if k % accent == 0 else 0.62) * (0.9 + 0.1 * rs.rand()), **kw), t + (swing * step if k % 2 else 0) + rs.randn() * 0.006, g, pan)
            k += 1; t = t0 + k * step
    def gliss(self, t0, notes, step, inst, g=1.0, pan=0.0, **kw):
        for i, nm in enumerate(notes): self.add(inst(hz(nm), **kw), t0 + i * step, g, pan + (i / max(1, len(notes) - 1) - 0.5) * 0.6)


# ======================================================================
# AURAMANTRA reel: the score, the room's sounds, the paper. No voice.
# Everything bright is kept under ~2.5 kHz (no piercing, chirping sounds).
# ======================================================================
nm = lambda x: x / (np.abs(x).max() + 1e-12)

def cimbalom(f, dur=2.2, vel=1.0):
    """A soft-mallet hammered dulcimer (cimbalom): paired strings a hair apart, a felt attack, a long
    shimmering ring, kept dark."""
    n, t = tvec(dur + 0.4); y = np.zeros(n)
    for det in (-0.0012, 0.0011):
        for k in range(1, 12):
            fk = f * k * (1 + 0.0007 * k * k) * (1 + det)
            if fk > 4200: break
            a = vel / k ** 1.25 * np.exp(-(k - 1) * 0.3)
            T = 2.2 * (300 / f) ** 0.35 / (1 + 0.5 * (k - 1))
            y += 0.5 * a * np.sin(TAU * fk * t + rs.rand() * 6) * np.exp(-t / T)
    y += lp(rs.randn(n), 1400) * np.exp(-t / 0.006) * 0.05 * vel
    return lp(y * env_ar(n, 0.003, 0.3), 2600) * 0.5

def felt(f, dur=3.0, vel=1.0):
    """A felt piano: the hammer muted with felt, warm and close."""
    return lp(piano(f, dur, vel * 0.9), 1800, 2) * 1.1

def bowl(f=146.8, dur=7.0, vel=1.0):
    """A singing bowl, struck softly: low partials, slow beating, lowpassed."""
    n, t = tvec(dur); y = np.zeros(n)
    for r_, a, d in [(1, 1, 5.5), (2.71, 0.45, 3.2), (5.1, 0.18, 1.8)]:
        for det in (-0.7, 0.7):
            y += a * 0.5 * np.sin(TAU * (f * r_ + det) * t + rs.rand() * 6) * np.exp(-t / d)
    return lp(y * np.minimum(1, t / 0.01), 1800) * vel * 0.35

def kick(vel=1.0):
    n, t = tvec(0.5)
    f = 48 + 70 * np.exp(-t / 0.04)
    return np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / 0.16) * vel * 0.9

def tock(vel=1.0, f=380):
    n, t = tvec(0.25)
    y = np.sin(TAU * f * t) * np.exp(-t / 0.035) + 0.4 * np.sin(TAU * f * 1.6 * t) * np.exp(-t / 0.02) + lp(rs.randn(n), 1600) * np.exp(-t / 0.01) * 0.3
    return y * vel * 0.4

def soft_shaker(vel=1.0):
    n, t = tvec(0.18)
    return bp(rs.randn(n), 700, 2400) * np.exp(-t / 0.045) * np.minimum(1, t / 0.008) * vel * 0.2

def bass(f, dur, vel=1.0):
    n, t = tvec(dur + 0.2)
    y = np.sin(TAU * f * t) + 0.3 * np.sin(TAU * 2 * f * t) + 0.08 * np.sin(TAU * 3 * f * t)
    return lp(y, 600) * env_ar(n, 0.02, 0.18) * np.exp(-t / (dur * 1.4)) * vel * 0.5

THEME = [('A4', 1), ('B4', 0.5), ('D5', 0.5), ('E5', 1), ('D5', 1), ('B4', 0.5), ('A4', 0.5), ('F#4', 2)]
THEME2 = [('E4', 1), ('F#4', 0.5), ('A4', 0.5), ('B4', 1), ('A4', 1), ('F#4', 0.5), ('E4', 0.5), ('D4', 2)]
CH = [['D3', 'A3', 'E4', 'F#4'], ['B2', 'F#3', 'A3', 'D4'], ['G2', 'D3', 'A3', 'B3'], ['A2', 'E3', 'A3', 'C#4']]
ROOTS = ['D2', 'B1', 'G1', 'A1']
B = 0.75  # one beat at 80 bpm; a bar is 3 s

def build_score(EV, dur):
    S = Score(dur); muffled = Score(dur)
    # ------------------------------------------------- the week: through a wall
    muffled.add(felt(hz('D4'), 3.0, 0.8), 0.02, 0.9, 0.0)                     # the first sound
    stop = EV['arrive'] - 0.05
    for i in range(int(stop / B) + 1):
        t = i * B
        if t >= stop: break
        if i % 2 == 0: muffled.add(kick(0.9 if i % 4 == 0 else 0.7), t, 0.9, 0, wet=False)
        else: muffled.add(tock(0.7), t, 0.7, 0.1, wet=False)
        muffled.add(bass(hz(ROOTS[(i // 4) % 4]), B * 0.9, 0.9), t, 0.8, 0, wet=False)
    for i in range(int(stop / (B / 2))): muffled.add(tock(0.35, 900), i * B / 2 + B / 4, 0.25, -0.3, wet=False)  # the clock, ticking
    muffled.chords(0.0, 2, felt, prog=CH[:2], beat=B, g=0.16)
    # ------------------------------------------------------ the warm window
    S.add(pad(hz('D3'), 3.5, 0.9, attack=1.4), EV['setDown'], 0.55, -0.2); S.add(pad(hz('A3'), 3.5, 0.8, attack=1.6), EV['setDown'] + 0.2, 0.45, 0.2); S.add(pad(hz('F#4'), 3.2, 0.6, attack=1.8), EV['setDown'] + 0.4, 0.35, 0)
    S.gliss(EV['butterflies'], ['D4', 'F#4', 'A4', 'D5', 'E5'], 0.11, cimbalom, g=0.5, vel=0.6)
    S.phrase(THEME, EV['walk2'] - 0.05, felt, beat=B * 0.62, g=0.55, vel=0.7)
    S.add(felt(hz('D3'), 3.0, 0.6), EV['walk2'] - 0.05, 0.4, -0.2)
    # ------------------------------------------------------------- the room
    S.add(bowl(146.8, 7.5, 1.0), 8.75, 0.9, 0.0)
    S.add(pad(hz('B2'), 4.2, 0.8), 8.7, 0.5, -0.3); S.add(pad(hz('F#3'), 4.2, 0.7), 8.8, 0.4, 0.3); S.add(pad(hz('D4'), 4.2, 0.6), 8.9, 0.3, 0)
    S.add(pad(hz('G2'), 3.0, 0.8), 12.4, 0.5, -0.3); S.add(pad(hz('D3'), 3.0, 0.7), 12.4, 0.4, 0.3); S.add(pad(hz('B3'), 3.0, 0.6), 12.5, 0.3, 0)
    S.phrase(THEME2, 9.0, felt, beat=B * 0.8, g=0.5, vel=0.6)
    # the knot coming undone: a cluster that loosens, note by note, into an open chord
    u0, u1 = EV['untie']; knot = ['C#5', 'D5', 'C#5', 'E5', 'D5', 'B4', 'C#5', 'A4', 'D5', 'F#4', 'A4', 'E4', 'D4']
    for i, nmn in enumerate(knot):
        q = i / (len(knot) - 1); t = u0 + (u1 - u0) * q ** 0.8
        S.add(cimbalom(hz(nmn), 2.4, 0.55 - 0.15 * q), t, 0.42, -0.4 + 0.8 * q)
    for nmn in ['D3', 'A3', 'D4', 'F#4']: S.add(felt(hz(nmn), 3.5, 0.55), u1 + 0.05, 0.45, 0)
    # ---------------------------------------------------------- lomi lomi
    S.add(kalimba(hz('A4'), 1.6, 0.7), EV['drop'], 0.55, 0)                    # the drop lands
    n, t = tvec(2.2); S.add(np.sin(TAU * 73.4 * t) * np.sin(np.pi * np.clip(t / 2.2, 0, 1)) ** 2 * 0.5, EV['drop'] - 0.05, 0.6, 0)  # its warmth, felt more than heard
    for nmn, d in [('D3', 0.0), ('A3', 0.1), ('E4', 0.2), ('F#4', 0.3)]: S.add(pad(hz(nmn), 3.4, 0.8, attack=0.8), EV['drop'] + d, 0.4, 0)
    w0 = EV['waves'][0]
    for k, tw in enumerate(EV['waves']):
        notes = [['D3', 'A3', 'D4', 'F#4', 'A4', 'D5'], ['B2', 'F#3', 'B3', 'D4', 'F#4', 'B4'], ['G2', 'D3', 'G3', 'B3', 'D4', 'G4', 'B4', 'D5']][k]
        S.gliss(tw - 0.35, notes, 0.09, cimbalom, g=0.42, vel=0.7)
    # the beat comes back, open now, with the bass and the theme on the cimbalom
    t = w0 - 0.35; i = 0
    while t < EV['pull'] + 0.2:
        if i % 2 == 0: S.add(kick(0.8 if i % 4 == 0 else 0.6), t, 0.8, 0, wet=False)
        else: S.add(tock(0.55), t, 0.55, 0.1, wet=False)
        S.add(soft_shaker(0.8 if i % 2 else 0.5), t + B / 2, 0.6, 0.3, wet=False)
        if i % 2 == 0: S.add(bass(hz(ROOTS[(i // 4) % 4]), B * 1.8, 0.9), t, 0.8, 0, wet=False)
        if i % 4 == 0: S.chords(t, 1, felt, prog=[CH[(i // 4) % 4]], beat=B, g=0.14)
        t += B; i += 1
    S.phrase(THEME, EV['exit'] - 0.1, cimbalom, beat=B * 0.5, g=0.5, vel=0.75)
    S.phrase(THEME2, EV['exit'] - 0.1 + 6 * B * 0.5 + 0.2, cimbalom, beat=B * 0.5, g=0.45, vel=0.7)
    S.gliss(EV['stretch'] - 0.05, ['D4', 'E4', 'F#4', 'A4'], 0.07, kalimba, g=0.4, vel=0.6)
    # -------------------------------------------------------------- the point
    for k, nmn in enumerate(['D5', 'B4', 'E5', 'A4', 'F#5', 'F#4', 'A5', 'D4', 'B4']):  # a note for each petal, from the middle out
        S.add(cimbalom(hz(nmn), 2.6, 0.5), EV['lotus'] + (0 if k == 0 else ((k + 1) // 2) * 0.16), 0.4, (-1) ** k * 0.15 * ((k + 1) // 2))
    S.add(felt(hz('D4'), 3.5, 0.9), EV['logo'], 0.95, 0.0)                     # the first sound, clear now
    for nmn in ['D2', 'A2', 'D3', 'F#3', 'E4']: S.add(pad(hz(nmn), dur - EV['logo'] + 0.5, 0.9, attack=0.6), EV['logo'] - 0.2, 0.42, 0)
    S.add(bowl(146.8, 5.0, 0.8), EV['logo'] + 0.05, 0.6, 0)
    # mix the muffled part as if heard through a wall, then the rest
    m = muffled.dry + reverb(muffled.wet, rt=1.2, wet=0.2, bright=2000, seed=4)
    for ch in range(2): m[:, ch] = lp(m[:, ch], 700, 2)
    out = S.dry + reverb(S.wet, rt=2.2, wet=0.3, bright=2600, seed=8) + m * 1.1
    return out

# -------------------------------------------------------- paper and things
def flap(k=0):
    """A soft card flap: a papery brush of noise, a small snap, a little thump of air (as in src/sound.js)."""
    r = np.random.RandomState(1234 + k * 977); n, t = tvec(0.24)
    w = r.randn(n); a = lp(w, 3800, 1); b2 = lp(a, 700, 1); hp_ = a - b2
    snap = 0.04 + k * 0.01
    brush = np.minimum(1, t / 0.012) * np.exp(-t / 0.05) * 0.55
    tick = np.where(t > snap, np.exp(-(t - snap) / 0.012) * 0.9, 0)
    thump = np.sin(TAU * (150 - t * 420) * t) * np.exp(-t / 0.035) * 0.35
    return lp(hp_ * (brush + tick) + thump, 2800, 2)
FLAPS = [nm(flap(k)) for k in range(6)]

def thud(vel=1.0, f=70):
    n, t = tvec(0.6); return nm(np.sin(TAU * f * t * (1 - 0.3 * t)) * np.exp(-t / 0.12) + lp(rs.randn(n), 500) * np.exp(-t / 0.03) * 0.5) * vel

def rustle(dur=0.8, vel=1.0, lo=500, hi=2400):
    n, t = tvec(dur); e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.5 * (0.6 + 0.4 * slow_noise(n, 30, rs.randint(1e6)))
    return nm(bp(rs.randn(n), lo, hi) * e) * vel

def whoosh(dur=0.8, vel=1.0, lo=200, hi=1400):
    n, t = tvec(dur); e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2
    return nm(bp(rs.randn(n), lo, hi) * e) * vel

def creak(dur=0.5, vel=1.0, f=95):
    n, t = tvec(dur); fm = f * (1 + 0.25 * np.sin(TAU * 3 * t)) * (1 + 0.4 * t)
    y = np.sign(np.sin(TAU * np.cumsum(fm) / SR)) * (0.5 + 0.5 * slow_noise(n, 40, 3))
    return nm(lp(y, 900) * np.sin(np.pi * np.clip(t / dur, 0, 1))) * vel

def step(vel=1.0, light=0):
    n, t = tvec(0.16)
    y = np.sin(TAU * (90 if not light else 120) * t) * np.exp(-t / 0.03) + lp(rs.randn(n), 1200) * np.exp(-t / (0.015 if light else 0.025)) * 0.6
    return nm(y) * vel

def ambience(dur, EV, events):
    n = int(dur * SR); out = np.zeros((n, 2)); t = np.arange(n) / SR
    def bed(lo, hi, seed, level):
        x = np.stack([bp(np.random.RandomState(seed + c).randn(n), lo, hi) for c in range(2)], 1); return x * level[:, None]
    # rain: a soft wash and its patter, until it stops by the door
    rain = curve(n, [(0, 1), (EV['rainStop'] - 0.4, 1), (EV['rainStop'] + 0.7, 0), (dur, 0)])
    room_rain = curve(n, [(0, 0), (8.6, 0), (9.0, 0.22), (13.6, 0.22), (14.2, 0), (dur, 0)])  # on the room's window
    out += np.stack([lp(c, 1700, 4) for c in bed(250, 2200, 11, (rain + room_rain) * 0.06).T], 1) * 1.15
    pat = np.zeros(n); r = np.random.RandomState(5)
    for _ in range(int(dur * 70)):
        i = r.randint(n); m_ = min(n - i, 400); pat[i:i + m_] += np.exp(-np.arange(m_) / 60) * r.rand()
    pat = lp(bp(pat, 300, 2000), 1600, 4)
    out += np.stack([pat, np.roll(pat, 300)], 1) * ((rain + room_rain) * 0.03)[:, None]
    # the city: a low hum of traffic; the tram passing, with its bell
    city = curve(n, [(0, 1), (5, 0.8), (7.8, 0.4), (8.6, 0), (dur, 0)])
    out += bed(40, 220, 21, city * 0.08)
    tram = curve(n, [(0, 0), (0.6, 0.3), (2.6, 1), (4.8, 0.5), (6.5, 0), (dur, 0)])
    rum = lp(np.random.RandomState(3).randn(n), 160) * (1 + 0.3 * np.sin(TAU * 7 * t))
    out += np.stack([rum * tram * 0.09, rum * tram * 0.07], 1)
    for tb in (EV['tram'] + 0.5, EV['tram'] + 0.85):
        tv = tvec(1.6)[1]; bell = lp(np.sin(TAU * 620 * tv) * np.exp(-tv / 0.5) + 0.4 * np.sin(TAU * 1490 * tv) * np.exp(-tv / 0.25), 1500)
        place(out, nm(bell) * 0.035, tb, 1, 0.4)
    # the alarm clock, rattling on top of the tower: low, muffled, short
    tv = tvec(1.1)[1]; al = lp(np.sign(np.sin(TAU * 34 * tv)) * np.sin(TAU * 260 * tv), 1100) * (0.6 + 0.4 * np.sin(TAU * 17 * tv) ** 2) * np.sin(np.pi * tv / 1.1) ** 0.4
    place(out, nm(al) * 0.05, EV['alarm'], 1, 0.15)
    # the room: warm tone, a candle's soft crackle
    room = curve(n, [(0, 0), (8.5, 0), (9.0, 1), (17.0, 0.7), (18.0, 0), (dur, 0)])
    out += bed(80, 500, 31, room * 0.03)
    cr = np.zeros(n); r = np.random.RandomState(8)
    for _ in range(int(dur * 9)):
        i = r.randint(n); m_ = min(n - i, 300); cr[i:i + m_] += r.randn(m_) * np.exp(-np.arange(m_) / 40) * r.rand()
    out += np.stack([lp(cr, 1600), lp(np.roll(cr, 500), 1600)], 1) * (room * 0.025)[:, None]
    # outside again: a warm breeze, leaves
    air = curve(n, [(0, 0), (14.2, 0), (15.5, 0.8), (20.4, 1), (22.5, 0.6), (dur, 0.4)])
    out += bed(150, 900, 41, air * 0.035 * (0.7 + 0.3 * slow_noise(n, 0.5, 9)))
    return out

def effects(dur, EV, events):
    n = int(dur * SR); out = np.zeros((n, 2)); cam = events['cam']
    camAt = lambda tt: cam[min(len(cam) - 1, max(0, int(tt * 20)))]
    # every paper flap: cut-outs springing up and folding, quieter far away; crowds thinned
    lay = {'far': 0.28, 'mid': 0.5, 'main': 1.0, 'front': 0.75}
    fl = sorted(events['flaps'], key=lambda f: f['t']); last = -9; burst = 0
    for f in fl:
        burst = burst + 1 if f['t'] - last < 0.12 else 0; last = f['t']
        if burst > 3: continue
        pan = np.clip((f['a'] - camAt(f['t'])) / 14, -1, 1) * 0.7
        g = lay.get(f['layer'], 0.5) * min(1, f['loud']) * (0.7 if f.get('fold') else 1) * (0.6 + 0.4 * rs.rand())
        place(out, FLAPS[rs.randint(6)] * 0.05 * g, f['t'], 1, pan)
    # her footsteps: heavy under the week, light on the way home; gone once we pull back
    for s in events['steps']:
        if s['t'] > EV['pull'] + 0.6: continue
        heavy = s['t'] < EV['setDown']
        place(out, step(1.0, 0 if heavy else 1) * (0.07 if heavy else 0.045), s['t'], 1, np.clip((s['a'] - camAt(s['t'])) / 14, -1, 1) * 0.5)
    # the tower set down; its pages turning into wings
    place(out, thud(1, 62) * 0.09, EV['setDown'] + 0.35, 1, -0.15)
    place(out, rustle(0.6, 1, 600, 2200) * 0.04, EV['setDown'] + 0.3, 1, -0.2)
    for i in range(10):
        tw = EV['butterflies'] + i * 0.11 + rs.rand() * 0.08; tv = tvec(0.5)[1]
        wings = bp(rs.randn(len(tv)), 300, 1500) * (0.5 + 0.5 * np.sign(np.sin(TAU * 14 * tv))) * np.sin(np.pi * tv / 0.5)
        place(out, nm(wings) * 0.018, tw, 1, -0.2 + i * 0.06)
    # the door
    place(out, creak(0.5, 1, 90) * 0.03, EV['doorOpen'], 1, 0.2); place(out, thud(0.8, 80) * 0.05, EV['doorClose'] + 0.25, 1, 0.2)
    # the cards: each dropping in on its threads, and lifting away
    for t0, t1 in zip(EV['card'], EV['cardOut']):
        place(out, rustle(0.35, 1, 500, 2000) * 0.022, t0 + 0.12, 1, -0.1); place(out, thud(0.6, 110) * 0.03, t0 + 0.42, 1, 0)
        place(out, whoosh(0.5, 1, 300, 1500) * 0.016, t1, 1, 0)
    # travelling in, and the close-up rising and falling
    place(out, whoosh(0.9, 1, 150, 1100) * 0.045, EV['travel1'], 1, 0.3)
    place(out, whoosh(0.6, 1, 200, 1200) * 0.03, EV['knotIn'] - 0.05, 1, 0); place(out, whoosh(0.6, 1, 200, 1200) * 0.025, EV['knotOut'] - 0.45, 1, 0)
    # hands on skin while the knot is worked, slow; the thread drawn out; a long breath out
    for k in range(6):
        tk = 9.7 + k * 0.92; tv = tvec(0.8)[1]
        place(out, nm(bp(rs.randn(len(tv)), 250, 900) * np.sin(np.pi * tv / 0.8) ** 2) * 0.012, tk, 1, -0.2 + 0.08 * k)
    u0, u1 = EV['untie']; place(out, rustle(u1 - u0, 1, 350, 1300) * 0.012, u0, 1, 0)
    tv = tvec(2.0)[1]; place(out, nm(bp(rs.randn(len(tv)), 200, 1100) * np.sin(np.pi * np.clip(tv / 2.0, 0, 1)) ** 1.5 * np.exp(-tv / 1.4)) * 0.03, u1 - 0.2, 1, 0)
    # the oil: a soft pour, then the drop; the waves going out
    tv = tvec(0.5)[1]; place(out, nm(bp(rs.randn(len(tv)), 300, 1200) * (0.6 + 0.4 * np.sin(TAU * 31 * tv)) * np.sin(np.pi * tv / 0.5)) * 0.012, EV['oil'], 1, 0)
    for tw in EV['waves']:
        tv = tvec(2.4)[1]; env = np.clip(tv / 0.6, 0, 1) ** 2 * np.exp(-np.clip(tv - 0.6, 0, None) / 0.7)
        place(out, nm(bp(rs.randn(len(tv)), 160, 900) * env) * 0.05, tw - 0.4, 1, 0.3)
    # her skip; the pull back; the letters pressed on; the last card
    place(out, whoosh(0.4, 1, 300, 1400) * 0.015, EV['stretch'], 1, 0.2)
    place(out, whoosh(1.9, 1, 120, 900) * 0.05, EV['pull'], 1, 0)
    for i, d in enumerate([-0.15, 0.0, 0.35]): place(out, thud(0.5, 140 - i * 15) * 0.03, EV['logo'] + d + 0.05, 1, 0)
    place(out, thud(0.6, 110) * 0.035, EV['logo'] + 1.0, 1, 0)
    return out

def main():
    spec = json.load(open(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'film/film.json'))); dur = spec['duration']; EV = spec['events']
    events = json.load(open(os.path.join(ROOT, '.cache/events.json')))
    print('score'); music = build_score(EV, dur)
    print('ambience'); amb = ambience(dur, EV, events)
    print('effects'); fx = effects(dur, EV, events)
    music, amb, fx = music * 0.45, amb * 3.4, fx * 4.2
    mix = music + amb + fx
    mix *= curve(len(mix), [(0, 1), (dur - 0.45, 1), (dur, 0)])[:, None]
    db = lambda x: 20 * np.log10(np.sqrt((x ** 2).mean()) + 1e-12)
    for t0 in range(0, int(dur) + 1, 3):
        sl = slice(t0 * SR, min(len(mix), (t0 + 3) * SR))
        print(f'   {t0:3d}s  music {db(music[sl]):6.1f}  amb {db(amb[sl]):6.1f}  fx {db(fx[sl]):6.1f}  mix {db(mix[sl]):6.1f}')
    print(f'  overall: music {db(music):.1f}  amb {db(amb):.1f}  fx {db(fx):.1f}  mix {db(mix):.1f}  peak {np.abs(mix).max():.2f}')
    # loud enough for a phone speaker, never clipping: bring it to about -16 dBFS RMS through a look-ahead limiter
    from scipy.ndimage import maximum_filter1d, minimum_filter1d
    mix *= 10 ** ((-16.5 - db(mix)) / 20)
    env = maximum_filter1d(np.abs(mix).max(axis=1), size=int(0.006 * SR))
    gain = minimum_filter1d(np.minimum(1.0, 0.89 / np.maximum(env, 1e-9)), size=int(0.012 * SR))
    gain = np.minimum(gain, signal.sosfiltfilt(sos('lowpass', 12, 1), gain))
    mix *= gain[:, None]
    print(f'  limiter: max reduction {20 * np.log10(gain.min()):.1f} dB, final rms {db(mix):.1f} dBFS, peak {np.abs(mix).max():.2f}')
    mix = np.clip(mix, -0.98, 0.98)
    os.makedirs(os.path.join(ROOT, '.cache'), exist_ok=True); os.makedirs(os.path.join(ROOT, 'assets/audio'), exist_ok=True)
    wav = os.path.join(ROOT, '.cache', 'film.wav'); sf.write(wav, mix, SR)
    for stem, x in (('music', music), ('amb', amb), ('fx', fx)): sf.write(os.path.join(ROOT, '.cache', f'_{stem}.wav'), x, SR, subtype='FLOAT')
    mp3 = os.path.join(ROOT, 'assets/audio/film.mp3')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '192k', mp3], check=True)
    print('wrote', wav, 'and', mp3)

if __name__ == '__main__':
    main()
