// ═══════════════════════════════════════════════════════════
// GROOVE PROFILES — Genre-Specific Temporal Topology Presets
// L0-CMD-2026-0216-006-A
// ═══════════════════════════════════════════════════════════
//
// Each profile defines the complete temporal displacement field
// for a specific genre. The Beat Kernel (CMD-005) stores WHAT
// plays. The Groove Profile stores HOW time is warped.
//
// All profiles respect the four invariant properties:
//   1. BOUNDED — every offset has a hard ceiling
//   2. BPM-SCALED — every timing value scales by (90 / current_bpm)
//   3. DETERMINISTIC — seeded PRNG only, no Math.random()
//   4. RESETTABLE — accumulated drift resets at phrase boundary

import { createDefaultGrooveProfile } from './grooveEngine.js';

/**
 * Boom Bap — East Coast, 88-96 BPM
 * Linear groove type with laid-back snare, pushed kick.
 * Classic 90s NYC production feel.
 */
export function grooveBoomBap(bpm = 90) {
  const p = createDefaultGrooveProfile(bpm);
  p.groove_type = 'linear';
  p.feel_bias = 'laid_back';
  p.groove_amount = 0.85;

  p.channel_offsets = {
    kick:  { timing_offset_ms: -2, velocity_variance: 0.03, jitter_ms: 0, ghost_note_probability: 0 },
    snare: { timing_offset_ms: 8, velocity_variance: 0.05, jitter_ms: 0, ghost_note_probability: 0.05 },
    hihat: { timing_offset_ms: -3, velocity_variance: 0.08, jitter_ms: 1, ghost_note_probability: 0 },
    bass:  { timing_offset_ms: 0, velocity_variance: 0.03, jitter_ms: 0, ghost_note_probability: 0, ghost_note_attenuation_db: -10 },
    keys:  { timing_offset_ms: 2, velocity_variance: 0.04, jitter_ms: 0, ghost_note_probability: 0 },
  };

  p.temporal_coupling = { enabled: true, velocity_phase_ratio: -0.8, direction: 'natural' };
  p.randomization_seed = 1990;
  return p;
}

/**
 * Neo-Soul / Dilla — 68-85 BPM
 * Curved groove type with power-curve drag.
 * The canonical "drunk drums" / elastic time feel.
 */
export function grooveNeoSoul(bpm = 75) {
  const p = createDefaultGrooveProfile(bpm);
  p.groove_type = 'curved';
  p.feel_bias = 'deep_pocket';
  p.groove_amount = 0.9;

  p.channel_offsets = {
    kick:  { timing_offset_ms: 0, velocity_variance: 0.04, jitter_ms: 0, ghost_note_probability: 0 },
    snare: { timing_offset_ms: 12, velocity_variance: 0.08, jitter_ms: 0, ghost_note_probability: 0.08, ghost_note_attenuation_db: -14 },
    hihat: { timing_offset_ms: -4, velocity_variance: 0.12, jitter_ms: 2, ghost_note_probability: 0 },
    bass:  { timing_offset_ms: 6, velocity_variance: 0.05, jitter_ms: 0, ghost_note_probability: 0 },
    keys:  { timing_offset_ms: 4, velocity_variance: 0.06, jitter_ms: 1, ghost_note_probability: 0 },
  };

  p.drag_curve = {
    enabled: true,
    drift_mode: 'power',
    max_drag_ms: 28,
    drag_exponent: 1.25,
    snap_mode: 'hard',
    log_k: 4,
    per_channel_scaling: {
      snare: 1.0,
      hihat: 0.35,
      kick: 0.0,
      bass: 0.7,
      keys: 0.5,
    },
  };

  p.temporal_coupling = { enabled: true, velocity_phase_ratio: -1.5, direction: 'natural' };
  p.harmonic_gravity = {
    enabled: true,
    gravity_by_mode: {
      major: 1.0, minor: 1.15, dorian: 1.10, phrygian: 1.25,
      mixolydian: 1.05, blues: 1.10, pentatonic: 1.0, chromatic: 1.0,
    },
  };
  p.macro_drift = { enabled: true, amplitude_ms: 8, period_bars: 8, waveform: 'sine' };
  p.randomization_seed = 1974;
  return p;
}

/**
 * G-Funk — West Coast, 88-100 BPM
 * Linear groove type, smooth and bouncy.
 * Light push on hats, gentle snare drag.
 */
