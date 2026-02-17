// ═══════════════════════════════════════════════════════════
// UNIFIED DISPLACEMENT KERNEL — grooveKernel.js
// L0-CMD-2026-0216-007 §6.1 (Deliverable D1)
// ═══════════════════════════════════════════════════════════
//
// PURE FUNCTION. No mutation. No side effects. No external
// state reads. No branching on groove_type. Deterministic
// for identical inputs.
//
// The canonical displacement equation:
//
//   T_final = Quantize_PPQN(
//     T_grid + β · [ Δ_L + Γ(m) · f(n,v) + Ψ(b) + σ·G ] · amount
//   )
//
// This function computes Δ only. No scheduling. No rounding.
// No side effects. Pure math.
//
// Engineering Rules (CMD-007 §8.1):
//   Rule 19: This is a PURE FUNCTION — no mutation, no side effects
//   Rule 20: ZERO groove_type conditionals inside this function
//   Rule 21: Γ(m) scales ONLY curvature + phase coupling
//   Rule 22: β applied ONCE here — basis functions return unscaled ms
//   Rule 24: f(n,v) = Δ_C(n) + Ω(v) coupled before gravity

/**
 * UNIFIED GROOVE DISPLACEMENT KERNEL — fΔ
 *
 * Evaluates the single closed-form displacement equation.
 * Style character emerges from coefficient values, not code paths.
 * The same function runs for every profile — Boom Bap, Dilla,
 * MPC60, Questlove — only the numbers change.
 *
 * @param {Object} context - Precomputed displacement coefficients
 * @param {number} context.bpm              - Current BPM (for β = 90/BPM)
 * @param {number} context.grooveAmount     - Global scaling 0.0–1.0
 * @param {number} context.linearOffset     - Δ_L: static channel bias (ms, unscaled)
 * @param {number} context.curvature        - Δ_C(n): topological curvature (ms, unscaled)
 * @param {number} context.phaseCoupling    - Ω(v): velocity-phase coupling (ms, unscaled)
 * @param {number} context.harmonicGravity  - Γ(m): scale mode multiplier (≥1.0)
 * @param {number} context.macroDrift       - Ψ(b): inter-bar breathing (ms, unscaled)
 * @param {number} context.jitter           - σ·G: Gaussian noise term (ms, unscaled)
 * @param {number} context.maxPushMs        - Feel bias push limit (negative, unscaled)
 * @param {number} context.maxDragMs        - Feel bias drag limit (positive, unscaled)
 * @param {number} context.maxPhaseErrorMs  - Phrase constraint ceiling (unscaled)
 * @returns {number} Total displacement in milliseconds (fully scaled + clamped)
 */
export function computeGrooveDisplacement(context) {
  const {
    bpm,
    grooveAmount,
    linearOffset,
    curvature,
    phaseCoupling,
    harmonicGravity,
    macroDrift,
    jitter,
    maxPushMs,
    maxDragMs,
    maxPhaseErrorMs,
  } = context;

  // β — BPM scalar (Rule 22: applied ONCE, here)
  const beta = 90 / (bpm || 90);

  // f(n,v) — Coupled elastic field (Rule 24)
  // Curvature and velocity coupling combined in phase-space
  const elasticRaw = curvature + phaseCoupling;

  // Γ(m) — Harmonic gravity (Rule 21)
  // Scales ONLY the elastic field. Positive values only.
  // Gravity pulls back (amplifies drag). Does NOT push forward.
  const elastic = elasticRaw > 0
    ? harmonicGravity * elasticRaw
    : elasticRaw;

  // Unified additive field: β · [ Δ_L + Γ·f(n,v) + Ψ(b) + σ·G ]
  const raw = beta * (linearOffset + elastic + macroDrift + jitter);

  // Phrase constraint safety clamp (Bounded invariant)
  const phraseClamped = maxPhaseErrorMs > 0
    ? Math.max(-maxPhaseErrorMs * beta, Math.min(maxPhaseErrorMs * beta, raw))
    : raw;

  // Feel bias clamp (push/drag limits)
  const clamped = Math.max(
    maxPushMs * beta,
    Math.min(maxDragMs * beta, phraseClamped)
  );

  // Groove amount — final scaling within clamped boundary
  return clamped * grooveAmount;
}
