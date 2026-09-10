import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { AccessToken } from 'livekit-server-sdk';
import { livekitInit, validateConfig } from '../src/bundle.mjs';

const token = new AccessToken('local-fixture-key', 'local-fixture-secret-at-least-32-characters', { identity: 'test-peer', ttl: '10m' });
token.addGrant({ roomJoin: true, room: 'local-fixture', canPublish: true, canSubscribe: true, canPublishData: false });
const config = validateConfig({ url: 'wss://fixture.invalid', token: await token.toJwt(), targetIdentity: 'facetime-guest' });
assert.throws(() => validateConfig({ ...config, targetIdentity: 'test-peer' }));
assert.throws(() => validateConfig({ ...config, url: 'https://fixture.invalid' }));
assert.throws(() => validateConfig({ ...config, token: 'invalid' }));
const init = await livekitInit(config, true);
assert.ok(init.includes('new window.__chertSpike.NativePeer('), 'SDK must use the native peer constructor, outside the FaceTime observer');
const browser = await chromium.launch({ channel: 'chrome', headless: false, chromiumSandbox: true });
try {
  const context = await browser.newContext();
  await context.route('**/*', route => route.request().url() === 'https://chert-spike.test/'
    ? route.fulfill({ contentType: 'text/html', body: '<title>Local LiveKit wiring check</title>' }) : route.abort());
  await context.addInitScript({ content: init });
  const page = await context.newPage();
  await page.goto('https://chert-spike.test');
  await page.getByRole('button', { name: 'Enable audio', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Connect LiveKit', exact: true }).count(), 1);
  await page.evaluate(async () => {
    const api = window.__chertSpike;
    const native = new api.NativePeer();
    window.fixtureNative = native;
    if (api.snapshot().peers !== 0) throw new Error('Native peer leaked into FaceTime observer');
    const audio = new AudioContext(); await audio.resume(); window.fixtureAudio = audio;
    const dest = audio.createMediaStreamDestination();
    const tone = audio.createOscillator(); tone.frequency.value = 440; tone.connect(dest); tone.start();
    await api.attachRoomTrack(dest.stream.getAudioTracks()[0]);
    const outgoing = await navigator.mediaDevices.getUserMedia({ audio: true });
    const meter = stream => { const a = audio.createAnalyser(); audio.createMediaStreamSource(stream).connect(a); return a; };
    window.outMeter = meter(outgoing);
    window.callerMeter = meter(api.callerStream());
    window.rms = analyser => { const data = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(data); return Math.sqrt(data.reduce((sum, v) => sum + v*v, 0) / data.length); };
  });
  await page.waitForFunction(() => window.rms(window.outMeter) > 0.01);
  assert.equal(await page.evaluate(() => window.rms(window.callerMeter)), 0, 'Room output must not feed the caller stream');
  await page.evaluate(() => window.__chertSpike.detachRoomTrack('audio'));
  await page.waitForFunction(() => window.rms(window.outMeter) < 0.0001);
  await page.evaluate(async () => { await window.__chertSpike.stop(); window.fixtureNative.close(); await window.fixtureAudio.close(); });
  const ended = await page.evaluate(() => window.__chertSpike.snapshot());
  assert.equal(ended.liveTracks, 0);
  assert.equal(ended.audioState, 'closed');
  console.log('PASS: real LiveKit bundle loads, SDK peers bypass FaceTime observation, room audio reaches outgoing media but not the caller mix, detach silences output, and Stop closes local media. No server connection attempted.');
} finally { await browser.close(); }