export function grooveGFunk(bpm = 92) {
  const p = createDefaultGrooveProfile(bpm);
  p.groove_type = 'linear';
  p.feel_bias = 'laid_back';
  p.groove_amount = 0.7;

  p.channel_offsets = {
    kick:  { timing_offset_ms: -1, velocity_variance: 0.02, jitter_ms: 0, ghost_note_probability: 0 },
    snare: { timing_offset_ms: 6, velocity_variance: 0.04, jitter_ms: 0, ghost_note_probability: 0.03 },
    hihat: { timing_offset_ms: -2, velocity_variance: 0.06, jitter_ms: 0.5, ghost_note_probability: 0 },
    bass:  { timing_offset_ms: 1, velocity_variance: 0.03, jitter_ms: 0, ghost_note_probability: 0 },
    keys:  { timing_offset_ms: 3, velocity_variance: 0.03, jitter_ms: 0, ghost_note_probability: 0 },
  };

  p.temporal_coupling = { enabled: true, velocity_phase_ratio: -0.5, direction: 'natural' };
  p.randomization_seed = 1992;
  return p;
}

/**
 * Trap — Modern, 130-160 BPM
 * Linear, tight, on-top feel.
 * Very little displacement — precision matters at high BPM.
 */
export function grooveTrap(bpm = 140) {
  const p = createDefaultGrooveProfile(bpm);
  p.groove_type = 'linear';
  p.feel_bias = 'on_top';
  p.groove_amount = 0.4;

  p.channel_offsets = {
    kick:  { timing_offset_ms: 0, velocity_variance: 0.02, jitter_ms: 0, ghost_note_probability: 0 },
    snare: { timing_offset_ms: 0, velocity_variance: 0.03, jitter_ms: 0, ghost_note_probability: 0 },
    hihat: { timing_offset_ms: -1, velocity_variance: 0.15, jitter_ms: 0.5, ghost_note_probability: 0 },
    bass:  { timing_offset_ms: 0, velocity_variance: 0.02, jitter_ms: 0, ghost_note_probability: 0 },
    keys:  { timing_offset_ms: 0, velocity_variance: 0.02, jitter_ms: 0, ghost_note_probability: 0 },
  };

  p.randomization_seed = 2012;
  return p;
}

/**
 * Drill — UK/NY, 135-150 BPM
 * Linear, aggressive, tight timing.
 * Minimal groove — the pattern IS the groove.
 */
export function grooveDrill(bpm = 145) {
  const p = createDefaultGrooveProfile(bpm);
  p.groove_type = 'linear';
  p.feel_bias = 'on_top';
  p.groove_amount = 0.3;

  p.channel_offsets = {
    kick:  { timing_offset_ms: 0, velocity_variance: 0.02, jitter_ms: 0, ghost_note_probability: 0 },
    snare: { timing_offset_ms: 1, velocity_variance: 0.03, jitter_ms: 0, ghost_note_probability: 0 },
    hihat: { timing_offset_ms: -1, velocity_variance: 0.10, jitter_ms: 0.3, ghost_note_probability: 0 },
    bass:  { timing_offset_ms: 0, velocity_variance: 0.02, jitter_ms: 0, ghost_note_probability: 0 },
    keys:  { timing_offset_ms: 0, velocity_variance: 0.02, jitter_ms: 0, ghost_note_probability: 0 },
  };

  p.randomization_seed = 2015;
  return p;
}

/**
 * Lo-Fi Hip Hop — 70-85 BPM
 * Curved groove type with soft drag + hardware emulation.
 * Dreamy, warped, "studying beats" feel.
 */
export function grooveLofi(bpm = 75) {
  const p = createDefaultGrooveProfile(bpm);
  p.groove_type = 'curved';
  p.feel_bias = 'deep_pocket';
  p.groove_amount = 0.85;

  p.channel_offsets = {
    kick:  { timing_offset_ms: 0, velocity_variance: 0.05, jitter_ms: 0, ghost_note_probability: 0 },
    snare: { timing_offset_ms: 10, velocity_variance: 0.10, jitter_ms: 0, ghost_note_probability: 0.10, ghost_note_attenuation_db: -10 },
    hihat: { timing_offset_ms: -3, velocity_variance: 0.12, jitter_ms: 2, ghost_note_probability: 0 },
    bass:  { timing_offset_ms: 4, velocity_variance: 0.04, jitter_ms: 0, ghost_note_probability: 0 },
    keys:  { timing_offset_ms: 5, velocity_variance: 0.08, jitter_ms: 1, ghost_note_probability: 0 },
  };

  p.drag_curve = {
    enabled: true,
    drift_mode: 'power',
    max_drag_ms: 22,
    drag_exponent: 1.2,
    snap_mode: 'hard',
    log_k: 4,
    per_channel_scaling: {
      snare: 1.0,
      hihat: 0.4,
      kick: 0.05,
      bass: 0.6,
      keys: 0.5,
    },
  };

  p.temporal_coupling = { enabled: true, velocity_phase_ratio: -1.0, direction: 'natural' };
  p.harmonic_gravity = {
    enabled: true,
    gravity_by_mode: {
      major: 1.0, minor: 1.15, dorian: 1.10, phrygian: 1.25,
      mixolydian: 1.05, blues: 1.10, pentatonic: 1.0, chromatic: 1.0,
    },
  };
  p.macro_drift = { enabled: true, amplitude_ms: 6, period_bars: 4, waveform: 'sine' };
  p.randomization_seed = 2016;
  return p;
}

