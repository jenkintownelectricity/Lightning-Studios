import { useState, useRef, useEffect, useCallback } from "react";

// ═══════════════════════════════════════════════════════════
// LIGHTNING BEATS — Beat Production Engine
// Beat Kernel v1 | Part of Lightning Studio
// ═══════════════════════════════════════════════════════════

// ── Constants ──
const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const SCALES = {
  major: [0,2,4,5,7,9,11], minor: [0,2,3,5,7,8,10], dorian: [0,2,3,5,7,9,10],
  phrygian: [0,1,3,5,7,8,10], mixolydian: [0,2,4,5,7,9,10],
  blues: [0,3,5,6,7,10], pentatonic: [0,2,4,7,9], chromatic: [0,1,2,3,4,5,6,7,8,9,10,11],
};
const KEY_INDICES = { C:0,"C#":1,Db:1,D:2,"D#":3,Eb:3,E:4,F:5,"F#":6,Gb:6,G:7,"G#":8,Ab:8,A:9,"A#":10,Bb:10,B:11 };

function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function midiToName(m) { return NOTE_NAMES[m % 12] + (Math.floor(m / 12) - 1); }
function getScaleNotes(key, scale, octLow, octHigh) {
  const ki = KEY_INDICES[key] ?? 0;
  const intervals = SCALES[scale] || SCALES.minor;
  const notes = [];
  for (let oct = octLow; oct <= octHigh; oct++) {
    for (const iv of intervals) {
      const midi = (oct + 1) * 12 + ki + iv;
      if (midi >= 0 && midi <= 127) notes.push({ midi, name: midiToName(midi) });
    }
  }
  return notes;
}

// ── Default Drum Channels ──
const mkSteps = (n, pattern) => Array.from({ length: n }, (_, i) => ({
  active: pattern ? pattern.includes(i) : false, velocity: 0.8,
}));

function defaultDrums(steps = 16) {
  return [
    { id:"kick", name:"Kick", enabled:true,
      synthesis:{ type:"sine_pitch_env", start_freq:150, end_freq:40, pitch_decay:0.1, gain_attack:0.001, gain_decay:0.3, noise_mix:0 },
      mixer:{ volume:0.9, pan:0, mute:false, solo:false, reverb_send:0 },
      pattern:{ steps: mkSteps(steps) } },
    { id:"snare", name:"Snare", enabled:true,
      synthesis:{ type:"sine_plus_noise", sine_freq:180, sine_decay:0.1, noise_filter_type:"bandpass", noise_filter_freq:2000, noise_decay:0.2, noise_mix:0.7, gain_decay:0.2 },
      mixer:{ volume:0.85, pan:0, mute:false, solo:false, reverb_send:0.15 },
      pattern:{ steps: mkSteps(steps) } },
    { id:"hihat_closed", name:"HH Closed", enabled:true,
      synthesis:{ type:"filtered_noise", filter_type:"highpass", filter_freq:8000, gain_decay:0.05 },
      mixer:{ volume:0.6, pan:0.1, mute:false, solo:false, reverb_send:0.05 },
      pattern:{ steps: mkSteps(steps) } },
    { id:"hihat_open", name:"HH Open", enabled:true,
      synthesis:{ type:"filtered_noise", filter_type:"highpass", filter_freq:8000, gain_decay:0.3 },
      mixer:{ volume:0.55, pan:0.1, mute:false, solo:false, reverb_send:0.1 },
      pattern:{ steps: mkSteps(steps) } },
    { id:"clap", name:"Clap", enabled:true,
      synthesis:{ type:"noise_burst", filter_type:"bandpass", filter_freq:1500, filter_q:2, gain_decay:0.15, double_hit:true, double_hit_delay:0.02 },
      mixer:{ volume:0.7, pan:0, mute:false, solo:false, reverb_send:0.2 },
      pattern:{ steps: mkSteps(steps) } },
    { id:"rim", name:"Rim", enabled:true,
      synthesis:{ type:"sine_short", freq:800, gain_decay:0.02 },
      mixer:{ volume:0.5, pan:-0.1, mute:false, solo:false, reverb_send:0.1 },
      pattern:{ steps: mkSteps(steps) } },
    { id:"tom", name:"Tom", enabled:true,
      synthesis:{ type:"sine_pitch_env", start_freq:200, end_freq:80, pitch_decay:0.15, gain_attack:0.001, gain_decay:0.2, noise_mix:0 },
      mixer:{ volume:0.7, pan:-0.2, mute:false, solo:false, reverb_send:0.15 },
      pattern:{ steps: mkSteps(steps) } },
    { id:"crash", name:"Crash", enabled:true,
      synthesis:{ type:"filtered_noise", filter_type:"bandpass", filter_freq:5000, filter_q:0.5, gain_decay:1.5 },
      mixer:{ volume:0.5, pan:0.2, mute:false, solo:false, reverb_send:0.3 },
      pattern:{ steps: mkSteps(steps) } },
  ];
}

// ── Default Instrument Channels ──
function defaultInstruments() {
  return [
    { id:"bass", name:"Bass", enabled:true,
      synthesis:{ waveform:"sawtooth", sub_waveform:"sine", sub_mix:0.5, voices:1, attack:0.01, decay:0.2, sustain:0.7, release:0.1, filter_type:"lowpass", filter_freq:800, filter_q:2, detune:0, octave:2 },
      mixer:{ volume:0.75, pan:0, mute:false, solo:false, reverb_send:0 }, notes:[] },
    { id:"piano", name:"Piano", enabled:true,
      synthesis:{ waveform:"triangle", voices:2, voice_detune:8, attack:0.005, decay:0.5, sustain:0.3, release:0.2, filter_type:"lowpass", filter_freq:4000, filter_q:0.5, detune:0, octave:4 },
      mixer:{ volume:0.6, pan:-0.1, mute:false, solo:false, reverb_send:0.25 }, notes:[] },
    { id:"strings", name:"Strings", enabled:true,
      synthesis:{ waveform:"sawtooth", voices:4, voice_detune:12, attack:0.5, decay:0.1, sustain:0.8, release:1.0, filter_type:"lowpass", filter_freq:3000, filter_q:0.7, detune:0, octave:3 },
      mixer:{ volume:0.5, pan:0, mute:false, solo:false, reverb_send:0.4 }, notes:[] },
    { id:"lead", name:"Lead", enabled:true,
      synthesis:{ waveform:"sawtooth", voices:1, attack:0.02, decay:0.3, sustain:0.6, release:0.15, filter_type:"lowpass", filter_freq:2500, filter_q:3, vibrato_rate:5, vibrato_depth:10, detune:0, octave:4 },
      mixer:{ volume:0.55, pan:0.15, mute:false, solo:false, reverb_send:0.2 }, notes:[] },
    { id:"pluck", name:"Pluck", enabled:true,
      synthesis:{ waveform:"triangle", voices:1, attack:0.002, decay:0.3, sustain:0, release:0.05, filter_type:"lowpass", filter_freq:6000, filter_q:0.5, detune:0, octave:5 },
      mixer:{ volume:0.45, pan:0.25, mute:false, solo:false, reverb_send:0.3 }, notes:[] },
  ];
}

