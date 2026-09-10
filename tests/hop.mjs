import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { installMedia } from '../src/media.mjs';
import { connectHop } from '../src/hop.mjs';
import { readFile } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'chrome', headless: false, chromiumSandbox: true });
try {
  const context = await browser.newContext();
  const speech = (await readFile(new URL('../assets/speech.wav', import.meta.url))).toString('base64');
  const origins = ['https://face-fixture.test', 'https://connector-fixture.test'];
  const pages = [];
  for (const origin of origins) {
    await context.route(`${origin}/**`, route => route.fulfill({ contentType: 'text/html', body: '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'; style-src \'unsafe-inline\'; media-src blob:; connect-src \'self\'"><title>Local hop test</title>' }));
    const page = await context.newPage();
    await page.addInitScript(installMedia, { speech, origin });
    await page.goto(origin);
    await page.getByRole('button', { name: 'Enable audio', exact: true }).click();
    pages.push(page);
  }
  const [face, connector] = pages;
  await connectHop(face, connector);
  // Meter the FaceTime output and connector caller mix independently.
  for (const page of pages) await page.evaluate(async () => {
    const audio = new AudioContext(); await audio.resume(); window.fixtureAudio = audio;
    const make = stream => { const meter = audio.createAnalyser(); audio.createMediaStreamSource(stream).connect(meter); return meter; };
    window.outMeter = make(await navigator.mediaDevices.getUserMedia({ audio: true }));
    window.callerMeter = make(window.__chertSpike.callerStream());
    window.rms = meter => { const d = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(d); return Math.sqrt(d.reduce((s,v) => s+v*v,0)/d.length); };
  });
  await connector.getByRole('button', { name: 'Send test speech', exact: true }).click();
  await face.waitForFunction(() => window.rms(window.outMeter) > 0.005);
  assert.equal(await connector.evaluate(() => window.rms(window.callerMeter)), 0, 'No room output echo to caller mix');
  await connector.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
    const paint = canvas.getContext('2d'); paint.fillStyle = '#ff00ff'; paint.fillRect(0, 0, 640, 360);
    const track = canvas.captureStream(15).getVideoTracks()[0];
    window.fixtureVideo = track;
    await window.__chertSpike.attachRoomTrack(track);
  });
  await face.evaluate(async () => {
    const video = document.createElement('video'); video.muted = true;
    video.srcObject = await navigator.mediaDevices.getUserMedia({ video: true });
    await video.play(); window.outputVideo = video;
  });
  await face.waitForFunction(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
    const paint = canvas.getContext('2d'); paint.drawImage(window.outputVideo, 0, 0, 1, 1);
    const [r,g,b] = paint.getImageData(0,0,1,1).data;
    return r > 200 && g < 40 && b > 200;
  });
  await face.evaluate(() => {
    const ac = window.fixtureAudio;
    const oscillator = ac.createOscillator(); oscillator.frequency.value = 880;
    const dest = ac.createMediaStreamDestination(); oscillator.connect(dest); oscillator.start();
    window.__chertSpike.attachCallerTrack(dest.stream.getAudioTracks()[0]);
  });
  await connector.waitForFunction(() => window.rms(window.callerMeter) > 0.01);
  assert.equal(await face.evaluate(() => window.__chertSpike.snapshot().peers), 0, 'Hop peers must stay outside FaceTime observer');
  for (const page of pages) {
    await page.evaluate(async () => { await window.__chertSpike.stop(); window.fixtureVideo?.stop(); await window.fixtureAudio.close(); });
    assert.equal(await page.evaluate(() => window.__chertHop.status().state), 'closed');
    assert.equal(await page.evaluate(() => window.__chertSpike.snapshot().liveTracks), 0);
  }
  console.log('PASS: two origins with restrictive connect-src exchange audio in both directions and relay test video over the local hop, without feeding outbound audio into the caller mix; Stop closes both peers. No FaceTime or LiveKit service used.');
} finally { await browser.close(); }
