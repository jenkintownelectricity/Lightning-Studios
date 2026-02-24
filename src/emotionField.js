// ═══════════════════════════════════════════════════════════
// EMOTIONAL FIELD LAYER — Coefficient Bias Engine
// VK-CMD-EMOTION-PHYSICS-2026-002 (D1, D2, D3)
// ═══════════════════════════════════════════════════════════
//
// Emotional modulation of groove physics through coefficient
// bias only. No conditionals on emotion type. No branching.
// No new math primitives. No genre logic. No randomness.
//
// Emotional Basis Set E = { LONELINESS, TENSION, ADMIRATION, DEFIANCE, CALM }
// Each e ∈ [0.0, 1.0] continuous scalar.
//
// Pipeline injection point (exactly one):
//   Groove Field → Emotional Field Bias → Unified Displacement Kernel
//
// Invariants preserved:
//   1. BOUNDED — emotional bias is bounded by construction
//   2. BPM-SCALED — bias operates on pre-scaled coefficients; β applied once in kernel
//   3. DETERMINISTIC — pure function, no randomness, no external state
//   4. RESETTABLE — emotion vector = [0,0,0,0,0] → zero bias (identity)

// ── D1 — Emotional Basis Vector Definition ──────────────────────
//
// Minimal orthogonal emotional basis set.
// Ordered array for deterministic iteration.
// Each dimension is a continuous scalar e ∈ [0.0, 1.0].
// No categorical labels. No enums.

/**
 * @type {ReadonlyArray<string>}
 */
export const EMOTION_BASIS = Object.freeze([
  'loneliness',
  'tension',
  'admiration',
  'defiance',
  'calm',
]);

// ── D2 — Coefficient Mapping Table ──────────────────────────────
//
// For each emotional basis vector, specifies how it biases
// existing kernel coefficients:
//
// ┌─────────────┬────────┬────────┬────────┬────────┬────────┬────────┬────────┐
// │ Emotion     │  Δ_L   │  Δ_C   │  Ω(v)  │  Γ(m)  │  Ψ(b)  │  σ·G   │   DW   │
// │             │  (ms)  │ (scale)│ (scale)│  (add) │ (scale)│ (scale)│  (add) │
// ├─────────────┼────────┼────────┼────────┼────────┼────────┼────────┼────────┤
// │ loneliness  │  +3.0  │  +0.15 │  -0.25 │  +0.08 │  +0.20 │  +0.10 │  +0.05 │
// │ tension     │  -2.0  │  -0.10 │  +0.35 │  +0.15 │  -0.25 │  +0.20 │  -0.05 │
// │ admiration  │  +1.5  │  +0.08 │  +0.15 │  -0.05 │  +0.15 │  -0.12 │  +0.03 │
// │ defiance    │  -3.5  │  -0.12 │  +0.30 │  -0.10 │  -0.20 │  +0.08 │  -0.08 │
// │ calm        │  +0.0  │  -0.05 │  -0.15 │  -0.03 │  -0.10 │  -0.20 │  +0.02 │
// └─────────────┴────────┴────────┴────────┴────────┴────────┴────────┴────────┘
//
// Application rules:
//   Δ_L  — additive (ms):        linearOffset += Σ(eᵢ · dL_i)
//   Δ_C  — multiplicative scale: curvature *= (1 + Σ(eᵢ · dC_i))
//   Ω(v) — multiplicative scale: phaseCoupling *= (1 + Σ(eᵢ · dOv_i))
//   Γ(m) — additive, floor 1.0:  harmonicGravity = max(1.0, Γ + Σ(eᵢ · dGm_i))
//   Ψ(b) — multiplicative scale: macroDrift *= (1 + Σ(eᵢ · dPb_i))
//   σ·G  — multiplicative scale: jitter *= max(0, 1 + Σ(eᵢ · dSg_i))
//   DW   — additive, clamped:    grooveAmount = clamp(GA + Σ(eᵢ · dDW_i), 0, 1)
//
// No new math primitives. Only linear or bounded nonlinear scaling.
// All 4 invariants (BOUNDED, BPM-SCALED, DETERMINISTIC, RESETTABLE) preserved.

/**
 * @type {Readonly<Record<string, {dL: number, dC: number, dOv: number, dGm: number, dPb: number, dSg: number, dDW: number}>>}
 */