// ── Default Master ──
function defaultMaster() {
  return {
    volume: 0.8,
    reverb: { enabled:true, room_size:0.5, decay:2.0, wet:0.2, dry:0.8 },
    delay: { enabled:true, time_ms:300, feedback:0.3, wet:0.15 },
    compressor: { enabled:true, threshold_db:-12, ratio:4, attack_ms:3, release_ms:250 },
    eq: { enabled:true, low_gain_db:0, low_freq:200, mid_gain_db:0, mid_freq:1000, mid_q:1, high_gain_db:0, high_freq:4000 },
  };
}

// ── Presets ──
function presetBoomBap() {
  const d = defaultDrums();
  [0,8].forEach(i => { d[0].pattern.steps[i].active = true; d[0].pattern.steps[i].velocity = 1; });
  [4,12].forEach(i => { d[1].pattern.steps[i].active = true; d[1].pattern.steps[i].velocity = 0.9; });
  [0,2,4,6,8,10,12,14].forEach(i => { d[2].pattern.steps[i].active = true; d[2].pattern.steps[i].velocity = 0.7; });
  const inst = defaultInstruments();
  inst[0].notes = [
    { step:0, midi_note:36, note_name:"C2", length_steps:4, velocity:0.8 },
    { step:4, midi_note:34, note_name:"Bb1", length_steps:2, velocity:0.7 },
    { step:8, midi_note:39, note_name:"Eb2", length_steps:4, velocity:0.8 },
    { step:12, midi_note:31, note_name:"G1", length_steps:2, velocity:0.7 },
  ];
  inst[1].notes = [
    { step:0, midi_note:60, note_name:"C4", length_steps:2, velocity:0.6 },
    { step:4, midi_note:63, note_name:"Eb4", length_steps:2, velocity:0.5 },
    { step:8, midi_note:67, note_name:"G4", length_steps:2, velocity:0.6 },
    { step:12, midi_note:60, note_name:"C4", length_steps:2, velocity:0.5 },
  ];
  return { transport:{ bpm:90, swing:0.15, time_signature:"4/4", key:"C", scale:"minor", steps_per_pattern:16 },
    drums:d, instruments:inst, master:defaultMaster(), label:"Boom-Bap Classic" };
}

function presetTrap() {
  const d = defaultDrums();
  [0,3,6,10,13].forEach(i => { d[0].pattern.steps[i].active = true; d[0].pattern.steps[i].velocity = 1; });
  [4,12].forEach(i => { d[1].pattern.steps[i].active = true; d[1].pattern.steps[i].velocity = 0.95; });
  for (let i = 0; i < 16; i++) {
    d[2].pattern.steps[i].active = true;
    d[2].pattern.steps[i].velocity = i % 4 === 0 ? 1 : i % 2 === 0 ? 0.7 : 0.4;
  }
  [7,15].forEach(i => { d[3].pattern.steps[i].active = true; d[3].pattern.steps[i].velocity = 0.7; });
  const inst = defaultInstruments();
  inst[0].notes = [
    { step:0, midi_note:29, note_name:"F1", length_steps:8, velocity:0.9 },
    { step:8, midi_note:27, note_name:"Eb1", length_steps:8, velocity:0.85 },
  ];
  inst[0].synthesis.octave = 1;
  return { transport:{ bpm:140, swing:0, time_signature:"4/4", key:"F", scale:"minor", steps_per_pattern:16 },
    drums:d, instruments:inst, master:defaultMaster(), label:"Trap Standard" };
}

function presetDrill() {
  const d = defaultDrums();
  [2,7,11].forEach(i => { d[0].pattern.steps[i].active = true; d[0].pattern.steps[i].velocity = 1; });
  [4,14].forEach(i => { d[1].pattern.steps[i].active = true; d[1].pattern.steps[i].velocity = 0.9; });
  for (let i = 0; i < 16; i++) {
    d[2].pattern.steps[i].active = true;
    d[2].pattern.steps[i].velocity = i % 2 === 0 ? 0.8 : 0.5;
  }
  [3,7,11,15].forEach(i => { d[3].pattern.steps[i].active = true; d[3].pattern.steps[i].velocity = 0.6; });
  const inst = defaultInstruments();
  inst[0].notes = [
    { step:0, midi_note:31, note_name:"G1", length_steps:6, velocity:0.9 },
    { step:8, midi_note:29, note_name:"F1", length_steps:6, velocity:0.85 },
  ];
  return { transport:{ bpm:145, swing:0, time_signature:"4/4", key:"G", scale:"minor", steps_per_pattern:16 },
    drums:d, instruments:inst, master:defaultMaster(), label:"Drill Pattern" };
}

function presetLofi() {
  const d = defaultDrums();
  [0,7,10].forEach(i => { d[0].pattern.steps[i].active = true; d[0].pattern.steps[i].velocity = 0.85; });
  [4,12].forEach(i => { d[1].pattern.steps[i].active = true; d[1].pattern.steps[i].velocity = 0.7; });
  [0,4,8,12].forEach(i => { d[2].pattern.steps[i].active = true; d[2].pattern.steps[i].velocity = 0.5; });
  const inst = defaultInstruments();
  inst[1].notes = [
    { step:0, midi_note:60, note_name:"C4", length_steps:2, velocity:0.5 },
    { step:2, midi_note:63, note_name:"Eb4", length_steps:2, velocity:0.4 },
    { step:6, midi_note:67, note_name:"G4", length_steps:2, velocity:0.5 },
    { step:10, midi_note:70, note_name:"Bb4", length_steps:2, velocity:0.4 },
    { step:14, midi_note:72, note_name:"C5", length_steps:2, velocity:0.3 },
  ];
  const m = defaultMaster();
  m.reverb.wet = 0.35; m.eq.high_gain_db = -3;
  return { transport:{ bpm:75, swing:0.35, time_signature:"4/4", key:"C", scale:"minor", steps_per_pattern:16 },
    drums:d, instruments:inst, master:m, label:"Lo-Fi Chill" };
}

function presetPhilly() {
  const d = defaultDrums();
  [0,3,8,11].forEach(i => { d[0].pattern.steps[i].active = true; d[0].pattern.steps[i].velocity = 1; });
  [4,12].forEach(i => { d[1].pattern.steps[i].active = true; d[1].pattern.steps[i].velocity = 0.9; });
  [0,2,4,6,8,10,12,14].forEach(i => { d[2].pattern.steps[i].active = true; d[2].pattern.steps[i].velocity = 0.6; });
  [2,6,10,14].forEach(i => { d[5].pattern.steps[i].active = true; d[5].pattern.steps[i].velocity = 0.65; });
  const inst = defaultInstruments();
  inst[0].notes = [
    { step:0, midi_note:38, note_name:"D2", length_steps:4, velocity:0.85 },
    { step:4, midi_note:36, note_name:"C2", length_steps:2, velocity:0.7 },
    { step:8, midi_note:41, note_name:"F2", length_steps:4, velocity:0.8 },
    { step:12, midi_note:38, note_name:"D2", length_steps:4, velocity:0.75 },
  ];
  return { transport:{ bpm:88, swing:0.15, time_signature:"4/4", key:"D", scale:"minor", steps_per_pattern:16 },
    drums:d, instruments:inst, master:defaultMaster(), label:"Philly Boom" };
}

