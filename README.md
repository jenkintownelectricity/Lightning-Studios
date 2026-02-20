# Lightning Studio

Browser-based music production app. Vite + React. Web Audio API synthesis. Zero external subscriptions.

## Features

- **16-Step Drum Sequencer** — Kick, snare, hi-hat, clap, rim, tom, crash with per-step velocity
- **Melodic Instruments** — Bass, piano, strings, lead, pluck with Web Audio synthesis
- **Groove Physics Engine** — Deterministic temporal topology engine (see below)
- **AI Beat Generator** — Natural language to beat pattern via Claude API
- **Beat Kernel JSON** — Full beat DNA serialization (transport, drums, instruments, master FX) with SHA-256 integrity hash
- **Groove Hash** — Deterministic SHA-256 fingerprint for Beat Kernel exports (tamper detection, key-order-independent)
- **Song Kernel Integration** — Beat kernel cross-references in Production Genome export
- **Master Effects** — Compressor, EQ, reverb, delay, stereo width, limiter
- **Bounce to WAV** — Offline render with groove physics applied
- **Beat Presets** — East Coast Classic, Trap Banger, Lo-Fi Chill, Drill, Boom Bap, Phonk

## Quick Start

```bash
npm install
npm run dev        # Development server
npm run build      # Production build
npm run preview    # Preview production build
npm run test       # Run Vitest test suite
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 18 (single-file component) |
| Build | Vite 5 |
| Testing | Vitest 4.0 |
| Audio | Web Audio API + AudioWorklet |
| Synthesis | Oscillator-based (no samples) |
| Hashing | Web Crypto API (SHA-256 via `crypto.subtle.digest`) |
| State | React hooks (useState, useRef, useCallback) |

---

## Groove Physics Engine

Deterministic temporal topology engine that warps grid timing to create human feel. Every note's timing, velocity, and playback decision flows through a unified mathematical displacement kernel.

### Architecture — 5 Layers

```
Layer 1: Transport          BPM, swing, steps_per_pattern
    |
Layer 2: Groove Field       Basis functions (drag curves, log drift,
    |                       velocity-phase coupling, macro-drift,
    |                       harmonic gravity, tension state)
    |
Layer 3: Event Scheduler    Unified Displacement Kernel (fΔ)
    |                       Context assembly + pure kernel evaluation
    |
Layer 4: Hardware Emulation PPQN rounding (96 for MPC60, 480 for modern)
    |                       Coefficient-gated by ppqn value
    |
Layer 5: AudioWorklet       Lo-fi signal chain (saturation, downsample,
                            bit-crush, crackle)