/**
 * Philly Soul — Philadelphia, 85-95 BPM
 * Linear groove with warm, live-feel displacement.
 * Snare sits back, hats push slightly forward.
 */
export function groovePhilly(bpm = 88) {
  const p = createDefaultGrooveProfile(bpm);
  p.groove_type = 'linear';
  p.feel_bias = 'laid_back';
  p.groove_amount = 0.8;

  p.channel_offsets = {
    kick:  { timing_offset_ms: -1, velocity_variance: 0.04, jitter_ms: 0, ghost_note_probability: 0 },
    snare: { timing_offset_ms: 7, velocity_variance: 0.06, jitter_ms: 0, ghost_note_probability: 0.06, ghost_note_attenuation_db: -12 },
    hihat: { timing_offset_ms: -2, velocity_variance: 0.08, jitter_ms: 1, ghost_note_probability: 0 },
    bass:  { timing_offset_ms: 2, velocity_variance: 0.03, jitter_ms: 0, ghost_note_probability: 0 },
    keys:  { timing_offset_ms: 3, velocity_variance: 0.04, jitter_ms: 0.5, ghost_note_probability: 0 },
  };

  p.temporal_coupling = { enabled: true, velocity_phase_ratio: -0.8, direction: 'natural' };
  p.randomization_seed = 1971;
  return p;
}

/**
 * Cinematic — Dark, moody, 80-90 BPM
 * Linear groove with very subtle displacement.
 * Serves the drama, not the groove.
 */
export function grooveCinematic(bpm = 85) {
  const p = createDefaultGrooveProfile(bpm);
  p.groove_type = 'linear';
  p.feel_bias = 'laid_back';
  p.groove_amount = 0.5;

  p.channel_offsets = {
    kick:  { timing_offset_ms: 0, velocity_variance: 0.02, jitter_ms: 0, ghost_note_probability: 0 },
    snare: { timing_offset_ms: 3, velocity_variance: 0.04, jitter_ms: 0, ghost_note_probability: 0 },
    hihat: { timing_offset_ms: -1, velocity_variance: 0.05, jitter_ms: 0.5, ghost_note_probability: 0 },
    bass:  { timing_offset_ms: 0, velocity_variance: 0.02, jitter_ms: 0, ghost_note_probability: 0 },
    keys:  { timing_offset_ms: 1, velocity_variance: 0.03, jitter_ms: 0, ghost_note_probability: 0 },
  };

  p.randomization_seed = 2001;
  return p;
}

/**
 * MPC60 Hardware — Hardware-emulated, 88-96 BPM
 * Hardware-emulated groove type with 96 PPQN rounding.
 * The chunky, stiff timing of the Akai MPC60.
 */
export function grooveMPC60(bpm = 94) {
  const p = createDefaultGrooveProfile(bpm);
  p.groove_type = 'hardware_emulated';
  p.feel_bias = 'laid_back';
  p.groove_amount = 0.9;

  p.channel_offsets = {
    kick:  { timing_offset_ms: -1, velocity_variance: 0.03, jitter_ms: 0, ghost_note_probability: 0 },
    snare: { timing_offset_ms: 8, velocity_variance: 0.06, jitter_ms: 0, ghost_note_probability: 0.05, ghost_note_attenuation_db: -10 },
    hihat: { timing_offset_ms: -3, velocity_variance: 0.10, jitter_ms: 1, ghost_note_probability: 0 },
    bass:  { timing_offset_ms: 2, velocity_variance: 0.03, jitter_ms: 0, ghost_note_probability: 0 },
    keys:  { timing_offset_ms: 3, velocity_variance: 0.04, jitter_ms: 0, ghost_note_probability: 0 },
  };

  p.hardware_emulation = {
    ppqn: 96,
    signal_chain_order: 'saturate_downsample_quantize',
    dac_saturation: { enabled: true, curve: 'tanh', gain: 1.2 },
    anti_alias_filter: { type: 'chebyshev_type1', cutoff_hz: 18000, ripple_db: 0.5 },
    sample_rate: 26040,
    bit_depth: 12,
  };

  p.temporal_coupling = { enabled: true, velocity_phase_ratio: -1.0, direction: 'natural' };
  p.randomization_seed = 1988;
  return p;
}