function presetCinematic() {
  const d = defaultDrums();
  [0].forEach(i => { d[0].pattern.steps[i].active = true; d[0].pattern.steps[i].velocity = 1; });
  [8].forEach(i => { d[1].pattern.steps[i].active = true; d[1].pattern.steps[i].velocity = 0.8; });
  const inst = defaultInstruments();
  inst[0].notes = [
    { step:0, midi_note:38, note_name:"D2", length_steps:16, velocity:0.9 },
  ];
  inst[2].notes = [
    { step:0, midi_note:50, note_name:"D3", length_steps:8, velocity:0.5 },
    { step:0, midi_note:53, note_name:"F3", length_steps:8, velocity:0.45 },
    { step:0, midi_note:57, note_name:"A3", length_steps:8, velocity:0.45 },
    { step:8, midi_note:48, note_name:"C3", length_steps:8, velocity:0.5 },
    { step:8, midi_note:53, note_name:"F3", length_steps:8, velocity:0.45 },
    { step:8, midi_note:57, note_name:"A3", length_steps:8, velocity:0.45 },
  ];
  inst[1].notes = [
    { step:0, midi_note:62, note_name:"D4", length_steps:2, velocity:0.45 },
    { step:4, midi_note:65, note_name:"F4", length_steps:2, velocity:0.4 },
    { step:8, midi_note:69, note_name:"A4", length_steps:2, velocity:0.5 },
    { step:12, midi_note:67, note_name:"G4", length_steps:2, velocity:0.4 },
  ];
  const m = defaultMaster();
  m.reverb.wet = 0.4; m.reverb.decay = 3; m.delay.wet = 0.2;
  return { transport:{ bpm:85, swing:0, time_signature:"4/4", key:"D", scale:"minor", steps_per_pattern:16 },
    drums:d, instruments:inst, master:m, label:"Cinematic Dark" };
}

const PRESETS = [presetBoomBap, presetTrap, presetDrill, presetLofi, presetPhilly, presetCinematic];

// ── Audio Synthesis ──
let noiseBuffer = null;
function getNoiseBuffer(actx) {
  if (noiseBuffer && noiseBuffer.sampleRate === actx.sampleRate) return noiseBuffer;
  const len = actx.sampleRate * 2;
  const buf = actx.createBuffer(1, len, actx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  noiseBuffer = buf;
  return buf;
}

function createReverbIR(actx, duration, decayPower) {
  const len = actx.sampleRate * duration;
  const buf = actx.createBuffer(2, len, actx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decayPower);
  }
  return buf;
}

function synthDrum(actx, dest, time, synth, velocity) {
  const v = velocity;
  const t = synth.type;
  if (t === "sine_pitch_env") {
    const osc = actx.createOscillator(); osc.type = "sine";
    osc.frequency.setValueAtTime(synth.start_freq, time);
    osc.frequency.exponentialRampToValueAtTime(Math.max(synth.end_freq, 1), time + synth.pitch_decay);
    const g = actx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(v, time + (synth.gain_attack || 0.001));
    g.gain.exponentialRampToValueAtTime(0.001, time + synth.gain_decay);
    osc.connect(g); g.connect(dest);
    osc.start(time); osc.stop(time + synth.gain_decay + 0.05);
    if (synth.noise_mix > 0) {
      const ns = actx.createBufferSource(); ns.buffer = getNoiseBuffer(actx);
      const ng = actx.createGain();
      ng.gain.setValueAtTime(synth.noise_mix * v, time);
      ng.gain.exponentialRampToValueAtTime(0.001, time + synth.gain_decay);
      ns.connect(ng); ng.connect(dest); ns.start(time); ns.stop(time + synth.gain_decay + 0.05);
    }
  } else if (t === "sine_plus_noise") {
    const osc = actx.createOscillator(); osc.type = "sine";
    osc.frequency.value = synth.sine_freq || 180;
    const og = actx.createGain();
    og.gain.setValueAtTime(v * (1 - (synth.noise_mix || 0.5)), time);
    og.gain.exponentialRampToValueAtTime(0.001, time + (synth.sine_decay || 0.1));
    osc.connect(og); og.connect(dest);
    osc.start(time); osc.stop(time + (synth.sine_decay || 0.1) + 0.05);
    const ns = actx.createBufferSource(); ns.buffer = getNoiseBuffer(actx);
    const nf = actx.createBiquadFilter();
    nf.type = synth.noise_filter_type || "bandpass"; nf.frequency.value = synth.noise_filter_freq || 2000;
    const ng = actx.createGain();
    ng.gain.setValueAtTime(v * (synth.noise_mix || 0.5), time);
    ng.gain.exponentialRampToValueAtTime(0.001, time + (synth.noise_decay || 0.2));
    ns.connect(nf); nf.connect(ng); ng.connect(dest);
    ns.start(time); ns.stop(time + (synth.noise_decay || 0.2) + 0.05);
  } else if (t === "filtered_noise") {
    const ns = actx.createBufferSource(); ns.buffer = getNoiseBuffer(actx);
    const f = actx.createBiquadFilter();
    f.type = synth.filter_type || "highpass"; f.frequency.value = synth.filter_freq || 8000;
    if (synth.filter_q) f.Q.value = synth.filter_q;
    const g = actx.createGain();
    g.gain.setValueAtTime(v, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + (synth.gain_decay || 0.05));
    ns.connect(f); f.connect(g); g.connect(dest);
    ns.start(time); ns.stop(time + (synth.gain_decay || 0.05) + 0.1);
  } else if (t === "noise_burst") {
    const play1 = (t0) => {
      const ns = actx.createBufferSource(); ns.buffer = getNoiseBuffer(actx);
      const f = actx.createBiquadFilter();
      f.type = synth.filter_type || "bandpass"; f.frequency.value = synth.filter_freq || 1500;
      if (synth.filter_q) f.Q.value = synth.filter_q;
      const g = actx.createGain();
      g.gain.setValueAtTime(v, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + (synth.gain_decay || 0.15));
      ns.connect(f); f.connect(g); g.connect(dest);
      ns.start(t0); ns.stop(t0 + (synth.gain_decay || 0.15) + 0.05);
    };
    play1(time);
    if (synth.double_hit) play1(time + (synth.double_hit_delay || 0.02));
  } else if (t === "sine_short") {
    const osc = actx.createOscillator(); osc.type = "sine";
    osc.frequency.value = synth.freq || 800;
    const g = actx.createGain();
    g.gain.setValueAtTime(v, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + (synth.gain_decay || 0.02));
    osc.connect(g); g.connect(dest);
    osc.start(time); osc.stop(time + (synth.gain_decay || 0.02) + 0.02);
  }
}

