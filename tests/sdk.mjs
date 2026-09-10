import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { createRequire } from 'node:module';
const entry = process.env.CHERT_SDK_TEST_ENTRY ?? new URL('../src/sdk.mjs', import.meta.url).href;
const playwright = await import(createRequire(entry).resolve('playwright-core'));
const chromium = playwright.chromium ?? playwright.default.chromium;
const { FaceTimeGuest } = await import(entry);
const token = `fixture.${Buffer.from(JSON.stringify({ sub:'connector', exp:Math.floor(Date.now()/1000)+600, video:{room:'test',roomJoin:true,canPublish:true,canSubscribe:true} })).toString('base64url')}.signature`;
const options = { faceTimeLink:'https://facetime.apple.com/join#local-fixture', livekitUrl:'wss://fixture.invalid', roomToken:token, agentIdentity:'agent' };
await assert.rejects(FaceTimeGuest.open({...options,faceTimeLink:'https://example.com'}),/FaceTime HTTPS/);
await assert.rejects(FaceTimeGuest.open({...options,signal:AbortSignal.abort()}),/cancelled/);
const launch = chromium.launchPersistentContext.bind(chromium);
chromium.launchPersistentContext = async (...args) => {
  const context = await launch(...args);
  await context.route('https://facetime.apple.com/**', route => route.fulfill({ contentType:'text/html',body:'<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'; style-src \'unsafe-inline\'; media-src blob:; connect-src \'self\'"><title>Offline FaceTime fixture</title>' }));
  return context;
};
let guest;
try {
  guest = await FaceTimeGuest.open(options);
  assert.equal((await guest.status()).mediaLinkConnected,true);
  assert.equal((await guest.status()).roomConnected,false);
  assert.equal(await guest._face.evaluate(()=>typeof window.__chertRoom),'undefined');
  assert.equal(await guest._face.evaluate(t=>document.documentElement.outerHTML.includes(t),token),false);
  const profile = guest._profile;
  await Promise.all([guest.close(),guest.close()]);
  await guest.closed;
  assert.equal((await guest.status()).closed,true);
  await assert.rejects(access(profile));
  await assert.rejects(guest.connect(),/closed/);
  guest = await FaceTimeGuest.open(options);
  const secondProfile=guest._profile;
  await guest._face.getByRole('button',{name:'Stop test',exact:true}).click();
  await guest.closed;
  await assert.rejects(access(secondProfile));
  console.log('PASS: SDK opens a local two-tab fixture, exposes no room client in the FaceTime page, and closes both tabs/profiles through close() and browser Stop. No live call or server connection.');
} finally { await guest?.close(); chromium.launchPersistentContext=launch; }
