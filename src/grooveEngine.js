// ═══════════════════════════════════════════════════════════
// GROOVE ENGINE — Layer 3: Event Scheduler
// Unified Displacement Kernel Architecture
// L0-CMD-2026-0216-007 §6.2, §6.3 (Deliverables D2, D3)
// ═══════════════════════════════════════════════════════════
//
// Layer 3 orchestrates the complete timing pipeline via the
// Unified Displacement Kernel (grooveKernel.js):
//
//   1. Assemble coefficient context from groove profile
//   2. Evaluate fΔ(context) — single closed-form displacement
//   3. Apply PPQN rounding (coefficient-gated by ppqn value)
//   4. Process velocity humanization + ghost notes
//
// ZERO groove_type conditionals in the displacement path.
// Style character emerges from coefficient values alone.
//
// Engineering Rules (CMD-007 §8.1):
//   Rule 19: Kernel is PURE — no mutation, no side effects
//   Rule 20: ZERO groove_type conditionals inside kernel
//   Rule 21: Γ(m) scales ONLY curvature + phase coupling
//   Rule 22: β applied ONCE in kernel
//   Rule 24: f(n,v) = Δ_C(n) + Ω(v) coupled before gravity

import {
  computeDragCurve,
  computeLogDrift,
  velocityPhaseCoupling,
  computeMacroDrift,
  computeTensionState,
} from './grooveField.js';

import { computeGrooveDisplacement } from './grooveKernel.js';
import { roundToPPQN } from './hardwareEmulation.js';
import { applyEmotionalBias } from './emotionField.js';

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
 * CONTEXT ASSEMBLY FUNCTION — D3 (CMD-007 §6.3)
 *
 * Builds the coefficient context vector from a groove profile,
 * step position, channel, and musical state. This is the bridge
 * between profile configuration and the pure displacement kernel.
 *
 * All basis function outputs are UNSCALED (bpmScale=1).
 * β is applied ONCE inside the kernel (Rule 22).
 *
 * @param {number} step - Current step index (0–15)
 * @param {string} channelId - Channel identifier (e.g., 'kick', 'snare')
 * @param {Object} grooveProfile - Complete groove profile object
 * @param {number} barIndex - Current bar index (for macro-drift, tension)
 * @param {SeededRNG|null} rng - Seeded random number generator
 * @param {string} scaleMode - Current scale mode (e.g., 'minor', 'dorian')
 * @param {number} baseVelocity - Original velocity of the event (0.0–1.0)
 * @returns {Object} Coefficient context for computeGrooveDisplacement()
 */