function synthNote(actx, dest, time, midi, duration, synth, velocity) {
  const freq = midiToFreq(midi);
  const voices = synth.voices || 1;
  const vDetune = synth.voice_detune || 0;
  const endTime = time + duration;
  const relEnd = endTime + (synth.release || 0.1);

  for (let vi = 0; vi < voices; vi++) {
    const osc = actx.createOscillator();
    osc.type = synth.waveform || "sawtooth";
    const detOff = voices > 1 ? (vi / (voices - 1) - 0.5) * vDetune * 2 : 0;
    osc.detune.value = (synth.detune || 0) + detOff;
    osc.frequency.value = freq;

    if (synth.vibrato_rate && synth.vibrato_depth) {
      const lfo = actx.createOscillator(); lfo.frequency.value = synth.vibrato_rate;
      const lfoG = actx.createGain(); lfoG.gain.value = synth.vibrato_depth;
      lfo.connect(lfoG); lfoG.connect(osc.detune);
      lfo.start(time); lfo.stop(relEnd + 0.1);
    }

    const filt = actx.createBiquadFilter();
    filt.type = synth.filter_type || "lowpass";
    filt.frequency.value = synth.filter_freq || 4000;
    filt.Q.value = synth.filter_q || 1;

    const env = actx.createGain();
    const vol = velocity / voices;
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(vol, time + synth.attack);
    env.gain.linearRampToValueAtTime(vol * synth.sustain, time + synth.attack + synth.decay);
    env.gain.setValueAtTime(vol * synth.sustain, endTime);
    env.gain.linearRampToValueAtTime(0.001, relEnd);

    osc.connect(filt); filt.connect(env); env.connect(dest);
    osc.start(time); osc.stop(relEnd + 0.05);
  }

  if (synth.sub_waveform && synth.sub_mix) {
    const sub = actx.createOscillator(); sub.type = synth.sub_waveform;
    sub.frequency.value = freq / 2;
    const sg = actx.createGain();
    sg.gain.setValueAtTime(0, time);
    sg.gain.linearRampToValueAtTime(velocity * synth.sub_mix, time + synth.attack);
    sg.gain.setValueAtTime(velocity * synth.sub_mix * synth.sustain, endTime);
    sg.gain.linearRampToValueAtTime(0.001, relEnd);
    sub.connect(sg); sg.connect(dest);
    sub.start(time); sub.stop(relEnd + 0.05);
  }
}

// ── Master Effects Chain Builder ──
function buildMasterChain(actx, masterCfg) {
  const dryBus = actx.createGain(); dryBus.gain.value = 1;
  const reverbBus = actx.createGain(); reverbBus.gain.value = 1;
  const masterGain = actx.createGain(); masterGain.gain.value = masterCfg.volume;

  let convolver = null, reverbWet = null;
  if (masterCfg.reverb.enabled) {
    convolver = actx.createConvolver();
    convolver.buffer = createReverbIR(actx, masterCfg.reverb.decay, 2 + masterCfg.reverb.room_size * 3);
    reverbWet = actx.createGain(); reverbWet.gain.value = masterCfg.reverb.wet;
    reverbBus.connect(convolver); convolver.connect(reverbWet); reverbWet.connect(masterGain);
  }

  let eqLow, eqMid, eqHigh, lastEq = dryBus;
  if (masterCfg.eq.enabled) {
    eqLow = actx.createBiquadFilter(); eqLow.type = "lowshelf";
    eqLow.frequency.value = masterCfg.eq.low_freq; eqLow.gain.value = masterCfg.eq.low_gain_db;
    eqMid = actx.createBiquadFilter(); eqMid.type = "peaking";
    eqMid.frequency.value = masterCfg.eq.mid_freq; eqMid.Q.value = masterCfg.eq.mid_q; eqMid.gain.value = masterCfg.eq.mid_gain_db;
    eqHigh = actx.createBiquadFilter(); eqHigh.type = "highshelf";
    eqHigh.frequency.value = masterCfg.eq.high_freq; eqHigh.gain.value = masterCfg.eq.high_gain_db;
    dryBus.connect(eqLow); eqLow.connect(eqMid); eqMid.connect(eqHigh);
    lastEq = eqHigh;
  }

  let comp = null;
  if (masterCfg.compressor.enabled) {
    comp = actx.createDynamicsCompressor();
    comp.threshold.value = masterCfg.compressor.threshold_db;
    comp.ratio.value = masterCfg.compressor.ratio;
    comp.attack.value = masterCfg.compressor.attack_ms / 1000;
    comp.release.value = masterCfg.compressor.release_ms / 1000;
    lastEq.connect(comp); comp.connect(masterGain);
  } else {
    lastEq.connect(masterGain);
  }

  if (masterCfg.delay.enabled) {
    const del = actx.createDelay(2); del.delayTime.value = masterCfg.delay.time_ms / 1000;
    const fb = actx.createGain(); fb.gain.value = masterCfg.delay.feedback;
    const dw = actx.createGain(); dw.gain.value = masterCfg.delay.wet;
    dryBus.connect(del); del.connect(fb); fb.connect(del); del.connect(dw); dw.connect(masterGain);
  }

  masterGain.connect(actx.destination);
  return { dryBus, reverbBus, masterGain };
}

function routeToMaster(actx, chain, mixer, velocity) {
  const cg = actx.createGain(); cg.gain.value = mixer.volume * velocity;
  const cp = actx.createStereoPanner(); cp.pan.value = mixer.pan;
  cg.connect(cp);
  const dryG = actx.createGain(); dryG.gain.value = 1 - (mixer.reverb_send || 0);
  cp.connect(dryG); dryG.connect(chain.dryBus);
  if (mixer.reverb_send > 0) {
    const rg = actx.createGain(); rg.gain.value = mixer.reverb_send;
    cp.connect(rg); rg.connect(chain.reverbBus);
  }
  return cg;
}

