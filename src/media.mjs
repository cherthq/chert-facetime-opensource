// Runs before site scripts. Deliberately small and limited to the supervised spike.
export function installMedia({ speech, origin = 'https://facetime.apple.com' }) {
  if (location.origin !== origin || window.__chertSpike) return;
  const tracks = new Set();
  const peers = new Set();
  const incoming = new Map();
  let audio, destination, video, canvas, timer, source, buffer;
  let stopped = false;
  let frames = 0;
  let requests = 0;
  let status;
  let lastError = '';
  const own = track => { tracks.add(track); return track; };
  function ensureAudio() {
    audio ??= new AudioContext();
    destination ??= audio.createMediaStreamDestination();
    destination.stream.getTracks().forEach(own);
  }
  function ensureVideo() {
    if (video) return;
    canvas = document.createElement('canvas');
    canvas.width = 640; canvas.height = 360;
    const paint = canvas.getContext('2d');
    const draw = () => {
      frames++;
      paint.fillStyle = '#102834'; paint.fillRect(0, 0, 640, 360);
      paint.fillStyle = '#8de0c4';
      paint.beginPath(); paint.arc(320, 165, 95, 0, 2 * Math.PI); paint.fill();
      paint.fillStyle = '#102834';
      paint.fillRect(275, 130, 15, 20); paint.fillRect(350, 130, 15, 20);
      paint.beginPath(); paint.ellipse(320, 197, 34, 8 + 13 * Math.abs(Math.sin(frames / 5)), 0, 0, 2 * Math.PI); paint.fill();
      paint.fillStyle = 'white'; paint.font = '24px sans-serif';
      paint.fillText(`CHERT • GENERATED VIDEO • ${frames}`, 42, 308);
      paint.fillStyle = '#ffc876'; paint.fillRect((frames * 5) % 620, 330, 20, 12);
    };
    draw();
    video = own(canvas.captureStream(15).getVideoTracks()[0]);
    timer = setInterval(draw, 1000 / 15);
  }
  async function getUserMedia(constraints = {}) {
    if (stopped) throw new DOMException('Spike stopped', 'AbortError');
    if (!constraints.audio && !constraints.video) throw new TypeError('Request audio or video');
    requests++;
    const result = [];
    if (constraints.audio) { ensureAudio(); result.push(own(destination.stream.getAudioTracks()[0].clone())); }
    if (constraints.video) { ensureVideo(); result.push(own(video.clone())); }
    // This spike supplies fixed settings. No call to the real device API, even on failure.
    return new MediaStream(result);
  }
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: getUserMedia });
  const legacy = (c, ok, fail) => getUserMedia(c).then(ok, fail);
  for (const name of ['getUserMedia', 'webkitGetUserMedia']) {
    Object.defineProperty(navigator, name, { configurable: true, value: legacy });
  }
  Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', {
    configurable: true,
    value: async () => [
      ['videoinput', 'chert-camera', 'Chert generated camera'],
      ['audioinput', 'chert-microphone', 'Chert canned speech'],
      ['audiooutput', 'default', 'Default output'],
    ].map(([kind, deviceId, label]) => ({ kind, deviceId, label, groupId: 'chert-spike', toJSON() { return { kind, deviceId, label, groupId: this.groupId }; } })),
  });
  const NativePeer = window.RTCPeerConnection;
  const Peer = new Proxy(NativePeer, {
    construct(target, args) {
      const peer = Reflect.construct(target, args);
      peers.add(peer);
      peer.addEventListener('track', event => {
        if (stopped || event.track.kind !== 'audio' || incoming.has(event.track)) return;
        ensureAudio();
        const clone = own(event.track);
        const stream = new MediaStream([clone]);
        const playback = document.createElement('audio');
        playback.muted = true; playback.srcObject = stream;
        void playback.play().catch(() => {});
        const node = audio.createMediaStreamSource(stream);
        const analyser = audio.createAnalyser(); analyser.fftSize = 512;
        node.connect(analyser); // Analysis only. Never route received audio to outgoing speech.
        const silentSink = audio.createGain(); silentSink.gain.value = 0;
        analyser.connect(silentSink).connect(audio.destination);
        incoming.set(event.track, { node, analyser, silentSink, playback, samples: new Float32Array(512), clone });
      });
      return peer;
    },
  });
  window.RTCPeerConnection = Peer;
  if (window.webkitRTCPeerConnection) window.webkitRTCPeerConnection = Peer;

  function snapshot() {
    let level = 0;
    for (const { analyser, samples, clone } of incoming.values()) {
      if (clone.readyState !== 'live') continue;
      analyser.getFloatTimeDomainData(samples);
      level = Math.max(level, Math.sqrt(samples.reduce((n, v) => n + v * v, 0) / samples.length));
    }
    return { stopped, requests, frames, incomingAudio: [...incoming.values()].filter(x => x.clone.readyState === 'live').length,
      level, audioState: audio?.state ?? 'not started', liveTracks: [...tracks].filter(t => t.readyState === 'live').length,
      peers: [...peers].filter(p => p.connectionState !== 'closed').length, error: lastError };
  }
  async function enable() {
    if (stopped) return;
    ensureAudio();
    await audio.resume();
    for (const { playback } of incoming.values()) await playback.play();
  }
  async function play() {
    await enable();
    if (stopped) return;
    buffer ??= await audio.decodeAudioData(Uint8Array.from(atob(speech), c => c.charCodeAt(0)).buffer);
    if (stopped) return;
    source?.stop();
    source = audio.createBufferSource(); source.buffer = buffer;
    source.connect(destination); source.start();
    // Speech is sent to FaceTime, not played through the laptop speakers.
  }
  async function stop() {
    if (stopped) return;
    stopped = true;
    clearInterval(timer); clearInterval(statusTimer);
    source?.stop();
    for (const peer of peers) peer.close();
    for (const track of tracks) track.stop();
    for (const { node, analyser, silentSink, playback } of incoming.values()) {
      node.disconnect(); analyser.disconnect(); silentSink.disconnect();
      playback.pause(); playback.srcObject = null;
    }
    if (audio && audio.state !== 'closed') await audio.close();
    if (status) status.textContent = 'Stopped';
  }
  const api = { snapshot, enable, play, stop };
  Object.defineProperty(window, '__chertSpike', { value: api });
  const statusTimer = setInterval(() => {
    if (!status) return;
    const s = snapshot();
    status.textContent = `Camera frames: ${s.frames} | requests: ${s.requests}\nCaller tracks: ${s.incomingAudio} | level: ${s.level.toFixed(3)}\nAudio: ${s.audioState}${lastError ? ' | ' + lastError : ''}`;
  }, 250);
  function panel() {
    if (window !== window.top || !document.body) return;
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;top:12px;left:12px;z-index:2147483647';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<style>:host{color-scheme:light}section{font:13px system-ui;background:#fff;color:#102834;padding:14px;border:2px solid #17846b;border-radius:12px;box-shadow:0 4px 20px #0004;max-width:330px}button{font:inherit;padding:8px;margin:6px 4px 0 0;cursor:pointer}pre{white-space:pre-wrap;font:12px monospace}</style><section><strong>Chert synthetic media test</strong><p>No laptop mic or camera. Use headphones to hear the caller through FaceTime.</p><pre></pre></section>';
    status = root.querySelector('pre');
    for (const [label, action] of [
      ['Enable audio', enable], ['Send test speech', play],
      ['Stop test', async () => { await stop(); await window.__chertStop?.(); }],
    ]) {
      const button = document.createElement('button'); button.textContent = label;
      button.onclick = () => Promise.resolve(action()).catch(() => { lastError = 'Media action failed'; });
      root.querySelector('section').append(button);
    }
    document.body.append(host);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', panel, { once: true });
  else panel();
  window.addEventListener('pagehide', () => { void stop(); }, { once: true });
}