export const EMOTION_COEFFICIENT_MAP = Object.freeze({
  loneliness: Object.freeze({ dL:  3.0, dC:  0.15, dOv: -0.25, dGm:  0.08, dPb:  0.20, dSg:  0.10, dDW:  0.05 }),
  tension:    Object.freeze({ dL: -2.0, dC: -0.10, dOv:  0.35, dGm:  0.15, dPb: -0.25, dSg:  0.20, dDW: -0.05 }),
  admiration: Object.freeze({ dL:  1.5, dC:  0.08, dOv:  0.15, dGm: -0.05, dPb:  0.15, dSg: -0.12, dDW:  0.03 }),
  defiance:   Object.freeze({ dL: -3.5, dC: -0.12, dOv:  0.30, dGm: -0.10, dPb: -0.20, dSg:  0.08, dDW: -0.08 }),
  calm:       Object.freeze({ dL:  0.0, dC: -0.05, dOv: -0.15, dGm: -0.03, dPb: -0.10, dSg: -0.20, dDW:  0.02 }),
});

/**
 * Creates a neutral (zero) emotion vector.
 * When applied, produces zero bias on all coefficients (identity operation).
 *
 * @returns {{ loneliness: number, tension: number, admiration: number, defiance: number, calm: number }}
 */
export function createNeutralEmotionVector() {
  return {
    loneliness: 0.0,
    tension: 0.0,
    admiration: 0.0,
    defiance: 0.0,
    calm: 0.0,
  };
}

// ── D3 — Emotional Field Injection Point ────────────────────────
//
// Exactly one injection point in the pipeline:
//
//   assembleGrooveContext() → applyEmotionalBias() → computeGrooveDisplacement()
//   ────────────────────     ─────────────────────   ──────────────────────────
//   Groove Field             Emotional Field Bias    Unified Displacement Kernel
//
// No additional layers. No branching. No conditionals.

/**
 * Clamps value to [min, max].
 * @param {number} v
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * EMOTIONAL FIELD BIAS INJECTION — Single Pipeline Injection Point
 *
 * Applies continuous emotional bias to assembled kernel coefficients.
 * No branching on emotion type. No conditionals on emotion identity.
 * Pure weighted-sum vector math over the emotional basis set.
 *
 * When emotionVector is null/undefined or all zeros, returns context
 * unchanged (identity property preserved).
 *
 * BOUNDED:      All output coefficients remain within their valid ranges.
 * BPM-SCALED:   Operates on pre-β coefficients; β applied once in kernel.
 * DETERMINISTIC: Pure function — same inputs always produce same outputs.
 * RESETTABLE:   Zero vector → zero bias → original behavior.
 *
 * @param {Object} context - Assembled groove context (from assembleGrooveContext)
 * @param {Object|null|undefined} emotionVector - Emotion vector with basis scalars
 * @returns {Object} Biased context (new object — no mutation of input)
 */
export function applyEmotionalBias(context, emotionVector) {
  // Identity: null/undefined vector → no bias, return original reference
  if (!emotionVector) return context;

  // Compute aggregate bias deltas across all emotion dimensions.
  // Uniform iteration — no branching on emotion type.
  let sumDL  = 0;
  let sumDC  = 0;
  let sumDOv = 0;
  let sumDGm = 0;
  let sumDPb = 0;
  let sumDSg = 0;
  let sumDDW = 0;

  for (let i = 0; i < EMOTION_BASIS.length; i++) {
    const key = EMOTION_BASIS[i];
    const e = clamp(emotionVector[key] || 0, 0.0, 1.0);
    const coeff = EMOTION_COEFFICIENT_MAP[key];
    sumDL  += e * coeff.dL;
    sumDC  += e * coeff.dC;
    sumDOv += e * coeff.dOv;
    sumDGm += e * coeff.dGm;
    sumDPb += e * coeff.dPb;
    sumDSg += e * coeff.dSg;
    sumDDW += e * coeff.dDW;
  }

  // Apply bias to context coefficients.
  // New object — no mutation of input context.
  return {
    ...context,

    // Δ_L — additive bias in ms
    linearOffset: context.linearOffset + sumDL,

    // Δ_C — multiplicative scale on curvature
    curvature: context.curvature * (1 + sumDC),

    // Ω(v) — multiplicative scale on phase coupling
    phaseCoupling: context.phaseCoupling * (1 + sumDOv),

    // Γ(m) — additive bias, gravity can never drop below neutral (1.0)
    harmonicGravity: Math.max(1.0, context.harmonicGravity + sumDGm),

    // Ψ(b) — multiplicative scale on macro-drift
    macroDrift: context.macroDrift * (1 + sumDPb),

    // σ·G — multiplicative scale on jitter, magnitude can never go negative
    jitter: context.jitter * Math.max(0, 1 + sumDSg),

    // DW proxy — additive bias on groove amount, clamped [0.0, 1.0]
    grooveAmount: clamp(context.grooveAmount + sumDDW, 0.0, 1.0),
  };
}
