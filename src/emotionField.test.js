// ═══════════════════════════════════════════════════════════
// Emotional Field Layer — Tests
// VK-CMD-EMOTION-PHYSICS-2026-002
// ═══════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import {
  EMOTION_BASIS,
  EMOTION_COEFFICIENT_MAP,
  createNeutralEmotionVector,
  applyEmotionalBias,
} from './emotionField.js';
import {
  assembleGrooveContext,
  createDefaultGrooveProfile,
  computeGrooveHash,
  SeededRNG,
} from './grooveEngine.js';
import { computeGrooveDisplacement } from './grooveKernel.js';

// ── D1 — Emotional Basis Vectors ──

describe('Emotional Basis Vectors — D1', () => {
  it('defines exactly 5 orthogonal basis dimensions', () => {
    expect(EMOTION_BASIS).toHaveLength(5);
    expect(EMOTION_BASIS).toEqual([
      'loneliness', 'tension', 'admiration', 'defiance', 'calm',
    ]);
  });

  it('neutral vector has all dimensions at 0.0', () => {
    const v = createNeutralEmotionVector();
    for (const key of EMOTION_BASIS) {
      expect(v[key]).toBe(0.0);
    }
  });

  it('coefficient map has entries for all basis dimensions', () => {
    for (const key of EMOTION_BASIS) {
      expect(EMOTION_COEFFICIENT_MAP[key]).toBeDefined();
      expect(typeof EMOTION_COEFFICIENT_MAP[key].dL).toBe('number');
      expect(typeof EMOTION_COEFFICIENT_MAP[key].dC).toBe('number');
      expect(typeof EMOTION_COEFFICIENT_MAP[key].dOv).toBe('number');
      expect(typeof EMOTION_COEFFICIENT_MAP[key].dGm).toBe('number');
      expect(typeof EMOTION_COEFFICIENT_MAP[key].dPb).toBe('number');
      expect(typeof EMOTION_COEFFICIENT_MAP[key].dSg).toBe('number');
      expect(typeof EMOTION_COEFFICIENT_MAP[key].dDW).toBe('number');
    }
  });

  it('coefficient map has no entries outside the basis set', () => {
    const mapKeys = Object.keys(EMOTION_COEFFICIENT_MAP);
    expect(mapKeys).toHaveLength(EMOTION_BASIS.length);
    for (const key of mapKeys) {
      expect(EMOTION_BASIS).toContain(key);
    }
  });
});

// ── D2 — Coefficient Mapping Table ──

describe('Coefficient Mapping Table — D2', () => {
  it('all delta values are finite numbers', () => {
    for (const key of EMOTION_BASIS) {
      const row = EMOTION_COEFFICIENT_MAP[key];
      for (const field of ['dL', 'dC', 'dOv', 'dGm', 'dPb', 'dSg', 'dDW']) {
        expect(Number.isFinite(row[field])).toBe(true);
      }
    }
  });

  it('multiplicative scaling deltas are bounded within [-1, 1]', () => {
    // When all emotions are at max (1.0), the combined scale factor
    // must not produce unbounded results
    for (const field of ['dC', 'dOv', 'dPb', 'dSg']) {
      let maxPositive = 0;
      let maxNegative = 0;
      for (const key of EMOTION_BASIS) {
        const v = EMOTION_COEFFICIENT_MAP[key][field];
        if (v > 0) maxPositive += v;
        if (v < 0) maxNegative += v;
      }
      // Combined scale factor (1 + sum) should not go below 0
      // and should not exceed reasonable bounds
      expect(1 + maxNegative).toBeGreaterThanOrEqual(0);
      expect(1 + maxPositive).toBeLessThanOrEqual(3);
    }
  });
});

// ── D3 — Emotional Field Injection ──