// ═══════════════════════════════════════════════════════════
// BEAT ENGINE COMPONENT
// ═══════════════════════════════════════════════════════════
export default function BeatEngine({ briefBpm, briefKey, onBounce, onExportKernel, artistName }) {
  const [transport, setTransport] = useState({ bpm: briefBpm || 90, swing: 0.15, time_signature: "4/4", key: briefKey || "C", scale: "minor", steps_per_pattern: 16 });
  const [drums, setDrums] = useState(() => defaultDrums());
  const [instruments, setInstruments] = useState(() => defaultInstruments());
  const [master, setMaster] = useState(() => defaultMaster());
  const [playing, setPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [activeInstTab, setActiveInstTab] = useState(0);
  const [drawVelocity, setDrawVelocity] = useState(0.8);
  const [view, setView] = useState("drums"); // drums | instruments | mixer | master
  const [beatName, setBeatName] = useState("Untitled Beat");
  const [bouncing, setBouncing] = useState(false);

  const actxRef = useRef(null);
  const chainRef = useRef(null);
  const schedulerRef = useRef(null);
  const stepRef = useRef(0);
  const nextTimeRef = useRef(0);
  const drumsRef = useRef(drums);
  const instRef = useRef(instruments);
  const masterRef = useRef(master);
  const transportRef = useRef(transport);

  useEffect(() => { drumsRef.current = drums; }, [drums]);
  useEffect(() => { instRef.current = instruments; }, [instruments]);
  useEffect(() => { masterRef.current = master; }, [master]);
  useEffect(() => { transportRef.current = transport; }, [transport]);

  // Sync BPM/key from brief when changed
  useEffect(() => {
    if (briefBpm && !playing) setTransport(t => ({ ...t, bpm: briefBpm }));
  }, [briefBpm]);
  useEffect(() => {
    if (briefKey && !playing) setTransport(t => ({ ...t, key: briefKey }));
  }, [briefKey]);

  // ── Scheduler ──
  const scheduleStep = useCallback((step, time, actx, chain) => {
    const dr = drumsRef.current;
    const ins = instRef.current;
    const tr = transportRef.current;
    const hasSoloD = dr.some(c => c.mixer.solo);
    const hasSoloI = ins.some(c => c.mixer.solo);

    dr.forEach(ch => {
      if (!ch.enabled || ch.mixer.mute) return;
      if (hasSoloD && !ch.mixer.solo) return;
      const s = ch.pattern.steps[step];
      if (s && s.active) {
        const dest = routeToMaster(actx, chain, ch.mixer, s.velocity);
        synthDrum(actx, dest, time, ch.synthesis, s.velocity);
      }
    });

    const secPerStep = 60 / tr.bpm / 4;
    ins.forEach(ch => {
      if (!ch.enabled || ch.mixer.mute) return;
      if (hasSoloI && !ch.mixer.solo) return;
      ch.notes.forEach(n => {
        if (n.step === step) {
          const dur = n.length_steps * secPerStep;
          const dest = routeToMaster(actx, chain, ch.mixer, n.velocity);
          synthNote(actx, dest, time, n.midi_note, dur, ch.synthesis, n.velocity);
        }
      });
    });
  }, []);

  const startPlayback = useCallback(() => {
    if (playing) return;
    const actx = new (window.AudioContext || window.webkitAudioContext)();
    actxRef.current = actx;
    const chain = buildMasterChain(actx, masterRef.current);
    chainRef.current = chain;
    stepRef.current = 0;
    nextTimeRef.current = actx.currentTime + 0.05;
    setPlaying(true);
    setCurrentStep(0);

    const LOOKAHEAD = 25;
    const SCHEDULE_AHEAD = 0.1;

    const tick = () => {
      const tr = transportRef.current;
      while (nextTimeRef.current < actx.currentTime + SCHEDULE_AHEAD) {
        const step = stepRef.current;
        scheduleStep(step, nextTimeRef.current, actx, chain);
        setCurrentStep(step);
        const secPerStep = 60 / tr.bpm / 4;
        const swing = tr.swing || 0;
        if (step % 2 === 0) {
          nextTimeRef.current += secPerStep * (1 - swing);
        } else {
          nextTimeRef.current += secPerStep * (1 + swing);
        }
        stepRef.current = (step + 1) % tr.steps_per_pattern;
      }
      schedulerRef.current = setTimeout(tick, LOOKAHEAD);
    };
    tick();
  }, [playing, scheduleStep]);

  const stopPlayback = useCallback(() => {
    if (schedulerRef.current) clearTimeout(schedulerRef.current);
    if (actxRef.current) { try { actxRef.current.close(); } catch(e){} }
    actxRef.current = null; chainRef.current = null;
    setPlaying(false); setCurrentStep(-1);
  }, []);

  // ── Bounce ──
  const bounceBeat = useCallback(async () => {
    setBouncing(true);
    try {
      const tr = transport;
      const secPerStep = 60 / tr.bpm / 4;
      const totalSteps = tr.steps_per_pattern;
      const duration = totalSteps * secPerStep + 2;
      const sr = 48000;
      const offCtx = new OfflineAudioContext(2, Math.ceil(duration * sr), sr);
      const chain = buildMasterChain(offCtx, master);

      const hasSoloD = drums.some(c => c.mixer.solo);
      const hasSoloI = instruments.some(c => c.mixer.solo);

      for (let step = 0; step < totalSteps; step++) {
        const swingOff = transport.swing || 0;
        let time = 0;
        for (let s = 0; s < step; s++) {
          time += s % 2 === 0 ? secPerStep * (1 - swingOff) : secPerStep * (1 + swingOff);
        }

        drums.forEach(ch => {
          if (!ch.enabled || ch.mixer.mute) return;
          if (hasSoloD && !ch.mixer.solo) return;
          const st = ch.pattern.steps[step];
          if (st && st.active) {
            const dest = routeToMaster(offCtx, chain, ch.mixer, st.velocity);
            synthDrum(offCtx, dest, time, ch.synthesis, st.velocity);
          }
        });

        instruments.forEach(ch => {
          if (!ch.enabled || ch.mixer.mute) return;
          if (hasSoloI && !ch.mixer.solo) return;
          ch.notes.forEach(n => {
            if (n.step === step) {
              const dur = n.length_steps * secPerStep;
              const dest = routeToMaster(offCtx, chain, ch.mixer, n.velocity);
              synthNote(offCtx, dest, time, n.midi_note, dur, ch.synthesis, n.velocity);
            }
          });
        });
      }

      const rendered = await offCtx.startRendering();
      if (onBounce) onBounce(rendered, beatName);
    } catch (e) {
      alert("Bounce error: " + e.message);
    }
    setBouncing(false);
  }, [transport, drums, instruments, master, onBounce, beatName]);

  // ── Export Beat Kernel JSON ──
  const exportKernel = useCallback(() => {
    const kernel = {
      schema_version: "beat-kernel-v1",
      kernel_type: "beat",
      metadata: {
        beat_id: `BK-${new Date().toISOString().slice(0,10).replace(/-/g,"")}`,
        name: beatName, artist: artistName || "Unknown", created: new Date().toISOString(),
        modified: new Date().toISOString(), genre_tags: [], description: "", song_kernel_ref: null,
      },
      transport, drums: { channels: drums }, instruments: { channels: instruments }, master,
      arrangement: { pattern_chain: ["A"], patterns: { A: { name: "Main", description: "Primary pattern" } } },
    };
    if (onExportKernel) onExportKernel(kernel);
    const blob = new Blob([JSON.stringify(kernel, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `beat-kernel-${beatName.replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click(); URL.revokeObjectURL(url);
  }, [transport, drums, instruments, master, beatName, artistName, onExportKernel]);

  // ── Import Beat Kernel JSON ──
  const importKernel = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const k = JSON.parse(ev.target.result);
        if (k.schema_version !== "beat-kernel-v1") throw new Error("Not a Beat Kernel v1 file");
        if (k.transport) setTransport(k.transport);
        if (k.drums?.channels) setDrums(k.drums.channels);
        if (k.instruments?.channels) setInstruments(k.instruments.channels);
        if (k.master) setMaster(k.master);
        if (k.metadata?.name) setBeatName(k.metadata.name);
      } catch (err) { alert("Import error: " + err.message); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  // ── Load Preset ──
  const loadPreset = (presetFn) => {
    if (playing) stopPlayback();
    const p = presetFn();
    setTransport(p.transport);
    setDrums(p.drums);
    setInstruments(p.instruments);
    setMaster(p.master);
    setBeatName(p.label);
  };

  // ── Drum Grid Handlers ──
  const toggleDrumStep = (chIdx, stepIdx) => {
    setDrums(prev => prev.map((ch, ci) => ci !== chIdx ? ch : {
      ...ch, pattern: { steps: ch.pattern.steps.map((s, si) => si !== stepIdx ? s :
        { active: !s.active, velocity: !s.active ? drawVelocity : s.velocity })
      }
    }));
  };

  // ── Instrument Note Grid ──
  const activeInst = instruments[activeInstTab];
  const instOctave = activeInst?.synthesis?.octave || 3;
  const scaleNotes = getScaleNotes(transport.key, transport.scale, instOctave - 1, instOctave + 1).reverse();

  const toggleInstNote = (midi, step) => {
    setInstruments(prev => prev.map((ch, ci) => {
      if (ci !== activeInstTab) return ch;
      const existing = ch.notes.findIndex(n => n.step === step && n.midi_note === midi);
      if (existing >= 0) {
        return { ...ch, notes: ch.notes.filter((_, i) => i !== existing) };
      }
      return { ...ch, notes: [...ch.notes, {
        step, midi_note: midi, note_name: midiToName(midi), length_steps: 1, velocity: drawVelocity,
      }]};
    }));
  };

  const hasNote = (midi, step) => activeInst?.notes.some(n => n.step === step && n.midi_note === midi);

  // ── Styles ──
  const S = {
    wrap: { animation: "fadeIn 0.3s ease" },
    section: { marginBottom: 20 },
    sTitle: { fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: "#f59e0b", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 },
    card: { background: "#0f0f20", border: "1px solid #1a1a2e", borderRadius: 8, padding: 16, marginBottom: 12 },
    row: { display: "flex", alignItems: "center", gap: 12 },
    label: { fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: "#888", marginBottom: 4, display: "block" },
    input: { padding: "6px 10px", background: "#111122", border: "1px solid #222244", borderRadius: 4, color: "#e2e2e2", fontSize: 12, fontFamily: "inherit", outline: "none", width: "100%" },
    btn: (v = "primary") => ({
      padding: "8px 18px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11,
      fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", fontFamily: "inherit",
      background: v === "primary" ? "#f59e0b" : v === "danger" ? "#ef4444" : v === "success" ? "#22c55e" : "#222244",
      color: v === "primary" || v === "danger" || v === "success" ? "#0a0a14" : "#e2e2e2",
      display: "inline-flex", alignItems: "center", gap: 6, transition: "all 0.2s",
    }),
    chip: (active) => ({
      padding: "5px 12px", borderRadius: 4, border: `1px solid ${active ? "#f59e0b" : "#333"}`,
      background: active ? "rgba(245,158,11,0.15)" : "transparent",
      color: active ? "#f59e0b" : "#888", fontSize: 10, cursor: "pointer", fontFamily: "inherit",
      fontWeight: 600, transition: "all 0.15s",
    }),
    slider: { accentColor: "#f59e0b", cursor: "pointer" },
    gridCell: (active, isCurrent, vel) => ({
      width: 42, height: 28, borderRadius: 3, cursor: "pointer", transition: "all 0.1s",
      border: isCurrent ? "2px solid #f59e0b" : "1px solid #222244",
      background: active ? `rgba(245,158,11,${0.2 + vel * 0.6})` : isCurrent ? "#1a1a2e" : "#0d0d1a",
    }),
    noteCell: (active, isCurrent, vel) => ({
      width: 42, height: 18, borderRadius: 2, cursor: "pointer", transition: "all 0.1s",
      border: isCurrent ? "1px solid #06b6d4" : "1px solid rgba(34,34,68,0.5)",
      background: active ? `rgba(6,182,212,${0.3 + vel * 0.5})` : isCurrent ? "rgba(26,26,46,0.5)" : "transparent",
    }),
    chLabel: { width: 70, fontSize: 10, fontWeight: 600, color: "#888", textAlign: "right", flexShrink: 0 },
    noteLabel: { width: 40, fontSize: 9, fontWeight: 600, color: "#666", textAlign: "right", flexShrink: 0 },
    mixStrip: { display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 6px", background: "#0d0d1a", borderRadius: 6, border: "1px solid #1a1a2e", minWidth: 70, gap: 4 },
  };

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div style={S.wrap}>
      {/* ── Transport Bar ── */}
      <div style={{ ...S.card, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <button style={S.btn(playing ? "danger" : "success")} onClick={playing ? stopPlayback : startPlayback}>
          {playing ? "STOP" : "PLAY"}
        </button>
        <div>
          <span style={S.label}>BPM</span>
          <input type="number" min={40} max={200} value={transport.bpm}
            onChange={e => setTransport(t => ({ ...t, bpm: Math.max(40, Math.min(200, +e.target.value)) }))}
            style={{ ...S.input, width: 60 }} />
        </div>
        <div>
          <span style={S.label}>Swing</span>
          <input type="range" min={0} max={0.5} step={0.05} value={transport.swing}
            onChange={e => setTransport(t => ({ ...t, swing: +e.target.value }))}
            style={{ ...S.slider, width: 80 }} />
          <span style={{ fontSize: 10, color: "#888", marginLeft: 4 }}>{Math.round(transport.swing * 100)}%</span>
        </div>
        <div>
          <span style={S.label}>Key</span>
          <select style={{ ...S.input, width: 55 }} value={transport.key}
            onChange={e => setTransport(t => ({ ...t, key: e.target.value }))}>
            {NOTE_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <span style={S.label}>Scale</span>
          <select style={{ ...S.input, width: 100 }} value={transport.scale}
            onChange={e => setTransport(t => ({ ...t, scale: e.target.value }))}>
            {Object.keys(SCALES).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <span style={S.label}>Draw Vel</span>
          <input type="range" min={0.1} max={1} step={0.05} value={drawVelocity}
            onChange={e => setDrawVelocity(+e.target.value)}
            style={{ ...S.slider, width: 60 }} />
          <span style={{ fontSize: 10, color: "#888", marginLeft: 4 }}>{Math.round(drawVelocity * 100)}%</span>
        </div>
        <div>
          <span style={S.label}>Beat Name</span>
          <input style={{ ...S.input, width: 140 }} value={beatName} onChange={e => setBeatName(e.target.value)} />
        </div>
      </div>

      {/* ── Presets ── */}
      <div style={{ ...S.section, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 10, color: "#666", fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginRight: 8 }}>Presets:</span>
        {PRESETS.map((pf, i) => (
          <button key={i} style={S.chip(false)} onClick={() => loadPreset(pf)}>{pf().label}</button>
        ))}
      </div>

      {/* ── View Tabs ── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {[["drums","Drums"],["instruments","Instruments"],["mixer","Mixer"],["master","Master FX"]].map(([k,l]) => (
          <button key={k} style={S.chip(view === k)} onClick={() => setView(k)}>{l}</button>
        ))}
      </div>

      {/* ── DRUMS VIEW ── */}
      {view === "drums" && (
        <div style={S.section}>
          <div style={S.sTitle}>Drum Sequencer — {transport.steps_per_pattern} Steps</div>
          {/* Step numbers */}
          <div style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 4, paddingLeft: 78 }}>
            {Array.from({ length: transport.steps_per_pattern }, (_, i) => (
              <div key={i} style={{ width: 42, textAlign: "center", fontSize: 8, color: i % 4 === 0 ? "#f59e0b" : "#444", fontWeight: i % 4 === 0 ? 700 : 400 }}>
                {i + 1}
              </div>
            ))}
          </div>
          {drums.map((ch, ci) => (
            <div key={ch.id} style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 2 }}>
              <div style={{ ...S.chLabel, opacity: ch.mixer.mute ? 0.3 : 1 }}>{ch.name}</div>
              {ch.pattern.steps.map((s, si) => (
                <div key={si}
                  style={S.gridCell(s.active, si === currentStep, s.velocity)}
                  onClick={() => toggleDrumStep(ci, si)}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── INSTRUMENTS VIEW ── */}
      {view === "instruments" && (
        <div style={S.section}>
          <div style={S.sTitle}>Melodic Sequencer</div>
          {/* Instrument tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
            {instruments.map((ch, ci) => (
              <button key={ch.id} style={S.chip(ci === activeInstTab)} onClick={() => setActiveInstTab(ci)}>
                {ch.name}
              </button>
            ))}
          </div>

          {/* Synth controls for active instrument */}
          {activeInst && (
            <div style={{ ...S.card, display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
              <div>
                <span style={S.label}>Waveform</span>
                <select style={{ ...S.input, width: 90 }} value={activeInst.synthesis.waveform}
                  onChange={e => setInstruments(p => p.map((ch, ci) => ci !== activeInstTab ? ch : { ...ch, synthesis: { ...ch.synthesis, waveform: e.target.value }}))}>
                  {["sine","square","sawtooth","triangle"].map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
              <div>
                <span style={S.label}>Octave</span>
                <input type="number" min={1} max={7} style={{ ...S.input, width: 50 }}
                  value={activeInst.synthesis.octave}
                  onChange={e => setInstruments(p => p.map((ch, ci) => ci !== activeInstTab ? ch : { ...ch, synthesis: { ...ch.synthesis, octave: +e.target.value }}))} />
              </div>
              <div>
                <span style={S.label}>Attack</span>
                <input type="range" min={0.001} max={1} step={0.01} value={activeInst.synthesis.attack}
                  style={{ ...S.slider, width: 70 }}
                  onChange={e => setInstruments(p => p.map((ch, ci) => ci !== activeInstTab ? ch : { ...ch, synthesis: { ...ch.synthesis, attack: +e.target.value }}))} />
              </div>
              <div>
                <span style={S.label}>Decay</span>
                <input type="range" min={0.01} max={2} step={0.01} value={activeInst.synthesis.decay}
                  style={{ ...S.slider, width: 70 }}
                  onChange={e => setInstruments(p => p.map((ch, ci) => ci !== activeInstTab ? ch : { ...ch, synthesis: { ...ch.synthesis, decay: +e.target.value }}))} />
              </div>
              <div>
                <span style={S.label}>Sustain</span>
                <input type="range" min={0} max={1} step={0.01} value={activeInst.synthesis.sustain}
                  style={{ ...S.slider, width: 70 }}
                  onChange={e => setInstruments(p => p.map((ch, ci) => ci !== activeInstTab ? ch : { ...ch, synthesis: { ...ch.synthesis, sustain: +e.target.value }}))} />
              </div>
              <div>
                <span style={S.label}>Release</span>
                <input type="range" min={0.01} max={2} step={0.01} value={activeInst.synthesis.release}
                  style={{ ...S.slider, width: 70 }}
                  onChange={e => setInstruments(p => p.map((ch, ci) => ci !== activeInstTab ? ch : { ...ch, synthesis: { ...ch.synthesis, release: +e.target.value }}))} />
              </div>
              <div>
                <span style={S.label}>Filter Freq</span>
                <input type="range" min={100} max={15000} step={50} value={activeInst.synthesis.filter_freq}
                  style={{ ...S.slider, width: 80 }}
                  onChange={e => setInstruments(p => p.map((ch, ci) => ci !== activeInstTab ? ch : { ...ch, synthesis: { ...ch.synthesis, filter_freq: +e.target.value }}))} />
                <span style={{ fontSize: 9, color: "#666", marginLeft: 4 }}>{activeInst.synthesis.filter_freq}Hz</span>
              </div>
            </div>
          )}

          {/* Note grid */}
          <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 400 }}>
            {/* Step numbers */}
            <div style={{ display: "flex", alignItems: "center", gap: 1, marginBottom: 2, paddingLeft: 48 }}>
              {Array.from({ length: transport.steps_per_pattern }, (_, i) => (
                <div key={i} style={{ width: 42, textAlign: "center", fontSize: 8, color: i % 4 === 0 ? "#06b6d4" : "#444", fontWeight: i % 4 === 0 ? 700 : 400 }}>
                  {i + 1}
                </div>
              ))}
            </div>
            {scaleNotes.map(n => (
              <div key={n.midi} style={{ display: "flex", alignItems: "center", gap: 1, marginBottom: 1 }}>
                <div style={{ ...S.noteLabel, color: n.name.includes(transport.key) && !n.name.includes("#") ? "#06b6d4" : "#555" }}>{n.name}</div>
                {Array.from({ length: transport.steps_per_pattern }, (_, si) => (
                  <div key={si}
                    style={S.noteCell(hasNote(n.midi, si), si === currentStep, drawVelocity)}
                    onClick={() => toggleInstNote(n.midi, si)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MIXER VIEW ── */}
      {view === "mixer" && (
        <div style={S.section}>
          <div style={S.sTitle}>Channel Mixer</div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 }}>
            {[...drums.map((ch, i) => ({ ...ch, _type: "drum", _idx: i })),
              ...instruments.map((ch, i) => ({ ...ch, _type: "inst", _idx: i }))
            ].map(ch => {
              const isDrum = ch._type === "drum";
              const color = isDrum ? "#f59e0b" : "#06b6d4";
              const setFn = isDrum ? setDrums : setInstruments;
              const idx = ch._idx;
              return (
                <div key={ch.id} style={{ ...S.mixStrip, opacity: ch.mixer.mute ? 0.35 : 1 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: 1, textTransform: "uppercase" }}>{ch.name}</div>
                  <div style={{ fontSize: 8, color: "#555" }}>{isDrum ? "DRUM" : "INST"}</div>
                  <input type="range" min={0} max={1} step={0.01} value={ch.mixer.volume}
                    orient="vertical"
                    style={{ ...S.slider, width: 16, height: 80, writingMode: "vertical-lr", direction: "rtl" }}
                    onChange={e => setFn(p => p.map((c, i) => i !== idx ? c : { ...c, mixer: { ...c.mixer, volume: +e.target.value }}))} />
                  <span style={{ fontSize: 9, color: "#888" }}>{Math.round(ch.mixer.volume * 100)}</span>
                  <div>
                    <span style={{ fontSize: 8, color: "#555" }}>PAN</span>
                    <input type="range" min={-1} max={1} step={0.1} value={ch.mixer.pan}
                      style={{ ...S.slider, width: 50 }}
                      onChange={e => setFn(p => p.map((c, i) => i !== idx ? c : { ...c, mixer: { ...c.mixer, pan: +e.target.value }}))} />
                  </div>
                  <div style={{ display: "flex", gap: 2 }}>
                    <button style={{ ...S.btn(ch.mixer.mute ? "danger" : "ghost"), padding: "3px 6px", fontSize: 8 }}
                      onClick={() => setFn(p => p.map((c, i) => i !== idx ? c : { ...c, mixer: { ...c.mixer, mute: !c.mixer.mute }}))}>M</button>
                    <button style={{ ...S.btn(ch.mixer.solo ? "success" : "ghost"), padding: "3px 6px", fontSize: 8 }}
                      onClick={() => setFn(p => p.map((c, i) => i !== idx ? c : { ...c, mixer: { ...c.mixer, solo: !c.mixer.solo }}))}>S</button>
                  </div>
                  <div>
                    <span style={{ fontSize: 8, color: "#555" }}>REV</span>
                    <input type="range" min={0} max={1} step={0.05} value={ch.mixer.reverb_send}
                      style={{ ...S.slider, width: 50 }}
                      onChange={e => setFn(p => p.map((c, i) => i !== idx ? c : { ...c, mixer: { ...c.mixer, reverb_send: +e.target.value }}))} />
                  </div>
                </div>
              );
            })}
            {/* Master strip */}
            <div style={{ ...S.mixStrip, borderColor: "#f59e0b33" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#f59e0b", letterSpacing: 1 }}>MASTER</div>
              <input type="range" min={0} max={1} step={0.01} value={master.volume}
                style={{ ...S.slider, width: 16, height: 80, writingMode: "vertical-lr", direction: "rtl" }}
                onChange={e => setMaster(m => ({ ...m, volume: +e.target.value }))} />
              <span style={{ fontSize: 9, color: "#f59e0b" }}>{Math.round(master.volume * 100)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── MASTER FX VIEW ── */}
      {view === "master" && (
        <div style={S.section}>
          <div style={S.sTitle}>Master Effects</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Reverb */}
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b" }}>REVERB</span>
                <button style={S.chip(master.reverb.enabled)}
                  onClick={() => setMaster(m => ({ ...m, reverb: { ...m.reverb, enabled: !m.reverb.enabled }}))}>
                  {master.reverb.enabled ? "ON" : "OFF"}
                </button>
              </div>
              {[["room_size","Room Size",0,1,0.05],["decay","Decay",0.5,5,0.1],["wet","Wet",0,1,0.05]].map(([k,l,mn,mx,st]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 9, color: "#666", width: 60 }}>{l}</span>
                  <input type="range" min={mn} max={mx} step={st} value={master.reverb[k]}
                    style={{ ...S.slider, flex: 1 }}
                    onChange={e => setMaster(m => ({ ...m, reverb: { ...m.reverb, [k]: +e.target.value }}))} />
                  <span style={{ fontSize: 9, color: "#888", width: 30, textAlign: "right" }}>{master.reverb[k].toFixed(2)}</span>
                </div>
              ))}
            </div>
            {/* Delay */}
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b" }}>DELAY</span>
                <button style={S.chip(master.delay.enabled)}
                  onClick={() => setMaster(m => ({ ...m, delay: { ...m.delay, enabled: !m.delay.enabled }}))}>
                  {master.delay.enabled ? "ON" : "OFF"}
                </button>
              </div>
              {[["time_ms","Time (ms)",50,1000,10],["feedback","Feedback",0,0.9,0.05],["wet","Wet",0,1,0.05]].map(([k,l,mn,mx,st]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 9, color: "#666", width: 60 }}>{l}</span>
                  <input type="range" min={mn} max={mx} step={st} value={master.delay[k]}
                    style={{ ...S.slider, flex: 1 }}
                    onChange={e => setMaster(m => ({ ...m, delay: { ...m.delay, [k]: +e.target.value }}))} />
                  <span style={{ fontSize: 9, color: "#888", width: 30, textAlign: "right" }}>
                    {k === "time_ms" ? master.delay[k] : master.delay[k].toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            {/* Compressor */}
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b" }}>COMPRESSOR</span>
                <button style={S.chip(master.compressor.enabled)}
                  onClick={() => setMaster(m => ({ ...m, compressor: { ...m.compressor, enabled: !m.compressor.enabled }}))}>
                  {master.compressor.enabled ? "ON" : "OFF"}
                </button>
              </div>
              {[["threshold_db","Thresh",-60,0,1],["ratio","Ratio",1,20,0.5],["attack_ms","Attack",0.1,100,0.5],["release_ms","Release",10,1000,10]].map(([k,l,mn,mx,st]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 9, color: "#666", width: 50 }}>{l}</span>
                  <input type="range" min={mn} max={mx} step={st} value={master.compressor[k]}
                    style={{ ...S.slider, flex: 1 }}
                    onChange={e => setMaster(m => ({ ...m, compressor: { ...m.compressor, [k]: +e.target.value }}))} />
                  <span style={{ fontSize: 9, color: "#888", width: 35, textAlign: "right" }}>{master.compressor[k]}</span>
                </div>
              ))}
            </div>
            {/* EQ */}
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b" }}>EQ (3-Band)</span>
                <button style={S.chip(master.eq.enabled)}
                  onClick={() => setMaster(m => ({ ...m, eq: { ...m.eq, enabled: !m.eq.enabled }}))}>
                  {master.eq.enabled ? "ON" : "OFF"}
                </button>
              </div>
              {[["low_gain_db","Low dB",-24,24,1],["mid_gain_db","Mid dB",-24,24,1],["high_gain_db","High dB",-24,24,1]].map(([k,l,mn,mx,st]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 9, color: "#666", width: 50 }}>{l}</span>
                  <input type="range" min={mn} max={mx} step={st} value={master.eq[k]}
                    style={{ ...S.slider, flex: 1 }}
                    onChange={e => setMaster(m => ({ ...m, eq: { ...m.eq, [k]: +e.target.value }}))} />
                  <span style={{ fontSize: 9, color: "#888", width: 30, textAlign: "right" }}>{master.eq[k]}dB</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Action Buttons ── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
        <button style={S.btn("success")} onClick={bounceBeat} disabled={bouncing}>
          {bouncing ? "Bouncing..." : "Bounce Beat to Studio"}
        </button>
        <button style={S.btn("primary")} onClick={exportKernel}>Export Beat Kernel JSON</button>
        <label style={S.btn("ghost")}>
          Import Beat Kernel
          <input type="file" accept=".json" onChange={importKernel} style={{ display: "none" }} />
        </label>
      </div>
    </div>
  );
}