/**
 * SP-1200 Hardware — Hardware-emulated, 85-100 BPM
 * Crunchier, grittier than MPC60. Lower sample rate, more saturation.
 */
export function grooveSP1200(bpm = 90) {
  const p = createDefaultGrooveProfile(bpm);
  p.groove_type = 'hardware_emulated';
  p.feel_bias = 'laid_back';
  p.groove_amount = 0.95;

  p.channel_offsets = {
    kick:  { timing_offset_ms: -2, velocity_variance: 0.04, jitter_ms: 0, ghost_note_probability: 0 },
    snare: { timing_offset_ms: 10, velocity_variance: 0.08, jitter_ms: 0, ghost_note_probability: 0.06, ghost_note_attenuation_db: -10 },
    hihat: { timing_offset_ms: -4, velocity_variance: 0.12, jitter_ms: 1.5, ghost_note_probability: 0 },
    bass:  { timing_offset_ms: 3, velocity_variance: 0.04, jitter_ms: 0, ghost_note_probability: 0 },
    keys:  { timing_offset_ms: 4, velocity_variance: 0.05, jitter_ms: 0, ghost_note_probability: 0 },
  };

  p.hardware_emulation = {
    ppqn: 96,
    signal_chain_order: 'saturate_downsample_quantize',
    dac_saturation: { enabled: true, curve: 'tanh', gain: 1.4 },
    anti_alias_filter: { type: 'chebyshev_type1', cutoff_hz: 12000, ripple_db: 1.0 },
    sample_rate: 26040,
    bit_depth: 12,
  };

  p.temporal_coupling = { enabled: true, velocity_phase_ratio: -1.2, direction: 'natural' };
  p.randomization_seed = 1987;
  return p;
}

/**
 * Questlove Live — Stochastic, 90-110 BPM
 * Stochastic groove type with Gaussian jitter.
 * The "live human" feel — rushing and dragging unpredictably.
 */
export function grooveQuestlove(bpm = 100) {
  const p = createDefaultGrooveProfile(bpm);
  p.groove_type = 'stochastic';
  p.feel_bias = 'laid_back';
  p.groove_amount = 0.8;

  p.channel_offsets = {
    kick:  { timing_offset_ms: 0, velocity_variance: 0.06, jitter_ms: 2, ghost_note_probability: 0 },
    snare: { timing_offset_ms: 5, velocity_variance: 0.10, jitter_ms: 4, ghost_note_probability: 0.08, ghost_note_attenuation_db: -14 },
    hihat: { timing_offset_ms: -2, velocity_variance: 0.15, jitter_ms: 3, ghost_note_probability: 0 },
    bass:  { timing_offset_ms: 1, velocity_variance: 0.05, jitter_ms: 1.5, ghost_note_probability: 0 },
    keys:  { timing_offset_ms: 2, velocity_variance: 0.06, jitter_ms: 2, ghost_note_probability: 0 },
  };

  p.macro_drift = { enabled: true, amplitude_ms: 15, period_bars: 6, waveform: 'triangle' };
  p.temporal_coupling = { enabled: true, velocity_phase_ratio: -1.5, direction: 'natural' };
  p.harmonic_gravity = {
    enabled: true,
    gravity_by_mode: {
      major: 1.0, minor: 1.15, dorian: 1.10, phrygian: 1.25,
      mixolydian: 1.05, blues: 1.10, pentatonic: 1.0, chromatic: 1.0,
    },
  };
  p.randomization_seed = 1971;
  return p;
}

/**
 * Maps preset function names to groove profile factories.
 * Used for associating beat presets with groove presets.
 */
export const GROOVE_PRESET_MAP = {
  'Boom-Bap Classic': grooveBoomBap,
  'Trap Standard': grooveTrap,
  'Drill Pattern': grooveDrill,
  'Lo-Fi Chill': grooveLofi,
  'Philly Boom': groovePhilly,
  'Cinematic Dark': grooveCinematic,
};

/**
 * All available groove presets with labels.
 */
export const GROOVE_PRESETS = [
  { label: 'None (Grid)', factory: (bpm) => createDefaultGrooveProfile(bpm) },
  { label: 'Boom Bap', factory: grooveBoomBap },
  { label: 'Neo-Soul / Dilla', factory: grooveNeoSoul },
  { label: 'G-Funk', factory: grooveGFunk },
  { label: 'Trap', factory: grooveTrap },
  { label: 'Drill', factory: grooveDrill },
  { label: 'Lo-Fi', factory: grooveLofi },
  { label: 'Philly Soul', factory: groovePhilly },
  { label: 'Cinematic', factory: grooveCinematic },
  { label: 'MPC60', factory: grooveMPC60 },
  { label: 'SP-1200', factory: grooveSP1200 },
  { label: 'Questlove Live', factory: grooveQuestlove },
];
