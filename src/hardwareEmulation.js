// ═══════════════════════════════════════════════════════════
// HARDWARE EMULATION LAYER — Layer 4
// PPQN Rounding + Signal Chain Configuration
// L0-CMD-2026-0216-006-A §3.3
// ═══════════════════════════════════════════════════════════
//
// Layer 4 applies time-domain constraints that replicate the
// quantization behavior of vintage hardware sequencers.
//
// PPQN rounding MUST occur (AC-02):
//   1. AFTER swing computation
//   2. AFTER drag curve computation
//   3. BEFORE final scheduling to AudioWorklet
//
// Pipeline: grid → drag → swing → microtiming → PPQN round → schedule

/**
 * Rounds timestamp to nearest PPQN pulse — creates the chunky
 * stiffness of vintage hardware sequencers.
 *
 * MUST be applied AFTER all timing warps but BEFORE final scheduling.
 *
 * @param {number} timeSeconds - Event time in seconds
 * @param {number} bpm - Current BPM
 * @param {number} ppqn - Pulses per quarter note (96 for MPC60, 480 for modern)
 * @returns {number} Rounded time in seconds
 */
export function roundToPPQN(timeSeconds, bpm, ppqn) {
  if (ppqn <= 0 || bpm <= 0) return timeSeconds;
  const secondsPerPulse = 60 / (bpm * ppqn);
  return Math.round(timeSeconds / secondsPerPulse) * secondsPerPulse;
}

/**
 * Default hardware emulation configurations for iconic hardware.
 */
export const HARDWARE_PRESETS = {
  mpc60: {
    ppqn: 96,
    signal_chain_order: 'saturate_downsample_quantize',
    dac_saturation: {
      enabled: true,
      curve: 'tanh',
      gain: 1.2,
    },
    anti_alias_filter: {
      type: 'chebyshev_type1',
      cutoff_hz: 18000,
      ripple_db: 0.5,
    },
    sample_rate: 26040,
    bit_depth: 12,
  },
  sp1200: {
    ppqn: 96,
    signal_chain_order: 'saturate_downsample_quantize',
    dac_saturation: {
      enabled: true,
      curve: 'tanh',
      gain: 1.4,
    },
    anti_alias_filter: {
      type: 'chebyshev_type1',
      cutoff_hz: 12000,
      ripple_db: 1.0,
    },
    sample_rate: 26040,
    bit_depth: 12,
  },
  modern: {
    ppqn: 480,
    signal_chain_order: 'saturate_downsample_quantize',
    dac_saturation: {
      enabled: false,
      curve: 'tanh',
      gain: 1.0,
    },
    anti_alias_filter: {
      type: 'chebyshev_type1',
      cutoff_hz: 20000,
      ripple_db: 0.1,
    },
    sample_rate: 44100,
    bit_depth: 16,
  },
};
