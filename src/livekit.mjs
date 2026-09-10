import { Room, RoomEvent, Track, setLogLevel } from 'livekit-client';

// Bundled with RTCPeerConnection bound to the native constructor saved before the
// FaceTime observer was installed. Room media must never enter the caller mix.
export function installLiveKit(config, testPeer = false) {
  const media = window.__chertSpike;
  if (!media || window !== window.top) return;
  setLogLevel('silent'); // SDK errors can include connection URLs or participant data.
  const room = new Room({ adaptiveStream: false, dynacast: false });
  const selected = new Map();
  const playback = new Set();
  let state = 'not connected';
  let started = false;
  let ended = false;
  let label;
  let blockedByPolicy = false;
  const policyListener = event => {
    if (event.effectiveDirective !== 'connect-src') return;
    try {
      if (new URL(event.blockedURI).hostname === new URL(config.url).hostname) {
        blockedByPolicy = true;
        show('Page security policy blocks LiveKit. A separate connector is required.');
      }
    } catch { /* Non-URL policy events are unrelated to room signaling. */ }
  };
  document.addEventListener('securitypolicyviolation', policyListener);
  function show(value) { state = value; if (label) label.textContent = value; }
  function remove(kind) {
    const entry = selected.get(kind);
    if (!entry) return;
    if (testPeer) {
      entry.element?.pause();
      if (entry.element) { entry.element.srcObject = null; playback.delete(entry.element); }
    } else media.detachRoomTrack(kind);
    selected.delete(kind);
  }
  async function disconnect() {
    if (ended) return;
    ended = true;
    document.removeEventListener('securitypolicyviolation', policyListener);
    for (const kind of [...selected.keys()]) remove(kind);
    await room.disconnect();
    show('disconnected');
  }
  media.onStop(disconnect);
  room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
    if (ended || participant.identity !== config.targetIdentity || !['audio', 'video'].includes(track.kind)) return;
    if (selected.has(track.kind)) {
      show('Multiple matching tracks: stop and use one test participant');
      void media.stop();
      return;
    }
    selected.set(track.kind, { sid: publication.trackSid });
    if (testPeer) {
      if (track.kind !== 'audio') return;
      const element = track.attach();
      selected.get(track.kind).element = element;
      playback.add(element);
      void element.play().catch(() => show('Click Enable audio, then Listen to caller'));
    } else {
      void media.attachRoomTrack(track.mediaStreamTrack).catch(() => { show('Room media playback failed'); void media.stop(); });
    }
    show(`connected | receiving ${[...selected.keys()].join(' + ')}`);
  });
  room.on(RoomEvent.TrackUnsubscribed, (_track, publication) => {
    for (const [kind, entry] of selected) if (entry.sid === publication.trackSid) remove(kind);
    if (!ended) show('connected | waiting for test media');
  });
  room.on(RoomEvent.Disconnected, () => { void disconnect(); });
  room.on(RoomEvent.Reconnecting, () => {
    // The spike does not silently resume a potentially stale media route.
    show('Connection interrupted: stop and restart');
    void media.stop();
  });
  async function connect() {
    if (started || ended) return;
    started = true;
    show('connecting');
    try {
      await media.enable();
      await room.connect(config.url, config.token, { autoSubscribe: true });
      if (ended) { await room.disconnect(); return; }
      if (testPeer) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        for (const track of stream.getTracks()) {
          if (ended) { track.stop(); continue; }
          await room.localParticipant.publishTrack(track, { name: `test-${track.kind}`, source: track.kind === 'audio' ? Track.Source.Microphone : Track.Source.Camera });
        }
      } else {
        await room.localParticipant.publishTrack(media.callerStream().getAudioTracks()[0].clone(), {
          name: 'facetime-caller', source: Track.Source.Microphone,
        });
      }
      if (ended) { await room.disconnect(); return; }
      show(`connected | receiving ${[...selected.keys()].join(' + ') || 'no test media yet'}`);
    } catch {
      await disconnect();
      show(blockedByPolicy ? 'Page security policy blocks LiveKit. A separate connector is required.' : 'Connection failed: check room URL, token expiry and grants; restart to retry');
    }
  }
  function panel() {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483647;background:white;color:#102834;padding:14px;border:2px solid #17846b;border-radius:12px;font:13px system-ui;max-width:300px';
    const title = document.createElement('strong');
    title.textContent = testPeer ? 'LiveKit test participant' : 'FaceTime ↔ LiveKit';
    label = document.createElement('p'); label.textContent = state;
    const join = document.createElement('button'); join.textContent = 'Connect LiveKit'; join.onclick = () => { void connect(); };
    host.append(title, label, join);
    if (testPeer) {
      const listen = document.createElement('button'); listen.textContent = 'Listen to caller';
      listen.onclick = () => { for (const element of playback) void element.play().catch(() => show('Playback blocked')); };
      host.append(listen);
    }
    document.body.append(host);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', panel, { once: true });
  else panel();
}
