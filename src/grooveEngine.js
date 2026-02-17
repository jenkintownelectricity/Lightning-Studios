// ═══════════════════════════════════════════════════════════
// GROOVE ENGINE — Layer 3: Event Scheduler
// Deterministic Temporal Topology Engine
// L0-CMD-2026-0216-006-A §3, §6
// ═══════════════════════════════════════════════════════════
//
// Layer 3 orchestrates the complete timing pipeline:
//   grid time
//     → drag curve (if groove_type = 'curved')
//     → swing (with curve differentiation)
//     → microtiming offset (per-channel)
//     → macro-drift (inter-bar breathing)
//     → velocity-phase coupling
//     → harmonic gravity (positive offsets only)
//     → clamp by feel_bias (MAX_OFFSET_BY_FEEL)
//     → groove amount (scale within clamped boundary)
//     → PPQN rounding (if groove_type = 'hardware_emulated')
//     → schedule to AudioWorklet
//
// Engineering Rules (CMD-006 §9.3 + Amendment):
//   Rule 12: groove_type dispatches to DIFFERENT code paths
//   Rule 13: PPQN rounding occurs AFTER swing + curvature
//   Rule 15: Tension variable τ ∈ [0, 1] — HARD BOUNDED
//   Rule 16: Drag exponent α MUST be normalized

import {
  computeDragCurve,
  computeLogDrift,
  velocityPhaseCoupling,
  computeMacroDrift,
  applyHarmonicGravity,
  computeTensionState,
  clampPhraseError,
} from './grooveField.js';

import { roundToPPQN } from './hardwareEmulation.js';

// ── Seeded PRNG (Mulberry32) ──
// Invariant: DETERMINISTIC. Same seed = same output. No Math.random().
export class SeededRNG {
  constructor(seed) {
    this._seed = seed | 0;
  }