describe('Emotional Field Bias — D3 Injection', () => {
  it('neutral emotion vector produces identical context (identity)', () => {
    const profile = createDefaultGrooveProfile(90);
    profile.drag_curve.enabled = true;
    profile.temporal_coupling.enabled = true;
    const rng = new SeededRNG(42);

    const ctx = assembleGrooveContext(4, 'snare', profile, 0, rng, 'minor', 0.8);
    const neutral = createNeutralEmotionVector();
    const biased = applyEmotionalBias(ctx, neutral);

    expect(biased.linearOffset).toBe(ctx.linearOffset);
    expect(biased.curvature).toBe(ctx.curvature);
    expect(biased.phaseCoupling).toBe(ctx.phaseCoupling);
    expect(biased.harmonicGravity).toBe(ctx.harmonicGravity);
    expect(biased.macroDrift).toBe(ctx.macroDrift);
    expect(biased.jitter).toBe(ctx.jitter);
    expect(biased.grooveAmount).toBe(ctx.grooveAmount);
  });

  it('null emotion vector returns context unchanged (same reference)', () => {
    const profile = createDefaultGrooveProfile(90);
    const rng = new SeededRNG(42);
    const ctx = assembleGrooveContext(4, 'snare', profile, 0, rng, 'minor', 0.8);
    const result = applyEmotionalBias(ctx, null);
    expect(result).toBe(ctx);
  });

  it('undefined emotion vector returns context unchanged', () => {
    const profile = createDefaultGrooveProfile(90);
    const rng = new SeededRNG(42);
    const ctx = assembleGrooveContext(4, 'snare', profile, 0, rng, 'minor', 0.8);
    const result = applyEmotionalBias(ctx, undefined);
    expect(result).toBe(ctx);
  });

  it('same emotion vector + same context = same output (determinism)', () => {
    const profile = createDefaultGrooveProfile(90);
    profile.drag_curve.enabled = true;
    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(42);

    const ctx1 = assembleGrooveContext(4, 'snare', profile, 0, rng1, 'minor', 0.8);
    const ctx2 = assembleGrooveContext(4, 'snare', profile, 0, rng2, 'minor', 0.8);

    const ev = { loneliness: 0.7, tension: 0.3, admiration: 0.0, defiance: 0.5, calm: 0.2 };
    const biased1 = applyEmotionalBias(ctx1, ev);
    const biased2 = applyEmotionalBias(ctx2, ev);

    expect(biased1.linearOffset).toBe(biased2.linearOffset);
    expect(biased1.curvature).toBe(biased2.curvature);
    expect(biased1.phaseCoupling).toBe(biased2.phaseCoupling);
    expect(biased1.harmonicGravity).toBe(biased2.harmonicGravity);
    expect(biased1.macroDrift).toBe(biased2.macroDrift);
    expect(biased1.jitter).toBe(biased2.jitter);
    expect(biased1.grooveAmount).toBe(biased2.grooveAmount);
  });

  it('emotion values are clamped to [0.0, 1.0]', () => {
    const profile = createDefaultGrooveProfile(90);
    const rng = new SeededRNG(42);
    const ctx = assembleGrooveContext(4, 'snare', profile, 0, rng, 'minor', 0.8);

    const over    = { loneliness: 2.0, tension: -1.0, admiration: 0.5, defiance: 0.5, calm: 0.5 };
    const clamped = { loneliness: 1.0, tension:  0.0, admiration: 0.5, defiance: 0.5, calm: 0.5 };

    const biasedOver = applyEmotionalBias(ctx, over);
    const biasedClamped = applyEmotionalBias(ctx, clamped);

    expect(biasedOver.linearOffset).toBe(biasedClamped.linearOffset);
    expect(biasedOver.curvature).toBe(biasedClamped.curvature);
    expect(biasedOver.grooveAmount).toBe(biasedClamped.grooveAmount);
  });

  it('harmonicGravity never drops below 1.0', () => {
    const profile = createDefaultGrooveProfile(90);
    const rng = new SeededRNG(42);
    const baseCtx = assembleGrooveContext(4, 'snare', profile, 0, rng, 'minor', 0.8);
    const ctx = { ...baseCtx, harmonicGravity: 1.0 };

    // All emotions with negative dGm at max
    const ev = { loneliness: 0, tension: 0, admiration: 1.0, defiance: 1.0, calm: 1.0 };
    const biased = applyEmotionalBias(ctx, ev);
    expect(biased.harmonicGravity).toBeGreaterThanOrEqual(1.0);
  });

  it('grooveAmount stays in [0.0, 1.0]', () => {
    const profile = createDefaultGrooveProfile(90);
    const rng = new SeededRNG(42);
    const baseCtx = assembleGrooveContext(4, 'snare', profile, 0, rng, 'minor', 0.8);

    // Test upper bound
    const ctxHigh = { ...baseCtx, grooveAmount: 0.99 };
    const evUp = { loneliness: 1.0, tension: 0, admiration: 1.0, defiance: 0, calm: 1.0 };
    const biasedUp = applyEmotionalBias(ctxHigh, evUp);
    expect(biasedUp.grooveAmount).toBeLessThanOrEqual(1.0);
    expect(biasedUp.grooveAmount).toBeGreaterThanOrEqual(0.0);

    // Test lower bound
    const ctxLow = { ...baseCtx, grooveAmount: 0.01 };
    const evDown = { loneliness: 0, tension: 1.0, admiration: 0, defiance: 1.0, calm: 0 };
    const biasedDown = applyEmotionalBias(ctxLow, evDown);
    expect(biasedDown.grooveAmount).toBeLessThanOrEqual(1.0);
    expect(biasedDown.grooveAmount).toBeGreaterThanOrEqual(0.0);
  });

  it('does not mutate the input context', () => {
    const profile = createDefaultGrooveProfile(90);
    const rng = new SeededRNG(42);
    const ctx = assembleGrooveContext(4, 'snare', profile, 0, rng, 'minor', 0.8);
    const originalOffset = ctx.linearOffset;
    const originalAmount = ctx.grooveAmount;

    const ev = { loneliness: 1.0, tension: 0.5, admiration: 0, defiance: 0, calm: 0 };
    applyEmotionalBias(ctx, ev);

    expect(ctx.linearOffset).toBe(originalOffset);
    expect(ctx.grooveAmount).toBe(originalAmount);
  });

  it('non-zero emotion vector produces different displacement', () => {
    const profile = createDefaultGrooveProfile(90);
    profile.drag_curve.enabled = true;
    profile.temporal_coupling.enabled = true;
    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(42);

    const ctx1 = assembleGrooveContext(8, 'snare', profile, 2, rng1, 'minor', 0.7);
    const ctx2 = assembleGrooveContext(8, 'snare', profile, 2, rng2, 'minor', 0.7);

    const ev = { loneliness: 0.8, tension: 0.0, admiration: 0.0, defiance: 0.0, calm: 0.0 };
    const biased = applyEmotionalBias(ctx2, ev);

    const disp1 = computeGrooveDisplacement(ctx1);
    const disp2 = computeGrooveDisplacement(biased);

    expect(disp1).not.toBe(disp2);
  });
});