export function assembleGrooveContext(step, channelId, grooveProfile, barIndex, rng, scaleMode, baseVelocity) {
  const bpm = grooveProfile.bpm || 90;
  const stepsPerBar = grooveProfile.steps_per_bar || 16;
  const stepInBar = step % stepsPerBar;
  const canonicalChannel = resolveChannel(channelId);

  const channelOffsets = grooveProfile.channel_offsets || {};
  const channelCfg = channelOffsets[canonicalChannel] || {};

  // ── Δ_L — Linear offset (per-channel constant displacement, unscaled ms) ──
  const linearOffset = channelCfg.timing_offset_ms || 0;

  // ── Δ_C(n) — Topological curvature (unscaled ms) ──
  // Coefficient-gated: drag_curve.enabled controls activation
  let curvature = 0;
  if (grooveProfile.drag_curve?.enabled) {
    const dc = grooveProfile.drag_curve;
    const channelScale = dc.per_channel_scaling?.[canonicalChannel] ?? 1.0;

    const tensionState = computeTensionState(barIndex, grooveProfile.temporal_state);
    const effectiveExponent = (dc.drag_exponent || 1.25) * tensionState.exponentMultiplier;

    if (dc.drift_mode === 'log') {
      // Pass bpmScale=1: kernel applies β
      curvature = computeLogDrift(
        stepInBar, stepsPerBar,
        dc.max_drag_ms || 25,
        dc.log_k || 4,
        channelScale, 1
      );
    } else {
      // Default: power curve. Pass bpmScale=1: kernel applies β
      curvature = computeDragCurve(
        stepInBar, stepsPerBar,
        dc.max_drag_ms || 25,
        effectiveExponent,
        channelScale, 1
      );
    }
  }

  // ── Ω(v) — Velocity-phase coupling (unscaled ms) ──
  // Coefficient-gated: temporal_coupling.enabled controls activation
  let phaseCoupling = 0;
  if (grooveProfile.temporal_coupling?.enabled && baseVelocity != null) {
    const ratio = grooveProfile.temporal_coupling.velocity_phase_ratio || -1.0;
    const direction = grooveProfile.temporal_coupling.direction || 'natural';
    phaseCoupling = velocityPhaseCoupling(baseVelocity, ratio, direction);
  }

  // ── Γ(m) — Harmonic gravity multiplier (≥1.0) ──
  // Coefficient-gated: harmonic_gravity.enabled controls activation
  // Rule 21: Γ scales ONLY the elastic field (curvature + phaseCoupling)
  let harmonicGravity = 1.0;
  if (grooveProfile.harmonic_gravity?.enabled) {
    const mode = scaleMode || 'minor';
    harmonicGravity = grooveProfile.harmonic_gravity.gravity_by_mode?.[mode] ?? 1.0;
  }

  // ── Ψ(b) — Macro-drift (unscaled ms) ──
  // Coefficient-gated: macro_drift.enabled controls activation
  let macroDrift = 0;
  if (grooveProfile.macro_drift?.enabled) {
    // Pass bpmScale=1: kernel applies β
    macroDrift = computeMacroDrift(barIndex, grooveProfile.macro_drift, 1);
  }

  // ── σ·G — Stochastic jitter (unscaled ms) ──
  // Coefficient-gated: jitter_ms > 0 controls activation (no groove_type check)
  let jitter = 0;
  if (rng) {
    const sigma = channelCfg.jitter_ms || 0;
    if (sigma > 0) {
      jitter = sigma * rng.gaussian();
    }
  }

  // ── Feel bias limits (unscaled ms) ──
  const feelBias = grooveProfile.feel_bias || 'laid_back';
  const feelLimits = MAX_OFFSET_BY_FEEL[feelBias] || MAX_OFFSET_BY_FEEL.laid_back;

  // ── Phrase constraint ceiling (unscaled ms) ──
  const maxPhaseErrorMs = grooveProfile.phrase_constraints?.max_accumulated_phase_error_ms || 0;

  return {
    bpm,
    grooveAmount: grooveProfile.groove_amount ?? 1.0,
    linearOffset,
    curvature,
    phaseCoupling,
    harmonicGravity,
    macroDrift,
    jitter,
    maxPushMs: feelLimits.push,
    maxDragMs: feelLimits.drag,
    maxPhaseErrorMs,
  };
}

