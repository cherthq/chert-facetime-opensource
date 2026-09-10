import { readFile } from 'node:fs/promises';
import { initializeLogger, voice } from '@livekit/agents';
import { realtime } from '@livekit/agents-plugin-openai';
import { Room, RoomEvent, VideoSource, LocalVideoTrack, TrackSource, dispose } from '@livekit/rtc-node';
import { validateConfig } from './bundle.mjs';
import { avatarFrame, WIDTH, HEIGHT } from './avatar.mjs';

initializeLogger({ pretty: false, level: 'silent' });
let room, session, model, videoSource, videoTrack, frames, limit;
let ending = false;
let speaking = false;
async function stop(reason, code = 0) {
  if (ending) return;
  ending = true;
  console.log(`Stopping agent: ${reason}.`);
  clearInterval(frames); clearTimeout(limit);
  const force = setTimeout(() => process.exit(1), 5000);
  await Promise.allSettled([session?.close(), model?.close()]);
  await Promise.allSettled([videoTrack?.close(), videoSource?.close(), room?.disconnect()]);
  await dispose();
  clearTimeout(force);
  console.log('Agent stopped.');
  process.exit(code);
}
process.on('SIGINT', () => { void stop('local Stop'); });
process.on('SIGTERM', () => { void stop('local Stop'); });

try {
  const settings = JSON.parse(await readFile(new URL('../examples/agent.json', import.meta.url), 'utf8'));
  if (!settings.instructions || !settings.model || !settings.voice || !Number.isFinite(settings.maxMinutes) || settings.maxMinutes < 1 || settings.maxMinutes > 30) throw new Error('Invalid settings');
  if (process.argv.includes('--check')) {
    model = new realtime.RealtimeModel({ apiKey: 'offline-check-only', model: settings.model, voice: settings.voice, inputAudioTranscription: null });
    session = new voice.AgentSession({ llm: model, turnDetection: 'realtime_llm' });
    videoSource = new VideoSource(WIDTH, HEIGHT);
    videoTrack = LocalVideoTrack.createVideoTrack('agent-avatar', videoSource);
    videoSource.captureFrame(avatarFrame(0, false));
    videoSource.captureFrame(avatarFrame(1, true));
    console.log('PASS: agent SDK/model configuration and native avatar frames initialize locally. No room or model connection attempted.');
    await stop('offline check complete');
  } else {
    const config = validateConfig(JSON.parse(await readFile(new URL('../.local/peer.json', import.meta.url), 'utf8')));
    const { apiKey } = JSON.parse(await readFile(new URL('../.local/openai.json', import.meta.url), 'utf8'));
    if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error('Missing key');
    room = new Room();
    room.on(RoomEvent.Disconnected, () => { void stop('room disconnected'); });
    room.on(RoomEvent.ParticipantDisconnected, participant => {
      if (participant.identity === config.targetIdentity) void stop('FaceTime connector left');
    });
    limit = setTimeout(() => { void stop('test time limit'); }, settings.maxMinutes * 60000);
    await room.connect(config.url, config.token, { autoSubscribe: true, dynacast: false });
    videoSource = new VideoSource(WIDTH, HEIGHT);
    videoTrack = LocalVideoTrack.createVideoTrack('agent-avatar', videoSource);
    await room.localParticipant.publishTrack(videoTrack, { source: TrackSource.SOURCE_CAMERA });
    let tick = 0;
    frames = setInterval(() => { if (!ending) videoSource.captureFrame(avatarFrame(tick++, speaking)); }, 1000/15);
    console.log('Agent room connected. Waiting for the FaceTime connector’s caller-audio track.');
    // No model connection or greeting before the operator connects the admitted guest.
    await new Promise(resolve => {
      function ready() {
        const participant = room.remoteParticipants.get(config.targetIdentity);
        if ([...(participant?.trackPublications.values() ?? [])].some(p => p.name === 'facetime-caller' && p.track)) {
          room.off(RoomEvent.TrackSubscribed, ready); resolve();
        }
      }
      room.on(RoomEvent.TrackSubscribed, ready); ready();
    });
    if (ending) throw new Error('Stopped');
    model = new realtime.RealtimeModel({
      apiKey, model: settings.model, voice: settings.voice,
      inputAudioTranscription: null,
      turnDetection: { type: 'semantic_vad', eagerness: 'medium', create_response: true, interrupt_response: true },
    });
    session = new voice.AgentSession({ llm: model, turnDetection: 'realtime_llm' });
    session.on(voice.AgentSessionEventTypes.AgentStateChanged, event => {
      speaking = event.newState === 'speaking';
      console.log(`Agent: ${event.newState}`);
    });
    session.on(voice.AgentSessionEventTypes.Error, () => { void stop('model/session error; check API access and billing', 1); });
    session.on(voice.AgentSessionEventTypes.Close, () => { void stop('conversation ended'); });
    await session.start({
      room, agent: new voice.Agent({ instructions: settings.instructions }), record: false,
      inputOptions: { participantIdentity: config.targetIdentity, audioEnabled: true, videoEnabled: false, textEnabled: false, closeOnDisconnect: true, deleteRoomOnClose: false },
      outputOptions: { audioEnabled: true, transcriptionEnabled: false },
    });
    session.generateReply({ instructions: 'Say a brief hello, introduce yourself as Chert the AI demo partner, and ask what the caller would like to talk about.' });
    console.log('Conversation ready. Ctrl+C or Stop in the connector ends this agent.');
  }
} catch {
  console.error('Agent could not start or continue. Check local room-token expiry, OpenAI key/model access, and agent settings. Private error details are omitted.');
  await stop('startup failure', 1);
}
