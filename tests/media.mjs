import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { installMedia } from '../src/media.mjs';

const browser = await chromium.launch({ channel: 'chrome', headless: false, chromiumSandbox: true });
try {
  const context = await browser.newContext();
  const origin = 'https://chert-spike.test';
  await context.route(`${origin}/**`, route => route.fulfill({ contentType: 'text/html', body: '<title>Local media check</title><p>Local synthetic test. No FaceTime call.</p>' }));
  await context.addInitScript(installMedia, { origin, speech: (await readFile(new URL('../assets/speech.wav', import.meta.url))).toString('base64') });
  const page = await context.newPage();
  await page.goto(origin);
  await page.getByRole('button', { name: 'Enable audio', exact: true }).click();
  const kinds = await page.evaluate(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    window.fixtureStream = stream;
    const tx = new RTCPeerConnection();
    const rx = new RTCPeerConnection();
    window.testPeers = [tx, rx];
    tx.onicecandidate = e => { if (e.candidate) void rx.addIceCandidate(e.candidate); };
    rx.onicecandidate = e => { if (e.candidate) void tx.addIceCandidate(e.candidate); };
    window.receivedVideo = document.createElement('video');
    window.receivedVideo.muted = true;
    document.body.append(window.receivedVideo);
    rx.addEventListener('track', e => {
      if (e.track.kind === 'video') { window.receivedVideo.srcObject = new MediaStream([e.track]); void window.receivedVideo.play(); }
    });
    stream.getTracks().forEach(t => tx.addTrack(t, stream));
    await tx.setLocalDescription(await tx.createOffer());
    await rx.setRemoteDescription(tx.localDescription);
    await rx.setLocalDescription(await rx.createAnswer());
    await tx.setRemoteDescription(rx.localDescription);
    return stream.getTracks().map(t => t.kind).sort();
  });
  assert.deepEqual(kinds, ['audio', 'video']);
  await page.waitForFunction(() => window.__chertSpike.snapshot().incomingAudio === 1 && window.receivedVideo.videoWidth === 640);
  await page.getByRole('button', { name: 'Send test speech', exact: true }).click();
  try { await page.waitForFunction(() => window.__chertSpike.snapshot().level > 0.005, null, { timeout: 10000 }); }
  catch (error) {
    console.log(await page.evaluate(async () => ({ ...window.__chertSpike.snapshot(),
      rtp: (await Promise.all(window.testPeers.map(p => p.getStats()))).flatMap(s => [...s.values()].filter(x => ['inbound-rtp', 'outbound-rtp', 'media-source'].includes(x.type)).map(x => ({ type: x.type, kind: x.kind, bytesSent: x.bytesSent, bytesReceived: x.bytesReceived, energy: x.totalAudioEnergy, level: x.audioLevel }))) })));
    throw error;
  }
  const before = await page.evaluate(() => window.receivedVideo.getVideoPlaybackQuality().totalVideoFrames);
  await page.waitForFunction(n => window.receivedVideo.getVideoPlaybackQuality().totalVideoFrames > n + 3, before);
  await page.evaluate(() => window.__chertSpike.stop());
  const ended = await page.evaluate(() => ({ ...window.__chertSpike.snapshot(), outputEnded: window.fixtureStream.getTracks().every(t => t.readyState === 'ended') }));
  assert.equal(ended.liveTracks, 0);
  assert.equal(ended.peers, 0);
  assert.equal(ended.audioState, 'closed');
  assert.equal(ended.outputEnded, true);
  assert.equal(await page.evaluate(() => navigator.mediaDevices.getUserMedia({ audio: true }).then(() => false, e => e.name === 'AbortError')), true);
  console.log('PASS: generated audio/video crossed a local WebRTC connection; received video frames advanced, speech reached the audio meter, and Stop ended tracks, peers and audio. No FaceTime call attempted.');
} finally {
  await browser.close();
}