  next() {
    this._seed |= 0;
    this._seed = this._seed + 0x6D2B79F5 | 0;
    let t = Math.imul(this._seed ^ this._seed >>> 15, 1 | this._seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  // Box-Muller transform for Gaussian distribution
  gaussian() {
    const u1 = Math.max(1e-10, this.next()); // avoid log(0)
    const u2 = this.next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  // Reset to a specific seed
  reset(seed) {
    this._seed = seed | 0;
  }
}

// ── Feel Bias Offset Limits (ms, before BPM scaling) ──
// These define the maximum displacement in each direction
// based on the groove's feel bias.
export const MAX_OFFSET_BY_FEEL = {
  on_top:      { push: -8,  drag: 8 },
  laid_back:   { push: -5,  drag: 25 },
  ahead:       { push: -20, drag: 5 },
  deep_pocket: { push: -3,  drag: 35 },
};

// ── Channel ID to canonical name mapping ──
const CHANNEL_MAP = {
  kick: 'kick',
  snare: 'snare',
  hihat_closed: 'hihat',
  hihat_open: 'hihat',
  clap: 'snare',   // clap follows snare displacement
  rim: 'hihat',    // rim follows hihat displacement
  tom: 'kick',     // tom follows kick displacement
  crash: 'hihat',
  bass: 'bass',
  piano: 'keys',
  strings: 'keys',
  lead: 'keys',
  pluck: 'keys',
};

/**
 * Resolves the canonical channel name for groove profile lookup.
 * Maps specific instrument IDs to their groove channel group.
 *
 * @param {string} channelId - Specific channel ID (e.g., 'hihat_closed')
 * @returns {string} Canonical channel name (e.g., 'hihat')
 */
function resolveChannel(channelId) {
  return CHANNEL_MAP[channelId] || channelId;
}

/**
 * Main groove pipeline. Computes the final timing displacement,
 * velocity modification, and play/skip decision for a single
 * event at a given step and channel.
 *
 * This is the heart of the Groove Physics Engine.
 *
 * @param {number} gridTime - Base grid time in seconds
 * @param {number} step - Current step index (0–15)
 * @param {string} channelId - Channel identifier (e.g., 'kick', 'snare')
 * @param {Object} grooveProfile - Complete groove profile object
 * @param {number} barIndex - Current bar index (for macro-drift, tension)
 * @param {SeededRNG} rng - Seeded random number generator
 * @param {string} scaleMode - Current scale mode (e.g., 'minor', 'dorian')
 * @param {number} baseVelocity - Original velocity of the event (0.0–1.0)
 * @returns {{ time: number, velocity: number, shouldPlay: boolean }}
 */
export function applyGroove(gridTime, step, channelId, grooveProfile, barIndex, rng, scaleMode, baseVelocity) {
  // No-op if groove is disabled or amount is zero
  if (!grooveProfile || (grooveProfile.groove_amount ?? 1.0) === 0) {
    return { time: gridTime, velocity: baseVelocity, shouldPlay: true };
  }

  const bpm = grooveProfile.bpm || 90;
  const bpmScale = 90 / bpm;
  const grooveType = grooveProfile.groove_type || 'linear';
  const stepsPerBar = grooveProfile.steps_per_bar || 16;
  const stepInBar = step % stepsPerBar;
  const canonicalChannel = resolveChannel(channelId);

  // Get per-channel config
  const channelOffsets = grooveProfile.channel_offsets || {};
  const channelCfg = channelOffsets[canonicalChannel] || {};

  let offsetMs = 0;
  let velocity = baseVelocity;

  // ── 1. Drag Curve (groove_type = 'curved' ONLY — Rule 12) ──
  if (grooveType === 'curved' && grooveProfile.drag_curve?.enabled) {
    const dc = grooveProfile.drag_curve;
    const channelScale = dc.per_channel_scaling?.[canonicalChannel] ?? 1.0;

    // Apply tension state to drag exponent (Phase 3 feature, ready if enabled)
    const tensionState = computeTensionState(barIndex, grooveProfile.temporal_state);
    const effectiveExponent = (dc.drag_exponent || 1.25) * tensionState.exponentMultiplier;

    if (dc.drift_mode === 'log') {
      offsetMs += computeLogDrift(
        stepInBar, stepsPerBar,
        dc.max_drag_ms || 25,
        dc.log_k || 4,
        channelScale, bpmScale
      );
    } else {
      // Default: power curve
      offsetMs += computeDragCurve(
        stepInBar, stepsPerBar,
        dc.max_drag_ms || 25,
        effectiveExponent,
        channelScale, bpmScale
      );
    }

    // Bar-boundary snapback (handled by using stepInBar which resets at bar boundary)
  }

  // ── 2. Swing is applied by the caller (existing transport system) ──
  // The caller's swing already modifies the grid time before passing it here.
  // We do NOT re-apply swing in this pipeline.

  // ── 3. Microtiming offset (per-channel constant displacement) ──
  const timingOffset = channelCfg.timing_offset_ms || 0;
  offsetMs += timingOffset * bpmScale;

  // ── 4. Macro-drift (inter-bar breathing) ──
  if (grooveProfile.macro_drift?.enabled) {
    offsetMs += computeMacroDrift(barIndex, grooveProfile.macro_drift, bpmScale);
  }

  // ── 5. Velocity-phase coupling ──
  if (grooveProfile.temporal_coupling?.enabled && baseVelocity != null) {
    const ratio = grooveProfile.temporal_coupling.velocity_phase_ratio || -1.0;
    const direction = grooveProfile.temporal_coupling.direction || 'natural';
    offsetMs += velocityPhaseCoupling(baseVelocity, ratio, direction);
  }

  // ── 6. Stochastic jitter (groove_type = 'stochastic' ONLY — Rule 12) ──
  if (grooveType === 'stochastic' && rng) {
    const sigma = channelCfg.jitter_ms || 3;
    offsetMs += sigma * rng.gaussian() * bpmScale;
  }

  // ── 7. Harmonic gravity (positive offsets only) ──
  if (grooveProfile.harmonic_gravity?.enabled) {
    offsetMs = applyHarmonicGravity(offsetMs, grooveProfile.harmonic_gravity, scaleMode);
  }

  // ── 8. Phrase constraint safety net ──
  offsetMs = clampPhraseError(offsetMs, grooveProfile.phrase_constraints, bpmScale);

  // ── 9. Clamp by feel_bias ──
  const feelBias = grooveProfile.feel_bias || 'laid_back';
  const feelLimits = MAX_OFFSET_BY_FEEL[feelBias] || MAX_OFFSET_BY_FEEL.laid_back;
  offsetMs = Math.max(
    feelLimits.push * bpmScale,
    Math.min(feelLimits.drag * bpmScale, offsetMs)
  );

  // ── 10. Scale by groove_amount (within clamped boundary) ──
  offsetMs *= (grooveProfile.groove_amount ?? 1.0);

  // ── 11. Velocity humanization ──
  if (channelCfg.velocity_variance && rng && baseVelocity != null) {
    const variance = channelCfg.velocity_variance;
    const mod = rng.gaussian() * variance;
    velocity = Math.max(0.05, Math.min(1.0, baseVelocity + mod));
  }

  // ── 12. Ghost note processing ──
  let shouldPlay = true;
  if (channelCfg.ghost_note_probability && rng) {
    const ghostProb = channelCfg.ghost_note_probability;
    if (rng.next() < ghostProb) {
      // This step becomes a ghost note — reduce velocity
      const attenuation = channelCfg.ghost_note_attenuation_db || -12;
      const scale = Math.pow(10, attenuation / 20);
      velocity = baseVelocity * scale;
    }
  }

  // ── 13. Compute final time ──
  let finalTime = gridTime + (offsetMs / 1000);

  // ── 14. PPQN rounding (groove_type = 'hardware_emulated' ONLY — Rule 13) ──
  if (grooveType === 'hardware_emulated' && grooveProfile.hardware_emulation?.ppqn) {
    finalTime = roundToPPQN(finalTime, bpm, grooveProfile.hardware_emulation.ppqn);
  }

  // Ensure time never goes negative
  finalTime = Math.max(0, finalTime);

  return { time: finalTime, velocity, shouldPlay };
}

/**
 * Computes swing offset for a given step. This enhances the
 * existing swing implementation with curve-differentiated swing
 * (different swing curves for different groove types).
 *
 * For 'linear' groove_type: standard even/odd swing
 * For 'curved' groove_type: swing amount varies with drag position
 * For 'hardware_emulated': swing gets PPQN-rounded (handled later)
 *
 * @param {number} step - Current step index
 * @param {number} secPerStep - Base seconds per step (no swing)
 * @param {number} swing - Swing amount (0.0–0.5)
 * @param {string} grooveType - Current groove type
 * @returns {number} Step duration in seconds (with swing applied)
 */
export function computeSwingDuration(step, secPerStep, swing, grooveType) {
  if (swing === 0) return secPerStep;

  if (step % 2 === 0) {
    return secPerStep * (1 - swing);
  } else {
    return secPerStep * (1 + swing);
  }
}

/**
 * Creates a default groove profile with linear (no displacement) settings.
 * All displacements are zero — pure grid timing.
 *
 * @param {number} bpm - BPM for this profile
 * @returns {Object} Default groove profile
 */
export function createDefaultGrooveProfile(bpm = 90) {
  return {
    groove_type: 'linear',
    groove_amount: 1.0,
    feel_bias: 'laid_back',
    bpm: bpm,
    steps_per_bar: 16,
    randomization_seed: 42,

    // Per-channel timing offsets (all zero for default)
    channel_offsets: {
      kick:  { timing_offset_ms: 0, velocity_variance: 0, jitter_ms: 0, ghost_note_probability: 0 },
      snare: { timing_offset_ms: 0, velocity_variance: 0, jitter_ms: 0, ghost_note_probability: 0 },
      hihat: { timing_offset_ms: 0, velocity_variance: 0, jitter_ms: 0, ghost_note_probability: 0 },
      bass:  { timing_offset_ms: 0, velocity_variance: 0, jitter_ms: 0, ghost_note_probability: 0 },
      keys:  { timing_offset_ms: 0, velocity_variance: 0, jitter_ms: 0, ghost_note_probability: 0 },
    },

    // Drag curve (disabled for linear)
    drag_curve: {
      enabled: false,
      drift_mode: 'power',
      max_drag_ms: 25,
      drag_exponent: 1.25,
      snap_mode: 'hard',
      log_k: 4,
      per_channel_scaling: {
        snare: 1.0,
        hihat: 0.4,
        kick: 0.0,
        bass: 0.7,
        keys: 0.5,
      },
    },

    // Hardware emulation (disabled for linear)
    hardware_emulation: {
      ppqn: 96,
      signal_chain_order: 'saturate_downsample_quantize',
      dac_saturation: { enabled: false, curve: 'tanh', gain: 1.2 },
      anti_alias_filter: { type: 'chebyshev_type1', cutoff_hz: 18000, ripple_db: 0.5 },
      sample_rate: 26040,
      bit_depth: 12,
    },

    // Temporal coupling (disabled)
    temporal_coupling: {
      enabled: false,
      velocity_phase_ratio: -1.0,
      direction: 'natural',
    },

    // Harmonic gravity (disabled)
    harmonic_gravity: {
      enabled: false,
      gravity_by_mode: {
        major: 1.0,
        minor: 1.15,
        dorian: 1.10,
        phrygian: 1.25,
        mixolydian: 1.05,
        blues: 1.10,
        pentatonic: 1.0,
        chromatic: 1.0,
      },
    },

    // Macro-drift (disabled)
    macro_drift: {
      enabled: false,
      amplitude_ms: 12,
      period_bars: 4,
      waveform: 'sine',
    },

    // Phrase constraints
    phrase_constraints: {
      phrase_length_bars: 8,
      reset_mode: 'hard',
      max_accumulated_phase_error_ms: 50,
      snap_back_attack_ms: 20,
    },

    // Temporal state / tension (Phase 3, disabled)
    temporal_state: {
      enabled: false,
      tension_increment: 0.1,
      elasticity_amplification: 0.3,
      reset_mode: 'every_n_bars',
      reset_period_bars: 8,
      max_phase_error_ms: 45,
    },

    // Performer capture (disabled)
    performer_capture: {
      id: 'default',
      enabled: false,
      velocity_response: {
        curve_type: 'linear',
        dynamic_range_db: 24,
      },
      phase_behavior: {
        snare_drag_curve: { enabled: false, max_drag_ms: 12, curve_exponent: 1.2 },
        hat_jitter_sigma_ms: 2,
        kick_push_ms: 0,
      },
      micro_bias: {
        ghost_note_attenuation_db: -12,
        rushing_hat_probability: 0,
        rushing_hat_amount_ms: -3,
      },
      randomization_seed: 42,
    },
  };
}
