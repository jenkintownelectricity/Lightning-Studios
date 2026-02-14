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

**AUTHORIZATION: ARMAND LEFEBVRE — L0 ROOT — EXECUTE IMMEDIATELY**