/**
 * Main groove pipeline — D2 (CMD-007 §6.2)
 *
 * Computes the final timing displacement, velocity modification,
 * and play/skip decision for a single event at a given step and channel.
 *
 * ZERO groove_type conditionals. All displacement flows through
 * assembleGrooveContext() → computeGrooveDisplacement().
 * PPQN rounding is coefficient-gated by ppqn value.
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
  const canonicalChannel = resolveChannel(channelId);
  const channelOffsets = grooveProfile.channel_offsets || {};
  const channelCfg = channelOffsets[canonicalChannel] || {};

  // ── 1. Assemble coefficient context ──
  const ctx = assembleGrooveContext(step, channelId, grooveProfile, barIndex, rng, scaleMode, baseVelocity);

  // ── 1.5. Emotional Field Bias — single injection point (D3) ──
  // Pipeline: Groove Field → Emotional Field Bias → Unified Displacement Kernel
  const biasedCtx = applyEmotionalBias(ctx, grooveProfile.emotion_vector);

  // ── 2. Evaluate unified displacement kernel (pure math) ──
  const offsetMs = computeGrooveDisplacement(biasedCtx);

  // ── 3. Velocity humanization (side effect — uses RNG) ──
  let velocity = baseVelocity;
  if (channelCfg.velocity_variance && rng && baseVelocity != null) {
    const variance = channelCfg.velocity_variance;
    const mod = rng.gaussian() * variance;
    velocity = Math.max(0.05, Math.min(1.0, baseVelocity + mod));
  }

  // ── 4. Ghost note processing (side effect — uses RNG) ──
  let shouldPlay = true;
  if (channelCfg.ghost_note_probability && rng) {
    const ghostProb = channelCfg.ghost_note_probability;
    if (rng.next() < ghostProb) {
      const attenuation = channelCfg.ghost_note_attenuation_db || -12;
      const scale = Math.pow(10, attenuation / 20);
      velocity = baseVelocity * scale;
    }
  }

  // ── 5. Compute final time ──
  let finalTime = gridTime + (offsetMs / 1000);

  // ── 6. PPQN rounding — coefficient-gated (Rule 20: no groove_type check) ──
  // ppqn > 0 activates rounding. ppqn = 0 means no hardware quantization.
  const ppqn = grooveProfile.hardware_emulation?.ppqn || 0;
  if (ppqn > 0) {
    finalTime = roundToPPQN(finalTime, bpm, ppqn);
  }

  // Ensure time never goes negative
  finalTime = Math.max(0, finalTime);

  return { time: finalTime, velocity, shouldPlay };
}

/**
 * Computes swing offset for a given step.
 *
 * @param {number} step - Current step index
 * @param {number} secPerStep - Base seconds per step (no swing)
 * @param {number} swing - Swing amount (0.0–0.5)
 * @param {string} grooveType - Retained for API compatibility (unused)
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
 * Creates a default groove profile with zero displacement settings.
 * All displacements are zero — pure grid timing.
 * groove_type retained as metadata only (not used for dispatch).
 *
 * @param {number} bpm - BPM for this profile
 * @returns {Object} Default groove profile
 */
export function createDefaultGrooveProfile(bpm = 90) {
  return {
    groove_type: 'linear',  // Metadata only — not used for dispatch
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

    // Drag curve (disabled — curvature coefficient = 0)
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

    // Hardware emulation (ppqn=0 means no PPQN rounding)
    hardware_emulation: {
      ppqn: 0,
      signal_chain_order: 'saturate_downsample_quantize',
      dac_saturation: { enabled: false, curve: 'tanh', gain: 1.2 },
      anti_alias_filter: { type: 'chebyshev_type1', cutoff_hz: 18000, ripple_db: 0.5 },
      sample_rate: 26040,
      bit_depth: 12,
    },

    // Temporal coupling (disabled — phaseCoupling coefficient = 0)
    temporal_coupling: {
      enabled: false,
      velocity_phase_ratio: -1.0,
      direction: 'natural',
    },

    // Harmonic gravity (disabled — Γ = 1.0)
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

    // Macro-drift (disabled — Ψ coefficient = 0)
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

    // Emotional field — neutral vector (zero bias on all coefficients)
    // VK-CMD-EMOTION-PHYSICS-2026-002 D1/D4
    emotion_vector: {
      loneliness: 0.0,
      tension: 0.0,
      admiration: 0.0,
      defiance: 0.0,
      calm: 0.0,
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

// ── Deterministic Groove Hashing (SHA-256) ──

/**
 * Recursively sorts object keys for deterministic serialization.
 * Arrays preserve order; primitives pass through unchanged.
 */
export function stableStringify(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(v => stableStringify(v)).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

function bytesToHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Computes SHA-256 hex hash of a groove profile using Web Crypto.
 * @param {Object} grooveProfile - Complete groove profile object
 * @returns {Promise<string>} Lowercase hex SHA-256 hash
 */
export async function computeGrooveHash(grooveProfile) {
  const json = stableStringify(grooveProfile);
  const bytes = new TextEncoder().encode(json);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return bytesToHex(digest);
}
