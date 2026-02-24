import { useState, useRef, useEffect, useCallback } from "react";
import { EMOTION_BASIS, createNeutralEmotionVector } from "./src/emotionField.js";

// ═══════════════════════════════════════════════════════════
// ⚡ LIGHTNING STUDIO — Music Production Kernel
// L0-CMD-2026-0214-003 | Armand Lefebvre | Greedy One-Shot
// ═══════════════════════════════════════════════════════════

const GENRES = [
  { id: "east_coast", label: "East Coast Hip-Hop", bpmMin: 85, bpmMax: 95, key: "Cm" },
  { id: "boom_bap", label: "Boom Bap", bpmMin: 80, bpmMax: 100, key: "Dm" },
  { id: "conscious", label: "Conscious Rap", bpmMin: 80, bpmMax: 95, key: "Am" },
  { id: "trap", label: "Trap", bpmMin: 130, bpmMax: 160, key: "Fm" },
  { id: "drill", label: "Drill", bpmMin: 140, bpmMax: 150, key: "Gm" },
  { id: "rnb", label: "R&B / Soul", bpmMin: 65, bpmMax: 80, key: "Eb" },
  { id: "lofi", label: "Lo-Fi", bpmMin: 70, bpmMax: 90, key: "Cm" },
  { id: "phonk", label: "Phonk", bpmMin: 130, bpmMax: 145, key: "Dm" },
];

const MOODS = ["Angry","Defiant","Vulnerable","Triumphant","Melancholic","Aggressive","Caring","Haunted","Poetic","Raw"];
const STRUCTURES = [
  "Intro → V1 → Hook → V2 → Hook → Bridge → V3 → Hook → Outro",
  "Intro → V1 → Hook → V2 → Hook → Outro",
  "V1 → Hook → V2 → Hook → Bridge → Hook",
  "Intro → V1 → Pre-Hook → Hook → V2 → Pre-Hook → Hook → Outro",
];

