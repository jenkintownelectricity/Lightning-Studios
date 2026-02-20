// ═══════════════════════════════════════════════════════════
// Groove Hash — Tests for deterministic hashing & integrity verification
// ═══════════════════════════════════════════════════════════
import { describe, it, expect, vi } from 'vitest';
import {
  stableStringify,
  computeGrooveHash,
  createDefaultGrooveProfile,
} from './grooveEngine.js';

// Helper: build an exported kernel object mirroring BeatEngine.exportKernel logic
async function buildExportedKernel(grooveProfile) {
  const kernel = {
    schema_version: 'beat-kernel-v1',
    kernel_type: 'beat',
    metadata: {
      beat_id: 'BK-TEST',
      name: 'Test Beat',
      artist: 'Test Artist',
      created: '2026-01-01T00:00:00.000Z',
      modified: '2026-01-01T00:00:00.000Z',
      genre_tags: [],
      description: '',
      song_kernel_ref: null,
    },
    transport: { bpm: 90, swing: 0, key: 'C', scale: 'minor', time_signature: '4/4', steps_per_pattern: 16 },
    drums: { channels: [] },
    instruments: { channels: [] },
    master: {},
    groove_profile: grooveProfile,
    randomization_seed: grooveProfile?.randomization_seed ?? 42,
    groove_hash: null,
    arrangement: { pattern_chain: ['A'], patterns: { A: { name: 'Main', description: 'Primary pattern' } } },
  };
  if (grooveProfile && crypto?.subtle) {
    try {
      kernel.groove_hash = await computeGrooveHash(grooveProfile);
    } catch (_) { /* continue without hash */ }
  }
  return kernel;
}

// Helper: simulate importKernel hash verification (returns { loaded, warning })
async function simulateImport(kernelJSON) {
  const k = JSON.parse(kernelJSON);
  if (k.schema_version !== 'beat-kernel-v1') throw new Error('Not a Beat Kernel v1 file');

  let warning = null;
  if (k.groove_profile && k.groove_hash) {
    if (!crypto?.subtle) {
      warning = '[GrooveHashUnavailable] crypto.subtle not available';
    } else {
      try {
        const actual = await computeGrooveHash(k.groove_profile);
        if (actual !== k.groove_hash) {
          warning = `[GrooveHashMismatch] expected=${k.groove_hash} actual=${actual}`;
        }
      } catch (_) { /* hash verification failed */ }
    }
  }

  return { loaded: k, warning };
}

describe('Groove Hash — Export', () => {
  it('exported JSON includes groove_hash as a 64-character lowercase hex string', async () => {
    const profile = createDefaultGrooveProfile(90);
    const kernel = await buildExportedKernel(profile);

    expect(kernel.groove_hash).toBeDefined();
    expect(typeof kernel.groove_hash).toBe('string');
    expect(kernel.groove_hash).toHaveLength(64);
    expect(kernel.groove_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('exported JSON includes randomization_seed as a number', async () => {
    const profile = createDefaultGrooveProfile(90);
    const kernel = await buildExportedKernel(profile);

    expect(kernel.randomization_seed).toBeDefined();
    expect(typeof kernel.randomization_seed).toBe('number');
    expect(kernel.randomization_seed).toBe(42);
  });

  it('exporting twice with no changes produces identical groove_hash values', async () => {
    const profile = createDefaultGrooveProfile(90);
    const kernel1 = await buildExportedKernel(profile);
    const kernel2 = await buildExportedKernel(profile);

    expect(kernel1.groove_hash).toBe(kernel2.groove_hash);
  });
});

describe('Groove Hash — Import Integrity Verification', () => {
  it('importing an untampered export produces no GrooveHashMismatch warning', async () => {
    const profile = createDefaultGrooveProfile(90);
    const kernel = await buildExportedKernel(profile);
    const json = JSON.stringify(kernel, null, 2);

    const { loaded, warning } = await simulateImport(json);

    expect(warning).toBeNull();
    expect(loaded.groove_profile).toEqual(profile);
  });

  it('tampering any groove_profile field triggers [GrooveHashMismatch] warning but import still succeeds', async () => {
    const profile = createDefaultGrooveProfile(90);
    const kernel = await buildExportedKernel(profile);

    // Tamper with groove_profile after hashing
    kernel.groove_profile.bpm = 120;
    const json = JSON.stringify(kernel, null, 2);

    const { loaded, warning } = await simulateImport(json);

    expect(warning).not.toBeNull();
    expect(warning).toMatch(/^\[GrooveHashMismatch\] expected=.+ actual=.+$/);
    // Import still succeeds (non-blocking)
    expect(loaded.groove_profile.bpm).toBe(120);
    expect(loaded.transport).toBeDefined();
  });

  it('reordering groove_profile keys does not change the hash (stableStringify)', async () => {
    const profile = createDefaultGrooveProfile(90);
    const hash1 = await computeGrooveHash(profile);

    // Create a reordered version of the same profile
    const keys = Object.keys(profile);
    const reversed = {};
    for (let i = keys.length - 1; i >= 0; i--) {
      reversed[keys[i]] = profile[keys[i]];
    }

    const hash2 = await computeGrooveHash(reversed);
    expect(hash1).toBe(hash2);

    // Also verify stableStringify directly
    expect(stableStringify(profile)).toBe(stableStringify(reversed));

    // Verify that import with reordered profile does not warn
    const kernel = await buildExportedKernel(profile);
    kernel.groove_profile = reversed;
    const json = JSON.stringify(kernel, null, 2);

    const { warning } = await simulateImport(json);
    expect(warning).toBeNull();
  });
});

describe('stableStringify — determinism', () => {
  it('produces identical output regardless of key insertion order', () => {
    const a = { z: 1, a: 2, m: 3 };
    const b = { a: 2, m: 3, z: 1 };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('preserves array order', () => {
    const a = { items: [3, 1, 2] };
    const b = { items: [1, 2, 3] };
    expect(stableStringify(a)).not.toBe(stableStringify(b));
  });

  it('handles nested objects with different key orders', () => {
    const a = { outer: { z: { b: 2, a: 1 }, a: 'first' } };
    const b = { outer: { a: 'first', z: { a: 1, b: 2 } } };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('handles null, numbers, booleans, and strings', () => {
    expect(stableStringify(null)).toBe('null');
    expect(stableStringify(42)).toBe('42');
    expect(stableStringify(true)).toBe('true');
    expect(stableStringify('hello')).toBe('"hello"');
  });
});