// ── No branching on emotion type ──

describe('No emotion-type conditionals — RING 2 gate', () => {
  it('applyEmotionalBias source contains no if-emotion conditionals', async () => {
    // Structural test: read the source of applyEmotionalBias as a string
    const src = applyEmotionalBias.toString();
    // Must not contain conditional checks on specific emotion names
    expect(src).not.toMatch(/if\s*\(\s*.*===\s*['"]loneliness['"]/);
    expect(src).not.toMatch(/if\s*\(\s*.*===\s*['"]tension['"]/);
    expect(src).not.toMatch(/if\s*\(\s*.*===\s*['"]admiration['"]/);
    expect(src).not.toMatch(/if\s*\(\s*.*===\s*['"]defiance['"]/);
    expect(src).not.toMatch(/if\s*\(\s*.*===\s*['"]calm['"]/);
    // Must not contain switch on emotion
    expect(src).not.toMatch(/switch\s*\(/);
  });
});

// ── Existing preset identity at zero emotion ──

describe('Existing Preset Identity — zero emotion preserves output', () => {
  it('displacement with zero emotion === displacement without emotion', () => {
    const profile = createDefaultGrooveProfile(90);
    profile.drag_curve.enabled = true;
    profile.temporal_coupling.enabled = true;
    profile.harmonic_gravity.enabled = true;
    profile.macro_drift.enabled = true;

    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(42);

    const ctx1 = assembleGrooveContext(8, 'snare', profile, 2, rng1, 'minor', 0.7);
    const ctx2 = assembleGrooveContext(8, 'snare', profile, 2, rng2, 'minor', 0.7);

    const neutral = createNeutralEmotionVector();
    const biased = applyEmotionalBias(ctx2, neutral);

    expect(computeGrooveDisplacement(ctx1)).toBe(computeGrooveDisplacement(biased));
  });

  it('full pipeline with zero emotion matches pipeline without emotion', () => {
    const profile = createDefaultGrooveProfile(90);
    profile.drag_curve.enabled = true;

    // Run with neutral emotion_vector (as stored in default profile)
    const rng1 = new SeededRNG(42);
    const ctx1 = assembleGrooveContext(4, 'kick', profile, 0, rng1, 'minor', 0.9);
    const neutral = createNeutralEmotionVector();
    const biased1 = applyEmotionalBias(ctx1, neutral);
    const d1 = computeGrooveDisplacement(biased1);

    // Run without emotion vector
    const rng2 = new SeededRNG(42);
    const ctx2 = assembleGrooveContext(4, 'kick', profile, 0, rng2, 'minor', 0.9);
    const d2 = computeGrooveDisplacement(ctx2);

    expect(d1).toBe(d2);
  });
});

// ── D4 — Determinism & Hash Integrity ──

describe('Groove Hash includes emotional state — D4', () => {
  it('default profile with emotion_vector hashes consistently', async () => {
    const profile = createDefaultGrooveProfile(90);
    const hash1 = await computeGrooveHash(profile);
    const hash2 = await computeGrooveHash(profile);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changing emotion_vector changes the groove hash', async () => {
    const p1 = createDefaultGrooveProfile(90);
    const p2 = createDefaultGrooveProfile(90);
    p2.emotion_vector = { loneliness: 0.5, tension: 0, admiration: 0, defiance: 0, calm: 0 };

    const h1 = await computeGrooveHash(p1);
    const h2 = await computeGrooveHash(p2);
    expect(h1).not.toBe(h2);
  });

  it('emotion_vector key order does not affect hash (stableStringify)', async () => {
    const p1 = createDefaultGrooveProfile(90);
    p1.emotion_vector = { loneliness: 0.5, tension: 0.3, admiration: 0.1, defiance: 0.7, calm: 0.2 };

    const p2 = createDefaultGrooveProfile(90);
    p2.emotion_vector = { calm: 0.2, defiance: 0.7, admiration: 0.1, tension: 0.3, loneliness: 0.5 };

    const h1 = await computeGrooveHash(p1);
    const h2 = await computeGrooveHash(p2);
    expect(h1).toBe(h2);
  });

  it('profile without emotion_vector still hashes (backward compat)', async () => {
    const profile = createDefaultGrooveProfile(90);
    delete profile.emotion_vector;
    const hash = await computeGrooveHash(profile);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ── Reversibility ──

describe('Emotional modulation is reversible', () => {
  it('setting emotion to zero after non-zero returns to original displacement', () => {
    const profile = createDefaultGrooveProfile(90);
    profile.drag_curve.enabled = true;

    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(42);
    const rng3 = new SeededRNG(42);

    // Original (no emotion)
    const ctx1 = assembleGrooveContext(8, 'snare', profile, 2, rng1, 'minor', 0.7);
    const d_original = computeGrooveDisplacement(ctx1);

    // With emotion
    const ctx2 = assembleGrooveContext(8, 'snare', profile, 2, rng2, 'minor', 0.7);
    const ev = { loneliness: 0.8, tension: 0.4, admiration: 0, defiance: 0, calm: 0 };
    const biased = applyEmotionalBias(ctx2, ev);
    const d_emotional = computeGrooveDisplacement(biased);
    expect(d_emotional).not.toBe(d_original);

    // Reset to zero
    const ctx3 = assembleGrooveContext(8, 'snare', profile, 2, rng3, 'minor', 0.7);
    const neutral = createNeutralEmotionVector();
    const reset = applyEmotionalBias(ctx3, neutral);
    const d_reset = computeGrooveDisplacement(reset);
    expect(d_reset).toBe(d_original);
  });
});