const fmt = (s) => { if (!s||isNaN(s)) return "0:00"; return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`; };

// ── Waveform Renderers ──
function drawWaveform(canvas, buffer, color = "#f59e0b", bg = "#0d0d1a") {
  if (!canvas || !buffer) return;
  const ctx = canvas.getContext("2d"), data = buffer.getChannelData(0);
  const w = canvas.width, h = canvas.height, step = Math.ceil(data.length / w);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let i = 0; i < w; i++) {
    let mn = 1, mx = -1;
    for (let j = 0; j < step; j++) { const v = data[i*step+j]||0; if(v<mn)mn=v; if(v>mx)mx=v; }
    ctx.moveTo(i, ((1+mn)/2)*h); ctx.lineTo(i, ((1+mx)/2)*h);
  }
  ctx.stroke();
}

function drawLive(canvas, analyser) {
  if (!canvas || !analyser) return;
  const ctx = canvas.getContext("2d"), len = analyser.frequencyBinCount, arr = new Uint8Array(len);
  analyser.getByteTimeDomainData(arr);
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = "#0d0d1a"; ctx.fillRect(0, 0, w, h);
  ctx.lineWidth = 2; ctx.strokeStyle = "#ef4444"; ctx.beginPath();
  const sl = w / len; let x = 0;
  for (let i = 0; i < len; i++) { const y = (arr[i]/128)*h/2; i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); x+=sl; }
  ctx.lineTo(w, h/2); ctx.stroke();
}

// ── Playback Progress Waveform ──
function drawProgress(canvas, buffer, progress, color="#f59e0b", played="#ff6b00", bg="#0d0d1a") {
  if (!canvas || !buffer) return;
  const ctx = canvas.getContext("2d"), data = buffer.getChannelData(0);
  const w = canvas.width, h = canvas.height, step = Math.ceil(data.length / w);
  const px = Math.floor(w * (progress || 0));
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = pass === 0 ? played : color;
    ctx.lineWidth = 1.5; ctx.beginPath();
    const start = pass === 0 ? 0 : px, end = pass === 0 ? px : w;
    for (let i = start; i < end; i++) {
      let mn = 1, mx = -1;
      for (let j = 0; j < step; j++) { const v = data[i*step+j]||0; if(v<mn)mn=v; if(v>mx)mx=v; }
      ctx.moveTo(i, ((1+mn)/2)*h); ctx.lineTo(i, ((1+mx)/2)*h);
    }
    ctx.stroke();
  }
  // playhead
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath();
  ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
}

// ── Audio Utilities ──
function createAudioCtx() {
  return new (window.AudioContext || window.webkitAudioContext)();
}

async function decodeFile(file) {
  const actx = createAudioCtx();
  const ab = await file.arrayBuffer();
  const decoded = await actx.decodeAudioData(ab);
  actx.close();
  return decoded;
}

function audioBufferToWav(buffer) {
  const numCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const length = buffer.length * numCh * 2 + 44;
  const ab = new ArrayBuffer(length);
  const view = new DataView(ab);
  const writeStr = (o, s) => { for(let i=0;i<s.length;i++) view.setUint8(o+i,s.charCodeAt(i)); };
  writeStr(0, "RIFF"); view.setUint32(4, length-8, true); writeStr(8, "WAVE");
  writeStr(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true); view.setUint32(24, sr, true);
  view.setUint32(28, sr*numCh*2, true); view.setUint16(32, numCh*2, true);
  view.setUint16(34, 16, true); writeStr(36, "data"); view.setUint32(40, length-44, true);
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      let sample = buffer.getChannelData(ch)[i];
      sample = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, sample < 0 ? sample*0x8000 : sample*0x7FFF, true);
      offset += 2;
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}

function mixBuffers(buffers, volumes, pans, sampleRate = 48000) {
  if (!buffers.length) return null;
  const maxLen = Math.max(...buffers.map(b => b.length));
  const actx = new OfflineAudioContext(2, maxLen, sampleRate);
  buffers.forEach((buf, i) => {
    const src = actx.createBufferSource();
    src.buffer = buf;
    const gain = actx.createGain();
    gain.gain.value = volumes[i] ?? 1;
    const pan = actx.createStereoPanner();
    pan.pan.value = pans[i] ?? 0;
    src.connect(gain).connect(pan).connect(actx.destination);
    src.start(0);
  });
  return actx.startRendering();
}

// ═══════════════════════════════════════════════════════════
// MAIN APP COMPONENT
// ═══════════════════════════════════════════════════════════
export default function LightningStudio() {
  const [tab, setTab] = useState("brief");
  const [brief, setBrief] = useState({
    artistName: "White Lightning", title: "", genre: "east_coast",
    moods: ["Angry","Defiant"], structure: STRUCTURES[0],
    bpm: 90, musicalKey: "Cm", thematicCore: "", cityRef: "Philadelphia, PA",
    vocalStyle: "", influences: "", culturalRefs: "",
    emotionOpen: "", emotionMid: "", emotionClimax: "", emotionResolve: "",
  });
  const [lyrics, setLyrics] = useState("");
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [lyricsPrompt, setLyricsPrompt] = useState("");

  // Emotional field state — D5 (VK-CMD-EMOTION-PHYSICS-2026-002)
  const [emotionVector, setEmotionVector] = useState(createNeutralEmotionVector);

  // Studio state
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState([]); // {id, blob, buffer, name}
  const [beats, setBeats] = useState([]); // {id, file, buffer, name}
  const [voiceClones, setVoiceClones] = useState([]); // {id, blob, buffer, name}

  // Playback
  const [playingId, setPlayingId] = useState(null);
  const [playProgress, setPlayProgress] = useState({});
  const playRef = useRef({}); // {id: {source, actx, startTime}}

  // Mix state
  const [tracks, setTracks] = useState([]); // {id, name, type, buffer, volume, pan, muted, solo}
  const [mixResult, setMixResult] = useState(null);
  const [mixBuffer, setMixBuffer] = useState(null);
  const [isMixing, setIsMixing] = useState(false);

  // Recording refs
  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const analyserRef = useRef(null);
  const liveCanvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const audioCtxRef = useRef(null);

  // Canvas refs for waveforms
  const waveCanvasRefs = useRef({});
  const mixCanvasRef = useRef(null);

  // ── Brief Handlers ──
  const updateBrief = (k, v) => setBrief(p => ({ ...p, [k]: v }));
  const toggleMood = (m) => setBrief(p => ({
    ...p, moods: p.moods.includes(m) ? p.moods.filter(x=>x!==m) : [...p.moods, m]
  }));
  const selectedGenre = GENRES.find(g => g.id === brief.genre) || GENRES[0];

  // ── AI Lyrics Generation ──
  const generateLyrics = async () => {
    setLyricsLoading(true);
    const prompt = `You are a world-class songwriter and rapper. Write complete song lyrics for the following brief. Output ONLY the lyrics with section headers in brackets like [Intro], [Verse 1], [Hook], etc. No annotations, no explanations — just the lyrics ready to perform.

SONG BRIEF:
- Artist: ${brief.artistName}
- Title: ${brief.title || "Untitled"}
- Genre: ${selectedGenre.label}
- BPM: ${brief.bpm} | Key: ${brief.musicalKey}
- Moods: ${brief.moods.join(", ")}
- Structure: ${brief.structure}
- Thematic Core: ${brief.thematicCore}
- City/Setting: ${brief.cityRef}
- Vocal Style: ${brief.vocalStyle}
- Influences: ${brief.influences}
- Cultural References: ${brief.culturalRefs}
- Emotional Arc: Opening: ${brief.emotionOpen} → Midpoint: ${brief.emotionMid} → Climax: ${brief.emotionClimax} → Resolution: ${brief.emotionResolve}
${lyricsPrompt ? `\nADDITIONAL DIRECTION: ${lyricsPrompt}` : ""}

Write album-quality lyrics. Every bar must earn its place. No filler. No placeholders. Make it chart-ready.`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      const text = data.content?.map(b => b.type === "text" ? b.text : "").join("\n") || "Error generating lyrics.";
      setLyrics(text);
    } catch (e) {
      setLyrics("Error: " + e.message);
    }
    setLyricsLoading(false);
  };

  // ── Voice Recording ──
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      streamRef.current = stream;
      const actx = createAudioCtx();
      audioCtxRef.current = actx;
      const source = actx.createMediaStreamSource(stream);
      const analyser = actx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const ab = await blob.arrayBuffer();
        const buffer = await actx.decodeAudioData(ab);
        const id = Date.now().toString();
        setRecordings(p => [...p, { id, blob, buffer, name: `Take ${p.length + 1}` }]);
      };
      mediaRecRef.current = mr;
      mr.start(100);
      setIsRecording(true);

      // Live waveform animation
      const animate = () => {
        drawLive(liveCanvasRef.current, analyserRef.current);
        animFrameRef.current = requestAnimationFrame(animate);
      };
      animate();
    } catch (e) {
      alert("Microphone access required: " + e.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") {
      mediaRecRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setIsRecording(false);
  };

  // ── Beat Upload ──
  const handleBeatUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const buffer = await decodeFile(file);
      const id = Date.now().toString();
      setBeats(p => [...p, { id, file, buffer, name: file.name.replace(/\.[^.]+$/, "") }]);
    } catch (err) {
      alert("Could not decode audio file: " + err.message);
    }
  };

  // ── Voice Clone Sample Upload ──
  const handleCloneUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const buffer = await decodeFile(file);
      const blob = file;
      const id = Date.now().toString();
      setVoiceClones(p => [...p, { id, blob, buffer, name: `Voice Sample ${p.length + 1}` }]);
    } catch (err) {
      alert("Could not decode audio: " + err.message);
    }
  };

  // ── Playback ──
  const playAudio = useCallback((id, buffer) => {
    // Stop any current playback of this id
    if (playRef.current[id]) {
      try { playRef.current[id].source.stop(); playRef.current[id].actx.close(); } catch(e){}
      delete playRef.current[id];
    }
    if (playingId === id) { setPlayingId(null); return; }

    const actx = createAudioCtx();
    const source = actx.createBufferSource();
    source.buffer = buffer;
    source.connect(actx.destination);
    source.start(0);
    const startTime = actx.currentTime;
    playRef.current[id] = { source, actx, startTime, duration: buffer.duration };
    setPlayingId(id);

    source.onended = () => {
      setPlayingId(p => p === id ? null : p);
      setPlayProgress(p => ({ ...p, [id]: 0 }));
      try { actx.close(); } catch(e){}
      delete playRef.current[id];
    };
  }, [playingId]);

  // Progress animation
  useEffect(() => {
    let raf;
    const tick = () => {
      if (playingId && playRef.current[playingId]) {
        const p = playRef.current[playingId];
        const elapsed = p.actx.currentTime - p.startTime;
        const prog = Math.min(elapsed / p.duration, 1);
        setPlayProgress(prev => ({ ...prev, [playingId]: prog }));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playingId]);

  // ── Add to Mix ──
  const addToMix = (name, type, buffer) => {
    const id = Date.now().toString() + Math.random();
    setTracks(p => [...p, { id, name, type, buffer, volume: 0.8, pan: 0, muted: false, solo: false }]);
    setTab("mix");
  };

  const updateTrack = (id, key, val) => setTracks(p => p.map(t => t.id === id ? { ...t, [key]: val } : t));
  const removeTrack = (id) => setTracks(p => p.filter(t => t.id !== id));

  // ── Mixdown ──
  const doMixdown = async () => {
    setIsMixing(true);
    try {
      const activeTracks = tracks.filter(t => !t.muted);
      const hasSolo = activeTracks.some(t => t.solo);
      const finalTracks = hasSolo ? activeTracks.filter(t => t.solo) : activeTracks;
      if (!finalTracks.length) { alert("No active tracks to mix"); setIsMixing(false); return; }
      const result = await mixBuffers(
        finalTracks.map(t => t.buffer),
        finalTracks.map(t => t.volume),
        finalTracks.map(t => t.pan),
      );
      setMixBuffer(result);
      const wav = audioBufferToWav(result);
      setMixResult(wav);
    } catch (e) {
      alert("Mix error: " + e.message);
    }
    setIsMixing(false);
  };

  // ── Export ──
  const exportWav = () => {
    if (!mixResult) return;
    const url = URL.createObjectURL(mixResult);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${brief.artistName.replace(/\s+/g,"_")}_${brief.title.replace(/\s+/g,"_")||"track"}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportLyrics = () => {
    const blob = new Blob([lyrics], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${brief.title||"lyrics"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportBrief = () => {
    const schema = {
      brief_id: `SB-${new Date().toISOString().slice(0,10).replace(/-/g,"")}`,
      artist: { name: brief.artistName, vocal_style: brief.vocalStyle, influences: brief.influences.split(",").map(s=>s.trim()) },
      song: {
        title: brief.title, genre: selectedGenre.label, bpm: brief.bpm, key: brief.musicalKey,
        mood_tags: brief.moods, thematic_core: brief.thematicCore, structure: brief.structure,
        city_setting: brief.cityRef, cultural_references: brief.culturalRefs.split(",").map(s=>s.trim()),
        emotional_arc: { opening: brief.emotionOpen, midpoint: brief.emotionMid, climax: brief.emotionClimax, resolution: brief.emotionResolve }
      }
    };
    const blob = new Blob([JSON.stringify(schema, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `song-brief-${brief.title||"untitled"}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Waveform drawing effects ──
  useEffect(() => {
    [...recordings, ...beats, ...voiceClones].forEach(item => {
      const canvas = waveCanvasRefs.current[item.id];
      if (canvas && item.buffer) {
        if (playingId === item.id) {
          drawProgress(canvas, item.buffer, playProgress[item.id] || 0);
        } else {
          drawWaveform(canvas, item.buffer, item.type === "beat" ? "#06b6d4" : "#f59e0b");
        }
      }
    });
  }, [recordings, beats, voiceClones, playingId, playProgress]);

  useEffect(() => {
    if (mixCanvasRef.current && mixBuffer) {
      if (playingId === "mixdown") {
        drawProgress(mixCanvasRef.current, mixBuffer, playProgress["mixdown"] || 0, "#22c55e", "#16a34a");
      } else {
        drawWaveform(mixCanvasRef.current, mixBuffer, "#22c55e");
      }
    }
  }, [mixBuffer, playingId, playProgress]);

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  const S = {
    app: { minHeight: "100vh", background: "#0a0a14", color: "#e2e2e2", fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace", position: "relative", overflow: "hidden" },
    noise: { position: "fixed", inset: 0, opacity: 0.03, backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", pointerEvents: "none", zIndex: 0 },
    header: { padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1a1a2e", position: "relative", zIndex: 2 },
    logo: { display: "flex", alignItems: "center", gap: 12 },
    bolt: { fontSize: 28, color: "#f59e0b", filter: "drop-shadow(0 0 8px rgba(245,158,11,0.6))" },
    title: { fontSize: 20, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#f59e0b" },
    sub: { fontSize: 10, letterSpacing: 4, color: "#666", textTransform: "uppercase", marginTop: 2 },
    tabs: { display: "flex", gap: 2, background: "#111122", borderRadius: 8, padding: 3, position: "relative", zIndex: 2 },
    tab: (active) => ({ padding: "8px 18px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", fontFamily: "inherit", background: active ? "#f59e0b" : "transparent", color: active ? "#0a0a14" : "#666", transition: "all 0.2s" }),
    main: { padding: "24px 32px", maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 2 },
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: "#f59e0b", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 },
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
    grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 },
    label: { fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: "#888", marginBottom: 6, display: "block" },
    input: { width: "100%", padding: "10px 14px", background: "#111122", border: "1px solid #222244", borderRadius: 6, color: "#e2e2e2", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" },
    textarea: { width: "100%", padding: "10px 14px", background: "#111122", border: "1px solid #222244", borderRadius: 6, color: "#e2e2e2", fontSize: 13, fontFamily: "inherit", outline: "none", minHeight: 80, resize: "vertical", boxSizing: "border-box" },
    lyricsArea: { width: "100%", padding: "16px", background: "#111122", border: "1px solid #222244", borderRadius: 6, color: "#e2e2e2", fontSize: 14, fontFamily: "inherit", outline: "none", minHeight: 400, resize: "vertical", boxSizing: "border-box", lineHeight: 1.8 },
    chip: (active) => ({ padding: "6px 14px", borderRadius: 20, border: `1px solid ${active ? "#f59e0b" : "#333"}`, background: active ? "rgba(245,158,11,0.15)" : "transparent", color: active ? "#f59e0b" : "#888", fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 600, transition: "all 0.2s" }),
    btn: (variant = "primary") => ({
      padding: "10px 24px", borderRadius: 6, border: "none", cursor: "pointer",
      fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
      fontFamily: "inherit", transition: "all 0.2s",
      background: variant === "primary" ? "#f59e0b" : variant === "danger" ? "#ef4444" : variant === "success" ? "#22c55e" : "#222244",
      color: variant === "primary" || variant === "danger" || variant === "success" ? "#0a0a14" : "#e2e2e2",
      display: "inline-flex", alignItems: "center", gap: 8,
    }),
    card: { background: "#0f0f20", border: "1px solid #1a1a2e", borderRadius: 8, padding: 16, marginBottom: 12 },
    trackRow: { display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#0f0f20", border: "1px solid #1a1a2e", borderRadius: 8, marginBottom: 8 },
    badge: (type) => ({
      padding: "3px 10px", borderRadius: 4, fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
      background: type === "vocal" ? "rgba(245,158,11,0.2)" : type === "beat" ? "rgba(6,182,212,0.2)" : "rgba(168,85,247,0.2)",
      color: type === "vocal" ? "#f59e0b" : type === "beat" ? "#06b6d4" : "#a855f7",
    }),
    slider: { width: "100%", accentColor: "#f59e0b", cursor: "pointer" },
    waveCanvas: { width: "100%", height: 60, borderRadius: 6, display: "block", background: "#0d0d1a" },
    recDot: { width: 12, height: 12, borderRadius: "50%", background: "#ef4444", animation: "pulse 1s infinite", boxShadow: "0 0 12px rgba(239,68,68,0.6)" },
    divider: { height: 1, background: "#1a1a2e", margin: "24px 0" },
    meter: { height: 6, borderRadius: 3, background: "#1a1a2e", overflow: "hidden", flex: 1 },
    meterFill: (v) => ({ height: "100%", width: `${v*100}%`, background: "linear-gradient(90deg, #22c55e, #f59e0b, #ef4444)", borderRadius: 3, transition: "width 0.1s" }),
    empty: { textAlign: "center", padding: 40, color: "#444", fontSize: 13 },
  };

  const keyStyle = `
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
    @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes slideIn { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
    input:focus, textarea:focus, select:focus { border-color: #f59e0b !important; }
    input[type=range] { height: 4px; }
    select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px; }
    ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #0a0a14; } ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
  `;

  // ═══════════════════════════════════════════════════════════
  // TAB: SONG BRIEF
  // ═══════════════════════════════════════════════════════════
  const renderBrief = () => (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <div style={S.section}>
        <div style={S.sectionTitle}>⚡ Artist & Song Identity</div>
        <div style={S.grid2}>
          <div>
            <label style={S.label}>Artist Name</label>
            <input style={S.input} value={brief.artistName} onChange={e=>updateBrief("artistName",e.target.value)} placeholder="White Lightning" />
          </div>
          <div>
            <label style={S.label}>Song Title</label>
            <input style={S.input} value={brief.title} onChange={e=>updateBrief("title",e.target.value)} placeholder="Never See My Pain" />
          </div>
        </div>
      </div>

      <div style={S.section}>
        <div style={S.sectionTitle}>🎵 Genre & Production</div>
        <div style={S.grid3}>
          <div>
            <label style={S.label}>Genre</label>
            <select style={S.input} value={brief.genre} onChange={e => { updateBrief("genre", e.target.value); const g = GENRES.find(x=>x.id===e.target.value); if(g){updateBrief("bpm",Math.round((g.bpmMin+g.bpmMax)/2)); updateBrief("musicalKey",g.key);} }}>
              {GENRES.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>BPM: {brief.bpm}</label>
            <input type="range" min={selectedGenre.bpmMin} max={selectedGenre.bpmMax} value={brief.bpm} onChange={e=>updateBrief("bpm",+e.target.value)} style={{ ...S.slider, marginTop: 8 }} />
          </div>
          <div>
            <label style={S.label}>Key</label>
            <input style={S.input} value={brief.musicalKey} onChange={e=>updateBrief("musicalKey",e.target.value)} />
          </div>
        </div>
      </div>

      <div style={S.section}>
        <div style={S.sectionTitle}>🔥 Mood Tags</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {MOODS.map(m => <button key={m} style={S.chip(brief.moods.includes(m))} onClick={()=>toggleMood(m)}>{m}</button>)}
        </div>
      </div>

      <div style={S.section}>
        <div style={S.sectionTitle}>📐 Song Structure</div>
        <select style={S.input} value={brief.structure} onChange={e=>updateBrief("structure",e.target.value)}>
          {STRUCTURES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div style={S.section}>
        <div style={S.sectionTitle}>🎤 Vocal & Cultural DNA</div>
        <div style={S.grid2}>
          <div>
            <label style={S.label}>Vocal Style</label>
            <input style={S.input} value={brief.vocalStyle} onChange={e=>updateBrief("vocalStyle",e.target.value)} placeholder="Aggressive with quiet confessional breaks" />
          </div>
          <div>
            <label style={S.label}>Influences</label>
            <input style={S.input} value={brief.influences} onChange={e=>updateBrief("influences",e.target.value)} placeholder="2Pac, Meek Mill, Black Thought" />
          </div>
        </div>
        <div style={{ ...S.grid2, marginTop: 12 }}>
          <div>
            <label style={S.label}>City / Setting</label>
            <input style={S.input} value={brief.cityRef} onChange={e=>updateBrief("cityRef",e.target.value)} />
          </div>
          <div>
            <label style={S.label}>Cultural References</label>
            <input style={S.input} value={brief.culturalRefs} onChange={e=>updateBrief("culturalRefs",e.target.value)} placeholder="Kensington, Broad St, The El, Roofers Local 30" />
          </div>
        </div>
      </div>

      <div style={S.section}>
        <div style={S.sectionTitle}>💫 Thematic Core</div>
        <textarea style={S.textarea} value={brief.thematicCore} onChange={e=>updateBrief("thematicCore",e.target.value)} placeholder="The relentless struggle of living in Philadelphia's streets — where anger and love collide every block..." />
      </div>

      <div style={S.section}>
        <div style={S.sectionTitle}>📈 Emotional Arc</div>
        <div style={S.grid2}>
          <div>
            <label style={S.label}>Opening</label>
            <input style={S.input} value={brief.emotionOpen} onChange={e=>updateBrief("emotionOpen",e.target.value)} placeholder="Cold fury — streets at dawn" />
          </div>
          <div>
            <label style={S.label}>Midpoint</label>
            <input style={S.input} value={brief.emotionMid} onChange={e=>updateBrief("emotionMid",e.target.value)} placeholder="Internal fracture — love vs. rage" />
          </div>
          <div>
            <label style={S.label}>Climax</label>
            <input style={S.input} value={brief.emotionClimax} onChange={e=>updateBrief("emotionClimax",e.target.value)} placeholder="Defiant eruption — refuses to break" />
          </div>
          <div>
            <label style={S.label}>Resolution</label>
            <input style={S.input} value={brief.emotionResolve} onChange={e=>updateBrief("emotionResolve",e.target.value)} placeholder="Quiet thunder — still standing" />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button style={S.btn("primary")} onClick={() => setTab("lyrics")}>⚡ Generate Lyrics →</button>
        <button style={S.btn("ghost")} onClick={exportBrief}>📋 Export Brief JSON</button>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  // TAB: AI LYRICS
  // ═══════════════════════════════════════════════════════════
  const renderLyrics = () => (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <div style={S.section}>
        <div style={S.sectionTitle}>🧠 AI Lyric Engine</div>
        <div style={{ ...S.card, marginBottom: 16 }}>
          <label style={S.label}>Additional Direction (optional)</label>
          <textarea style={{ ...S.textarea, minHeight: 60 }} value={lyricsPrompt} onChange={e=>setLyricsPrompt(e.target.value)}
            placeholder="Tell the AI what to focus on... e.g., 'Make it autobiographical about growing up in juvenile detention, getting two degrees, winning custody of my kids...'" />
          <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
            <button style={S.btn("primary")} onClick={generateLyrics} disabled={lyricsLoading}>
              {lyricsLoading ? "⏳ Generating..." : "⚡ Generate Lyrics"}
            </button>
            {lyrics && <button style={S.btn("ghost")} onClick={exportLyrics}>💾 Export .txt</button>}
          </div>
        </div>
      </div>

      <div style={S.section}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={S.sectionTitle}>📝 Lyrics Editor</div>
          {lyrics && <span style={{ fontSize: 11, color: "#666" }}>{lyrics.length} chars · ~{Math.ceil(lyrics.length / 5000 * 100)}% of Suno limit</span>}
        </div>
        <textarea
          style={S.lyricsArea}
          value={lyrics}
          onChange={e=>setLyrics(e.target.value)}
          placeholder="Your lyrics will appear here after generation, or paste/write your own..."
        />
      </div>

      {lyrics && (
        <div style={{ display: "flex", gap: 12 }}>
          <button style={S.btn("primary")} onClick={() => setTab("studio")}>🎙️ Record Vocals →</button>
          <button style={S.btn("ghost")} onClick={() => { navigator.clipboard.writeText(lyrics); }}>📋 Copy to Clipboard</button>
        </div>
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  // TAB: RECORDING STUDIO
  // ═══════════════════════════════════════════════════════════
  const renderStudio = () => (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      {/* RECORDER */}
      <div style={S.section}>
        <div style={S.sectionTitle}>🎙️ Voice Recorder</div>
        <div style={S.card}>
          <canvas ref={liveCanvasRef} width={800} height={80} style={{ ...S.waveCanvas, height: 80, marginBottom: 12 }} />
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {!isRecording ? (
              <button style={S.btn("danger")} onClick={startRecording}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#fff" }}></span> Record
              </button>
            ) : (
              <button style={S.btn("danger")} onClick={stopRecording}>
                <div style={S.recDot}></div> Stop Recording
              </button>
            )}
            {isRecording && <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>● RECORDING</span>}
          </div>
        </div>
      </div>

      {/* RECORDINGS LIST */}
      <div style={S.section}>
        <div style={S.sectionTitle}>🎧 Vocal Takes ({recordings.length})</div>
        {recordings.length === 0 ? (
          <div style={S.empty}>No recordings yet. Hit record and lay down your bars.</div>
        ) : recordings.map(rec => (
          <div key={rec.id} style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={S.badge("vocal")}>Vocal</span>
                <input style={{ ...S.input, width: 160, padding: "4px 8px", fontSize: 12 }} value={rec.name}
                  onChange={e => setRecordings(p => p.map(r => r.id === rec.id ? { ...r, name: e.target.value } : r))} />
                <span style={{ fontSize: 11, color: "#666" }}>{fmt(rec.buffer?.duration)}</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={S.btn(playingId === rec.id ? "danger" : "ghost")} onClick={() => playAudio(rec.id, rec.buffer)}>
                  {playingId === rec.id ? "⏹ Stop" : "▶ Play"}
                </button>
                <button style={S.btn("primary")} onClick={() => addToMix(rec.name, "vocal", rec.buffer)}>+ Mix</button>
                <button style={{ ...S.btn("ghost"), color: "#ef4444", fontSize: 10 }} onClick={() => setRecordings(p => p.filter(r => r.id !== rec.id))}>✕</button>
              </div>
            </div>
            <canvas ref={el => { if(el) waveCanvasRefs.current[rec.id] = el; }} width={800} height={60} style={S.waveCanvas} />
          </div>
        ))}
      </div>

      <div style={S.divider} />

      {/* BEAT UPLOAD */}
      <div style={S.section}>
        <div style={S.sectionTitle}>🥁 Beats / Instrumentals ({beats.length})</div>
        <div style={{ marginBottom: 12 }}>
          <label style={S.btn("ghost")}>
            📂 Upload Beat (MP3/WAV/OGG)
            <input type="file" accept="audio/*" onChange={handleBeatUpload} style={{ display: "none" }} />
          </label>
        </div>
        {beats.map(beat => (
          <div key={beat.id} style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={S.badge("beat")}>Beat</span>
                <input style={{ ...S.input, width: 200, padding: "4px 8px", fontSize: 12 }} value={beat.name}
                  onChange={e => setBeats(p => p.map(b => b.id === beat.id ? { ...b, name: e.target.value } : b))} />
                <span style={{ fontSize: 11, color: "#666" }}>{fmt(beat.buffer?.duration)}</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={S.btn(playingId === beat.id ? "danger" : "ghost")} onClick={() => playAudio(beat.id, beat.buffer)}>
                  {playingId === beat.id ? "⏹ Stop" : "▶ Play"}
                </button>
                <button style={S.btn("primary")} onClick={() => addToMix(beat.name, "beat", beat.buffer)}>+ Mix</button>
                <button style={{ ...S.btn("ghost"), color: "#ef4444", fontSize: 10 }} onClick={() => setBeats(p => p.filter(b => b.id !== beat.id))}>✕</button>
              </div>
            </div>
            <canvas ref={el => { if(el) waveCanvasRefs.current[beat.id] = el; }} width={800} height={60} style={S.waveCanvas} />
          </div>
        ))}
      </div>

      <div style={S.divider} />

      {/* VOICE CLONE SAMPLES */}
      <div style={S.section}>
        <div style={S.sectionTitle}>🧬 Voice Clone Samples ({voiceClones.length})</div>
        <div style={{ ...S.card, background: "#0d0d1a", border: "1px solid #222244", marginBottom: 12 }}>
          <p style={{ fontSize: 12, color: "#888", margin: "0 0 12px 0", lineHeight: 1.6 }}>
            Upload voice samples for cloning. Record 3-5 minutes of yourself rapping or speaking clearly.
            These samples train your voice model for AI-powered voice synthesis.
          </p>
          <label style={S.btn("ghost")}>
            🎤 Upload Voice Sample
            <input type="file" accept="audio/*" onChange={handleCloneUpload} style={{ display: "none" }} />
          </label>
        </div>
        {voiceClones.map(vc => (
          <div key={vc.id} style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={S.badge("clone")}>Clone</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{vc.name}</span>
                <span style={{ fontSize: 11, color: "#666" }}>{fmt(vc.buffer?.duration)}</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={S.btn(playingId === vc.id ? "danger" : "ghost")} onClick={() => playAudio(vc.id, vc.buffer)}>
                  {playingId === vc.id ? "⏹ Stop" : "▶ Play"}
                </button>
                <button style={{ ...S.btn("ghost"), color: "#ef4444", fontSize: 10 }} onClick={() => setVoiceClones(p => p.filter(v => v.id !== vc.id))}>✕</button>
              </div>
            </div>
            <canvas ref={el => { if(el) waveCanvasRefs.current[vc.id] = el; }} width={800} height={60} style={S.waveCanvas} />
          </div>
        ))}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  // TAB: MIX & MASTER
  // ═══════════════════════════════════════════════════════════
  const renderMix = () => (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      {/* ── D5 — Emotional Field Controls (VK-CMD-EMOTION-PHYSICS-2026-002) ── */}
      <div style={S.section}>
        <div style={{ ...S.sectionTitle, color: "#888" }}>EMOTIONAL FIELD</div>
        <div style={S.card}>
          {EMOTION_BASIS.map((dim, i) => (
            <div key={dim} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: i < EMOTION_BASIS.length - 1 ? 10 : 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "#666", minWidth: 110, textTransform: "uppercase", fontFamily: "inherit" }}>
                E{i + 1} {dim}
              </span>
              <input
                type="range" min="0" max="1" step="0.01"
                value={emotionVector[dim]}
                onChange={e => setEmotionVector(prev => ({ ...prev, [dim]: parseFloat(e.target.value) }))}
                style={{ ...S.slider, flex: 1 }}
              />
              <span style={{ fontSize: 11, color: "#888", minWidth: 36, textAlign: "right", fontFamily: "inherit" }}>
                {emotionVector[dim].toFixed(2)}
              </span>
            </div>
          ))}
          <div style={{ display: "flex", gap: 12, marginTop: 12, alignItems: "center" }}>
            <button
              style={{ ...S.btn("ghost"), padding: "6px 14px", fontSize: 10 }}
              onClick={() => setEmotionVector(createNeutralEmotionVector())}
            >
              RESET TO ZERO
            </button>
            <span style={{ fontSize: 9, color: "#444", letterSpacing: 1 }}>
              CONTINUOUS SCALAR FIELD — COEFFICIENT BIAS ONLY
            </span>
          </div>
        </div>
      </div>

      <div style={S.section}>
        <div style={S.sectionTitle}>MIXING CONSOLE — {tracks.length} TRACKS</div>
        {tracks.length === 0 ? (
          <div style={S.empty}>
            No tracks loaded. Go to the <span style={{ color: "#f59e0b", cursor: "pointer" }} onClick={() => setTab("studio")}>Recording Studio</span> to record vocals or upload beats, then add them to the mix.
          </div>
        ) : (
          <>
            {tracks.map((trk, idx) => (
              <div key={trk.id} style={{ ...S.trackRow, opacity: trk.muted ? 0.4 : 1, animation: `slideIn 0.3s ease ${idx * 0.05}s both`, borderLeft: `3px solid ${trk.type === "vocal" ? "#f59e0b" : trk.type === "beat" ? "#06b6d4" : "#a855f7"}` }}>
                <span style={S.badge(trk.type)}>{trk.type}</span>
                <span style={{ fontSize: 13, fontWeight: 600, minWidth: 120 }}>{trk.name}</span>

                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12 }}>
                  {/* Volume */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 9, color: "#666", letterSpacing: 1 }}>VOL</span>
                      <span style={{ fontSize: 9, color: "#888" }}>{Math.round(trk.volume * 100)}%</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.01" value={trk.volume}
                      onChange={e => updateTrack(trk.id, "volume", +e.target.value)} style={S.slider} />
                  </div>

                  {/* Pan */}
                  <div style={{ width: 120 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 9, color: "#666", letterSpacing: 1 }}>PAN</span>
                      <span style={{ fontSize: 9, color: "#888" }}>{trk.pan === 0 ? "C" : trk.pan < 0 ? `L${Math.abs(Math.round(trk.pan*100))}` : `R${Math.round(trk.pan*100)}`}</span>
                    </div>
                    <input type="range" min="-1" max="1" step="0.01" value={trk.pan}
                      onChange={e => updateTrack(trk.id, "pan", +e.target.value)} style={S.slider} />
                  </div>
                </div>

                {/* Mute / Solo */}
                <button style={{ ...S.btn(trk.muted ? "danger" : "ghost"), padding: "6px 12px", fontSize: 10 }}
                  onClick={() => updateTrack(trk.id, "muted", !trk.muted)}>
                  {trk.muted ? "MUTED" : "M"}
                </button>
                <button style={{ ...S.btn(trk.solo ? "success" : "ghost"), padding: "6px 12px", fontSize: 10 }}
                  onClick={() => updateTrack(trk.id, "solo", !trk.solo)}>
                  {trk.solo ? "SOLO" : "S"}
                </button>
                <button style={{ ...S.btn("ghost"), padding: "6px 10px", color: "#ef4444", fontSize: 10 }}
                  onClick={() => removeTrack(trk.id)}>✕</button>
              </div>
            ))}

            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              <button style={S.btn("primary")} onClick={doMixdown} disabled={isMixing}>
                {isMixing ? "⏳ Mixing..." : "⚡ Bounce / Mixdown"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Mixdown Result */}
      {mixBuffer && (
        <div style={S.section}>
          <div style={S.sectionTitle}>🎵 Mixdown Result</div>
          <div style={S.card}>
            <canvas ref={mixCanvasRef} width={800} height={80} style={{ ...S.waveCanvas, height: 80, marginBottom: 12 }} />
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <button style={S.btn(playingId === "mixdown" ? "danger" : "success")} onClick={() => playAudio("mixdown", mixBuffer)}>
                {playingId === "mixdown" ? "⏹ Stop" : "▶ Play Mixdown"}
              </button>
              <span style={{ fontSize: 12, color: "#888" }}>{fmt(mixBuffer.duration)} · {mixBuffer.sampleRate}Hz · Stereo</span>
              <button style={S.btn("primary")} onClick={() => setTab("export")}>📦 Export →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  // TAB: EXPORT
  // ═══════════════════════════════════════════════════════════
  const renderExport = () => (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <div style={S.section}>
        <div style={S.sectionTitle}>📦 Export Center</div>

        {/* Track Export */}
        <div style={{ ...S.card, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "#f59e0b" }}>🎵 Audio Track</div>
          {mixResult ? (
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <button style={S.btn("success")} onClick={exportWav}>⬇ Download WAV</button>
              <span style={{ fontSize: 12, color: "#888" }}>
                {brief.artistName} — {brief.title || "Untitled"} · {fmt(mixBuffer?.duration)} · WAV · {mixBuffer ? `${mixBuffer.sampleRate}Hz` : ""}
              </span>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: "#666", margin: 0 }}>No mixdown yet. Go to <span style={{ color: "#f59e0b", cursor: "pointer" }} onClick={() => setTab("mix")}>Mix & Master</span> to bounce your track.</p>
          )}
        </div>

        {/* Lyrics Export */}
        <div style={{ ...S.card, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "#f59e0b" }}>📝 Lyrics</div>
          {lyrics ? (
            <div style={{ display: "flex", gap: 12 }}>
              <button style={S.btn("primary")} onClick={exportLyrics}>⬇ Download .txt</button>
              <button style={S.btn("ghost")} onClick={() => navigator.clipboard.writeText(lyrics)}>📋 Copy</button>
              <span style={{ fontSize: 12, color: "#888", alignSelf: "center" }}>{lyrics.length} characters</span>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: "#666", margin: 0 }}>No lyrics yet. Go to <span style={{ color: "#f59e0b", cursor: "pointer" }} onClick={() => setTab("lyrics")}>AI Lyrics</span> to generate.</p>
          )}
        </div>

        {/* Brief Export */}
        <div style={{ ...S.card, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "#f59e0b" }}>📋 Song Brief (Kernel Schema)</div>
          <div style={{ display: "flex", gap: 12 }}>
            <button style={S.btn("primary")} onClick={exportBrief}>⬇ Download JSON</button>
            <span style={{ fontSize: 12, color: "#888", alignSelf: "center" }}>Reusable Song Kernel v1 schema — feed into any future production run</span>
          </div>
        </div>

        {/* Individual Recordings Export */}
        {recordings.length > 0 && (
          <div style={{ ...S.card, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "#f59e0b" }}>🎤 Individual Vocal Takes</div>
            {recordings.map(rec => (
              <div key={rec.id} style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, minWidth: 120 }}>{rec.name}</span>
                <span style={{ fontSize: 11, color: "#666" }}>{fmt(rec.buffer?.duration)}</span>
                <button style={{ ...S.btn("ghost"), padding: "4px 12px", fontSize: 10 }} onClick={() => {
                  const wav = audioBufferToWav(rec.buffer);
                  const url = URL.createObjectURL(wav);
                  const a = document.createElement("a"); a.href = url; a.download = `${rec.name}.wav`; a.click(); URL.revokeObjectURL(url);
                }}>⬇ WAV</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Suno/Udio Quick Copy */}
      <div style={S.section}>
        <div style={S.sectionTitle}>🚀 Quick Deploy to AI Music Generators</div>
        <div style={S.card}>
          <p style={{ fontSize: 12, color: "#888", margin: "0 0 12px 0", lineHeight: 1.6 }}>
            Copy the optimized prompt below and paste it into <strong style={{ color: "#f59e0b" }}>Suno</strong> or <strong style={{ color: "#f59e0b" }}>Udio</strong> as your style description to generate beats or full tracks matching your brief.
          </p>
          <div style={{ background: "#0d0d1a", border: "1px solid #222244", borderRadius: 6, padding: 16, fontSize: 12, lineHeight: 1.8, color: "#ccc", marginBottom: 12 }}>
            Style: {selectedGenre.label}, cinematic, emotional{brief.moods.length ? `, ${brief.moods.map(m=>m.toLowerCase()).join(", ")}` : ""}<br/>
            BPM: {brief.bpm}<br/>
            Key: {brief.musicalKey}<br/>
            Vocal: Male rapper, {brief.vocalStyle || "aggressive with vulnerable breaks"}<br/>
            Instruments: Dark piano, 808 sub bass, orchestral strings, crisp hi-hats, heavy snare<br/>
            Mood: {brief.moods.join(", ") || "Angry, defiant, poetic"} — {brief.cityRef || "Philadelphia"} street poetry
          </div>
          <button style={S.btn("primary")} onClick={() => {
            const prompt = `Style: ${selectedGenre.label}, cinematic, emotional, ${brief.moods.map(m=>m.toLowerCase()).join(", ")}\nBPM: ${brief.bpm}\nKey: ${brief.musicalKey}\nVocal: Male rapper, ${brief.vocalStyle || "aggressive with vulnerable breaks"}\nInstruments: Dark piano, 808 sub bass, orchestral strings, crisp hi-hats, heavy snare\nMood: ${brief.moods.join(", ")} — ${brief.cityRef} street poetry`;
            navigator.clipboard.writeText(prompt);
          }}>📋 Copy Style Prompt</button>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  // APP SHELL
  // ═══════════════════════════════════════════════════════════
  return (
    <div style={S.app}>
      <style>{keyStyle}</style>
      <div style={S.noise} />

      {/* Header */}
      <header style={S.header}>
        <div style={S.logo}>
          <span style={S.bolt}>⚡</span>
          <div>
            <div style={S.title}>Lightning Studio</div>
            <div style={S.sub}>Music Production Kernel v1.0</div>
          </div>
        </div>
        <nav style={S.tabs}>
          {["brief","lyrics","studio","mix","export"].map(t => (
            <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>
              {t === "brief" ? "📋 Brief" : t === "lyrics" ? "✍️ Lyrics" : t === "studio" ? "🎙️ Studio" : t === "mix" ? "🎛️ Mix" : "📦 Export"}
            </button>
          ))}
        </nav>
      </header>

      {/* Main Content */}
      <main style={S.main}>
        {tab === "brief" && renderBrief()}
        {tab === "lyrics" && renderLyrics()}
        {tab === "studio" && renderStudio()}
        {tab === "mix" && renderMix()}
        {tab === "export" && renderExport()}
      </main>

      {/* Footer */}
      <footer style={{ padding: "16px 32px", borderTop: "1px solid #1a1a2e", display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative", zIndex: 2 }}>
        <span style={{ fontSize: 10, color: "#444", letterSpacing: 2 }}>⚡ LIGHTNING STUDIO — LEFEBVRE DESIGN SOLUTIONS LLC</span>
        <span style={{ fontSize: 10, color: "#444", letterSpacing: 2 }}>L0-CMD-2026-0214-003 · VALIDKERNEL GOVERNED</span>
      </footer>
    </div>
  );
}
