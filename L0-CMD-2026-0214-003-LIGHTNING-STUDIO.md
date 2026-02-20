# L0 AUTHORITATIVE COMMAND — LIGHTNING STUDIO MUSIC KERNEL APP

---

| Field | Value |
|-------|-------|
| **Document ID** | `L0-CMD-2026-0214-003` |
| **Authority** | ARMAND LEFEBVRE — L0 HUMAN GOVERNANCE (ROOT) |
| **Target** | L2 UNTRUSTED PROPOSER (App Development Agent) |
| **Issued** | 2026-02-14 |
| **Expiry** | 2026-02-21T23:59:59Z |
| **Classification** | GREEDY EXECUTION — ONE-SHOT BUILD — 100% FUNCTIONAL |

---

## MISSION

Build **LIGHTNING STUDIO** — a fully functional, browser-based music production app that combines:
1. Song Brief Kernel (from Song Kernel v1 schema)
2. AI Lyric Generation (via Claude API)
3. Voice Recording + Playback
4. Beat/Instrumental Playback with vocal overlay
5. Voice Cloning pipeline integration
6. Full track assembly and export

All in ONE app. FREE. No external subscriptions required for core functionality.

## DELIVERABLE

Single-file React application. 100% functional. GREEDY. NO STUBS.

---

## SESSION LOG

### 2026-02-14 — Beat Kernel Integration + AI Beat Generator

#### L0-CMD-2026-0214-005 | Beat Kernel v1 + Song Kernel v1.1

**Status: COMPLETE**

Integrated Beat Kernel v1 and Song Kernel v1.1 schemas into Lightning Studio via the `@construction-dna/song-kernel` package in the construction_dna monorepo.

- Beat Engine (`BeatEngine.jsx`) — Full 16-step drum sequencer + melodic instruments with Web Audio API synthesis
- Beat Kernel JSON export/import — Complete beat DNA serialization (transport, drums, instruments, master FX)
- Song Kernel integration — Beat kernel cross-references in Production Genome export
- Presets: East Coast Classic, Trap Banger, Lo-Fi Chill, Drill, Boom Bap, Phonk
- Bounce to Studio — Render beat to audio buffer and send to recording studio

#### Beat Engine Transport: Separate STOP Button

**Status: COMPLETE**

Split the combined PLAY/STOP toggle into two dedicated buttons:
- **PLAY** (green) — Starts real-time beat playback, disabled when already playing
- **STOP** (red) — Halts playback and resets, disabled when nothing is playing

#### AI Beat Generator

**Status: COMPLETE**

Added AI-powered beat generation from natural language descriptions:
- Text input field in Beats tab (purple-themed UI)
- Calls Claude API (same key as lyrics) with a system prompt mapping to BeatEngine data structures
- Generates: drum patterns (16 steps + velocities), bass + melodic instrument notes, BPM, key, scale, beat name
- Example prompts: "dark trap with fast hi-hats and deep 808s", "chill lofi with jazzy piano"
- Output maps directly to drums[], instruments[], and transport state

### Commits (claude/lightning-studio-music-kernel-MKeUe)

```
b87009d feat: add separate STOP button and AI beat generation from description
```

---

### 2026-02-16 — Groove Physics Engine + Unified Displacement Kernel

#### L0-CMD-2026-0216-006-A | Groove Physics Engine Integration

**Status: COMPLETE**

Implemented the complete 5-layer Groove Physics Engine — a deterministic temporal topology engine that warps grid timing to create human feel across 12 genre presets.

**5-Layer Architecture:**
- Layer 1: Transport (BPM, swing, steps)
- Layer 2: Groove Field — basis functions (drag curves, log drift, velocity-phase coupling, macro-drift, harmonic gravity, tension state)
- Layer 3: Event Scheduler — groove pipeline orchestration
- Layer 4: Hardware Emulation — PPQN rounding (96 for MPC60/SP-1200)
- Layer 5: AudioWorklet — lo-fi signal chain (saturation, downsample, bit-crush, crackle)

**7 Amendment Categories (AC-01 through AC-07):**
- AC-01: Drag curve physics (power + logarithmic modes)
- AC-02: PPQN rounding placement (AFTER all timing warps)
- AC-03: Per-channel velocity variance + ghost notes
- AC-04: Velocity-phase coupling (Ω)
- AC-05: Harmonic gravity (Γ) — scale-mode-aware offset amplification
- AC-06: Macro-drift (Ψ) — inter-bar sinusoidal breathing
- AC-07: Phrase constraints (max phase error ceiling)

**12 Genre Presets:** Boom Bap, Neo-Soul/Dilla, G-Funk, Trap, Drill, Lo-Fi, Philly Soul, Cinematic, MPC60, SP-1200, Questlove Live, None (Grid)

**4 Invariants:** BOUNDED, BPM-SCALED, DETERMINISTIC, RESETTABLE

**Files Created:**
- `src/grooveField.js` — Layer 2 basis functions
- `src/grooveEngine.js` — Layer 3 event scheduler
- `src/hardwareEmulation.js` — Layer 4 PPQN rounding
- `src/grooveProfiles.js` — 12 genre presets
- `src/lofi-processor.worklet.js` — Layer 5 AudioWorklet
- `src/BeatEngine.jsx` — Modified for groove integration + UI panel

