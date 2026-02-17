// ═══════════════════════════════════════════════════════════
// GROOVE FIELD ENGINE — Layer 2
// Deterministic Temporal Topology Engine
// L0-CMD-2026-0216-006-A §3
// ═══════════════════════════════════════════════════════════
//
// Layer 2 computes temporal displacement (curvature) for the
// groove field. All functions are pure, bounded, BPM-scaled,
// and deterministic. No randomness. No side effects.
//
// Invariants (from §1.3.1):
//   1. BOUNDED — every output has a hard ceiling
//   2. BPM-SCALED — all values scale by (90 / current_bpm)
//   3. DETERMINISTIC — pure functions, no Math.random()
//   4. RESETTABLE — drift resets at phrase/bar boundary

/**
 * Computes power-curve drag displacement for a given step.
 * Only active when groove_type === 'curved'.
 *
 * BOUNDED: Output is always in [0, maxDragMs * bpmScale * channelScale]
 * DETERMINISTIC: No randomness — pure function of position.
 *
 * Math: Δ(n) = D_max · (n / N)^α
 *
 * @param {number} step - Current step index (0–15)
 * @param {number} stepsPerBar - Total steps (typically 16)
 * @param {number} maxDragMs - Maximum drag at end of bar
 * @param {number} dragExponent - Curvature (1.0 = linear, 1.25 = Dilla sweet spot)
 * @param {number} channelScale - Per-channel multiplier (0.0–1.0)
 * @param {number} bpmScale - BPM scaling factor (90/bpm)
 * @returns {number} Displacement in ms
 */
export function computeDragCurve(step, stepsPerBar, maxDragMs, dragExponent, channelScale, bpmScale) {
  if (stepsPerBar <= 0 || dragExponent <= 0) return 0;
  const p = step / stepsPerBar;
  const scaledMax = maxDragMs * bpmScale;
  return scaledMax * Math.pow(p, dragExponent) * channelScale;
}

/**
 * Computes normalized logarithmic drift.
 * Alternative to power curve — bounded by construction.
 *
 * AC-01 CORRECTION: Uses ln(1 + p·k) / ln(1 + k) normalization.
 * Always returns 0 at step 0, maxDragMs at final step.
 *
 * @param {number} step - Current step index (0–15)
 * @param {number} stepsPerBar - Total steps (typically 16)
 * @param {number} maxDragMs - Maximum drag at end of bar
 * @param {number} k - Log curvature parameter (higher = more front-loaded)
 * @param {number} channelScale - Per-channel multiplier
 * @param {number} bpmScale - BPM scaling factor
 * @returns {number} Displacement in ms
 */
export function computeLogDrift(step, stepsPerBar, maxDragMs, k, channelScale, bpmScale) {
  if (stepsPerBar <= 0) return 0;
  if (k <= 0) k = 1;
  const p = step / stepsPerBar;
  const scaledMax = maxDragMs * bpmScale;
  return scaledMax * (Math.log(1 + p * k) / Math.log(1 + k)) * channelScale;
}

/**
 * Applies velocity-phase coupling.
 * Natural direction: high velocity → negative phase (pushed early)
 *                    low velocity → positive phase (dragged late)
 *
 * @param {number} velocity - Hit velocity 0.0–1.0
 * @param {number} ratio - ms per 0.1 velocity deviation from 0.7 center
 * @param {string} direction - 'natural' | 'inverted' | 'none'
 * @returns {number} Phase adjustment in ms
 */
export function velocityPhaseCoupling(velocity, ratio, direction) {
  if (direction === 'none') return 0;
  const center = 0.7;
  const deviation = velocity - center;
  const sign = direction === 'inverted' ? -1 : 1;
  return sign * deviation * ratio * 10;
}

/**
 * Computes inter-bar macro-drift — the slow breathing oscillation
 * of a live performer's timing across a phrase.
 *
 * @param {number} barIndex - Current bar number
 * @param {Object} macroDrift - macro_drift config from groove profile
 * @param {number} bpmScale - BPM scaling factor
 * @returns {number} Additional offset in ms
 */
export function computeMacroDrift(barIndex, macroDrift, bpmScale) {
  if (!macroDrift?.enabled) return 0;
  const amplitude = (macroDrift.amplitude_ms || 0) * bpmScale;
  const period = macroDrift.period_bars || 4;
  if (period <= 0) return 0;

  if (macroDrift.waveform === 'triangle') {
    const phase = barIndex / period;
    return amplitude * (2 * Math.abs(2 * (phase % 1) - 1) - 1);
  }
  // Default: sine
  const phase = (2 * Math.PI * barIndex) / period;
  return amplitude * Math.sin(phase);
}

/**
 * Applies harmonic gravity multiplier.
 * Minor keys and Phrygian modes are perceived as "heavier" —
 * the ear expects more drag. Only affects positive (drag) offsets.
 *
 * @param {number} offsetMs - Current timing offset in ms
 * @param {Object} harmonicGravity - harmonic_gravity config
 * @param {string} scaleMode - Current scale mode (e.g., 'minor', 'dorian')
 * @returns {number} Gravity-adjusted offset in ms
 */
export function applyHarmonicGravity(offsetMs, harmonicGravity, scaleMode) {
  if (!harmonicGravity?.enabled || offsetMs <= 0) return offsetMs;
  const mode = scaleMode || 'minor';
  const gravity = harmonicGravity.gravity_by_mode?.[mode] ?? 1.0;
  return offsetMs * gravity;
}

/**
 * Computes tension state for a given bar in a phrase.
 * τ accumulates per bar and resets at phrase boundaries.
 *
 * τ ∈ [0, 1] — HARD BOUNDED. τ can NEVER exceed 1.0.
 * τ(b+1) = min(1, τ(b) + δ)
 * E_d_effective = E_d_base · (1 + τ · κ)
 *
 * Phase 3 feature — documented in §4.1 but computed here
 * for architectural completeness.
 *
 * @param {number} barIndex - Current bar index
 * @param {Object} temporalState - temporal_state config
 * @returns {{ tension: number, exponentMultiplier: number }}
 */
export function computeTensionState(barIndex, temporalState) {
  if (!temporalState?.enabled) {
    return { tension: 0, exponentMultiplier: 1.0 };
  }

  const delta = temporalState.tension_increment || 0.1;
  const kappa = temporalState.elasticity_amplification || 0.3;
  const resetPeriod = temporalState.reset_period_bars || 8;
  const resetMode = temporalState.reset_mode || 'every_n_bars';

  let barInPhrase;
  if (resetMode === 'every_n_bars') {
    barInPhrase = barIndex % resetPeriod;
  } else {
    barInPhrase = barIndex % resetPeriod;
  }

  // τ accumulates linearly per bar within the phrase, capped at 1.0
  const tension = Math.min(1.0, barInPhrase * delta);
  const exponentMultiplier = 1.0 + tension * kappa;

  return { tension, exponentMultiplier };
}

/**
 * Checks and clamps total accumulated phase error against
 * the phrase constraint safety net.
 *
 * @param {number} totalOffsetMs - Total accumulated offset in ms
 * @param {Object} phraseConstraints - phrase_constraints config
 * @param {number} bpmScale - BPM scaling factor
 * @returns {number} Clamped offset in ms
 */
export function clampPhraseError(totalOffsetMs, phraseConstraints, bpmScale) {
  if (!phraseConstraints) return totalOffsetMs;
  const maxError = (phraseConstraints.max_accumulated_phase_error_ms || 50) * bpmScale;
  return Math.max(-maxError, Math.min(maxError, totalOffsetMs));
}
