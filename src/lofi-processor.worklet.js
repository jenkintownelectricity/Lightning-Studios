// ═══════════════════════════════════════════════════════════
// LO-FI PROCESSOR — Layer 5: AudioWorklet
// Signal Processing for Hardware-Emulated Profiles
// L0-CMD-2026-0216-006-A §3.3.3
// ═══════════════════════════════════════════════════════════
//
// Signal chain order for hardware_emulated profiles (AC-02, Rule 14):
//   1. Pre-saturation: tanh(gain · x)  — analog domain
//   2. Anti-alias filtering: Chebyshev Type I LPF
//   3. Downsample to target sample rate
//   4. Bit-depth quantization: round(x · 2^(bits-1)) / 2^(bits-1)
//
// This order replicates real hardware behavior:
// Real hardware saturates in analog, then samples, then quantizes.

class LofiProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'enabled', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'saturationGain', defaultValue: 1.0, minValue: 0.5, maxValue: 4.0 },
      { name: 'saturationEnabled', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'targetSampleRate', defaultValue: 26040, minValue: 4000, maxValue: 48000 },
      { name: 'bitDepth', defaultValue: 12, minValue: 4, maxValue: 24 },
      { name: 'downsampleEnabled', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'crackleAmount', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'dryWet', defaultValue: 1.0, minValue: 0, maxValue: 1 },
    ];
  }

  constructor() {
    super();
    // Downsample state per channel
    this._holdSample = [0, 0];
    this._holdCounter = [0, 0];
    // Simple one-pole lowpass for anti-alias approximation
    this._lpState = [0, 0];
    // Seeded crackle PRNG (deterministic)
    this._crackleSeed = 12345;
  }

  // Simple deterministic PRNG for crackle (mulberry32)
  _nextRandom() {
    this._crackleSeed |= 0;
    this._crackleSeed = this._crackleSeed + 0x6D2B79F5 | 0;
    let t = Math.imul(this._crackleSeed ^ this._crackleSeed >>> 15, 1 | this._crackleSeed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input.length) return true;

    const enabled = parameters.enabled[0] >= 0.5;
    if (!enabled) {
      // Pass-through
      for (let ch = 0; ch < output.length; ch++) {
        if (input[ch]) output[ch].set(input[ch]);
      }
      return true;
    }

    const satGain = parameters.saturationGain[0];
    const satEnabled = parameters.saturationEnabled[0] >= 0.5;
    const targetSR = parameters.targetSampleRate[0];
    const bitDepth = parameters.bitDepth[0];
    const dsEnabled = parameters.downsampleEnabled[0] >= 0.5;
    const crackle = parameters.crackleAmount[0];
    const dryWet = parameters.dryWet[0];

    // Compute downsample ratio
    const dsRatio = dsEnabled ? Math.max(1, Math.floor(sampleRate / targetSR)) : 1;
    // Quantization levels
    const quantLevels = Math.pow(2, bitDepth - 1);

    for (let ch = 0; ch < output.length && ch < input.length; ch++) {
      const inp = input[ch];
      const out = output[ch];

      for (let i = 0; i < inp.length; i++) {
        let sample = inp[i];
        const dry = sample;

        // ── Step 1: Pre-saturation (tanh) — analog domain ──
        if (satEnabled) {
          sample = Math.tanh(satGain * sample);
        }

        // ── Step 2: Anti-alias filter (simple one-pole LPF approximation) ──
        if (dsEnabled && dsRatio > 1) {
          const cutoffNorm = targetSR / (2 * sampleRate);
          const alpha = Math.min(1.0, 2 * Math.PI * cutoffNorm);
          this._lpState[ch] += alpha * (sample - this._lpState[ch]);
          sample = this._lpState[ch];
        }

        // ── Step 3: Downsample (sample-and-hold) ──
        if (dsEnabled && dsRatio > 1) {
          this._holdCounter[ch]++;
          if (this._holdCounter[ch] >= dsRatio) {
            this._holdCounter[ch] = 0;
            this._holdSample[ch] = sample;
          }
          sample = this._holdSample[ch];
        }

        // ── Step 4: Bit-depth quantization ──
        if (dsEnabled) {
          sample = Math.round(sample * quantLevels) / quantLevels;
        }

        // ── Optional: Vinyl crackle ──
        if (crackle > 0) {
          if (this._nextRandom() < crackle * 0.002) {
            sample += (this._nextRandom() - 0.5) * crackle * 0.15;
          }
        }

        // Dry/wet mix
        out[i] = dry * (1 - dryWet) + sample * dryWet;
      }
    }

    return true;
  }
}

registerProcessor('lofi-processor', LofiProcessor);