#### L0-CMD-2026-0216-007 | Unified Displacement Kernel

**Status: COMPLETE**

Replaced groove_type branching dispatch model with a single closed-form displacement equation. Style character now emerges entirely from coefficient values — zero conditional code paths.

**Unified Kernel Equation:**
```
T_final = Quantize_PPQN(T_grid + β·[Δ_L + Γ(m)·(Δ_C(n) + Ω(v)) + Ψ(b) + σ·G]·amount)
```

**Key Architectural Changes:**
- `computeGrooveDisplacement()` — pure function, zero branching, zero side effects
- `assembleGrooveContext()` — builds coefficient vector from profile + musical state
- `applyGroove()` refactored: context assembly → kernel evaluation → PPQN rounding
- All 3 groove_type conditionals eliminated from displacement pipeline
- PPQN rounding: coefficient-gated by ppqn value (ppqn=0 → no rounding)
- Jitter: coefficient-gated by jitter_ms > 0 (no groove_type check)
- Lo-fi worklet: coefficient-gated by dac_saturation.enabled
- UI panels always visible with own enabled toggles
- Default profile ppqn set to 0 (non-hardware profiles don't round)
- β (BPM scalar) applied ONCE in kernel; basis functions pass bpmScale=1
- Γ(m) scales ONLY elastic field (Δ_C + Ω), NOT linear offset (Δ_L) or macro-drift (Ψ)

**Deliverables:**
- D1: `src/grooveKernel.js` — Pure displacement kernel
- D2: `src/grooveEngine.js` — Refactored applyGroove() + assembleGrooveContext()
- D3: `src/BeatEngine.jsx` — Coefficient-gated worklet init + UI panels

**Engineering Rules (19–24):**
- Rule 19: Kernel is PURE — no mutation, no side effects
- Rule 20: ZERO groove_type conditionals inside kernel
- Rule 21: Γ(m) scales ONLY curvature + phase coupling
- Rule 22: β applied ONCE in kernel
- Rule 24: f(n,v) = Δ_C(n) + Ω(v) coupled before gravity

### Commits (claude/add-groove-physics-engine-0GiJk)

```
78808b1 feat: add Groove Physics Engine — deterministic temporal topology engine (L0-CMD-006-A)
5bb8f7e feat: implement Unified Displacement Kernel (L0-CMD-2026-0216-007)
```

---

### 2026-02-17 — Documentation Update

#### L0-CMD-2026-0217-008 | README + Session Log

**Status: COMPLETE**

- Created `README.md` with full project documentation including Groove Physics Engine architecture, unified kernel equation, 12 genre presets, coefficient-gated design, file manifest, and L0 command history
- Updated session log (`L0-CMD-2026-0214-003-LIGHTNING-STUDIO.md`) with CMD-006-A and CMD-007 entries

---

### 2026-02-20 — Groove Hash + Integrity Test Suite

#### L0-CMD-2026-0220-009 | Groove Hash (SHA-256 Beat Kernel Integrity)

**Status: COMPLETE**

Added deterministic SHA-256 integrity hashing to Beat Kernel export/import pipeline.

**Implementation:**
- `stableStringify()` — Deterministic JSON serialization (recursive key sorting, key-order-independent)
- `computeGrooveHash()` — SHA-256 via Web Crypto API (`crypto.subtle.digest`), returns 64-char lowercase hex
- Export: `groove_hash` field appended to Beat Kernel JSON alongside `randomization_seed`
- Import: Hash recomputed on load, mismatch triggers console warning (non-blocking)
- Graceful degradation: Missing `crypto.subtle` (non-HTTPS) logs warning, never halts execution

**Files Modified:**
- `src/grooveEngine.js` — Added `stableStringify()`, `computeGrooveHash()`, integrated into export/import

#### Groove Hash Test Suite (Vitest)

**Status: COMPLETE**

Added 7-assertion Vitest test suite verifying groove hash integrity pipeline.

**Test Coverage:**
- Exported JSON includes `groove_hash` as 64-char lowercase hex string
- Randomization seed included in export
- `stableStringify` produces deterministic output (key-order-independent)
- SHA-256 hash consistency (same input → same hash)
- Tamper detection (modified payload triggers mismatch warning)
- Key-order-independent hashing (`{a:1, b:2}` === `{b:2, a:1}`)
- Non-blocking behavior when `crypto.subtle` unavailable

**Files Created:**
- `src/grooveHash.test.js` — 175 lines, 7 Vitest assertions

### Commits (claude/add-groove-physics-engine-0GiJk)

```
8e09862 feat: add deterministic groove_hash (SHA-256) to Beat Kernel export/import
753bb5d test: add groove hash integrity verification test suite
```

---

### 2026-02-20 — Documentation Update

#### L0-CMD-2026-0220-010 | README + Session Log

**Status: COMPLETE**

- Updated `README.md` with groove hash feature, test suite section, updated tech stack (Vitest, Web Crypto), expanded file manifest
- Updated session log (`L0-CMD-2026-0214-003-LIGHTNING-STUDIO.md`) with CMD-009 and CMD-010 entries

---

**AUTHORIZATION: ARMAND LEFEBVRE — L0 ROOT — EXECUTE IMMEDIATELY**