```

### Unified Displacement Kernel

Single closed-form equation. Zero branching on groove type. Style character emerges from coefficient values alone.

```
T_final = Quantize_PPQN(
  T_grid + β · [ Δ_L + Γ(m) · ( Δ_C(n) + Ω(v) ) + Ψ(b) + σ·G ] · amount
)
```

| Symbol | Name | Description |
|--------|------|-------------|
| β | BPM scalar | `90 / BPM` — applied once in kernel |
| Δ_L | Linear offset | Per-channel constant displacement (ms) |
| Δ_C(n) | Curvature | Topological drag curve at step n |
| Ω(v) | Phase coupling | Velocity-phase coupling term |
| Γ(m) | Harmonic gravity | Scale-mode multiplier (scales elastic field ONLY) |
| Ψ(b) | Macro-drift | Inter-bar sinusoidal breathing |
| σ·G | Jitter | Gaussian noise (seeded PRNG) |
| amount | Groove amount | Global displacement scaling (0.0–1.0) |

### Coefficient-Gated Design

No `groove_type` conditional branching in the displacement pipeline. Features activate based on coefficient values:

| Feature | Activation Condition |
|---------|---------------------|
| Drag curves | `drag_curve.enabled = true` |
| Velocity-phase coupling | `temporal_coupling.enabled = true` |
| Harmonic gravity | `harmonic_gravity.enabled = true` |
| Macro-drift | `macro_drift.enabled = true` |
| Stochastic jitter | `channel.jitter_ms > 0` |
| PPQN rounding | `hardware_emulation.ppqn > 0` |
| Lo-fi signal chain | `dac_saturation.enabled = true` |

### 4 Invariant Properties

1. **BOUNDED** — Every displacement has a hard ceiling (feel bias + phrase constraints)
2. **BPM-SCALED** — All timing values scale by β = 90/BPM
3. **DETERMINISTIC** — Seeded PRNG (Mulberry32) only. No `Math.random()`. Same seed = same output.
4. **RESETTABLE** — Accumulated drift resets at phrase boundary

### 12 Genre Presets

| Preset | BPM Range | Character |
|--------|-----------|-----------|
| Boom Bap | 88–96 | Laid-back snare, pushed kick. Classic 90s NYC. |
| Neo-Soul / Dilla | 68–85 | Power-curve drag. Elastic "drunk drums" feel. |
| G-Funk | 88–100 | Smooth and bouncy. Light hat push, gentle snare drag. |
| Trap | 130–160 | Tight, on-top. Minimal displacement at high BPM. |
| Drill | 135–150 | Aggressive, tight. Pattern IS the groove. |
| Lo-Fi | 70–85 | Soft drag + dreamy warp. "Studying beats" feel. |
| Philly Soul | 85–95 | Warm, live-feel. Snare sits back, hats push forward. |
| Cinematic | 80–90 | Very subtle displacement. Serves the drama. |
| MPC60 | 88–96 | 96 PPQN rounding + DAC saturation. Chunky, stiff. |
| SP-1200 | 85–100 | Crunchier than MPC60. Lower sample rate, more grit. |
| Questlove Live | 90–110 | Gaussian jitter. "Live human" rushing and dragging. |
| None (Grid) | Any | Pure grid timing. Zero displacement. |

### File Manifest

```
src/
  grooveKernel.js            Pure displacement kernel (fΔ) — zero branching
  grooveEngine.js            Context assembly + applyGroove() scheduler + SHA-256 groove hash
  grooveField.js             Layer 2 basis functions (drag, drift, coupling, gravity)
  hardwareEmulation.js       Layer 4 PPQN rounding + hardware presets
  grooveProfiles.js          12 genre-specific coefficient profiles
  lofi-processor.worklet.js  Layer 5 AudioWorklet (bit-crush, downsample, saturation)
  BeatEngine.jsx             Main React component (sequencer, synthesis, UI, groove integration)
  grooveHash.test.js         Vitest suite — groove hash integrity verification (7 tests)
```

---

## Groove Hash — Beat Kernel Integrity

SHA-256 fingerprint embedded in every Beat Kernel export. Enables tamper detection on import.

### How It Works

1. **Export** — `computeGrooveHash()` serializes the Beat Kernel via `stableStringify()` (deterministic key ordering), hashes with SHA-256 via Web Crypto, and stores the 64-char hex digest as `groove_hash`
2. **Import** — On load, the hash is recomputed and compared. Mismatch triggers a console warning (non-blocking)
3. **Determinism** — Key-order-independent: `{a:1, b:2}` and `{b:2, a:1}` produce identical hashes
4. **Graceful degradation** — If `crypto.subtle` is unavailable (e.g., non-HTTPS), hashing is skipped with a warning. Never halts execution.

### Test Suite

`src/grooveHash.test.js` — 7 Vitest assertions:

| Test | Verifies |
|------|----------|
| Export includes `groove_hash` | 64-char lowercase hex string present |
| Randomization seed included | `randomization_seed` field in export |
| `stableStringify` determinism | Key-order-independent serialization |
| SHA-256 consistency | Same input always produces same hash |
| Tamper detection | Modified payload triggers mismatch warning |
| Key-order independence | Reordered objects hash identically |
| Non-blocking on missing crypto | Logs warning, never throws |

```bash
npm run test    # Run full suite
```

---

## L0 Command History

| Command | Date | Description |
|---------|------|-------------|
| L0-CMD-2026-0214-003 | 2026-02-14 | Lightning Studio — initial app build |
| L0-CMD-2026-0214-005 | 2026-02-14 | Beat Kernel v1 + Song Kernel v1.1 integration |
| L0-CMD-2026-0216-006-A | 2026-02-16 | Groove Physics Engine — 5-layer architecture, 7 errata |
| L0-CMD-2026-0216-007 | 2026-02-16 | Unified Displacement Kernel — eliminate groove_type branching |
| L0-CMD-2026-0217-008 | 2026-02-17 | Documentation update (this README + session log) |
| L0-CMD-2026-0220-009 | 2026-02-20 | Groove Hash (SHA-256) + integrity test suite |
| L0-CMD-2026-0220-010 | 2026-02-20 | Documentation update (README + session log for groove hash) |

## License

Private. Armand Lefebvre / Lightning Studios.
