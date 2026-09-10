import { chromium } from 'playwright';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { installMedia } from './media.mjs';
import { livekitInit, validateConfig } from './bundle.mjs';
import { connectHop } from './hop.mjs';

// Join and permission decisions remain manual in both modes.
const flags = process.argv.slice(2);
if (flags.some(flag => !['--smoke', '--inspect', '--synthetic', '--livekit', '--peer'].includes(flag))) {
  console.error('Usage: npm start [-- --inspect --synthetic] | npm run smoke. Paste links at the prompt, not in arguments.');
  process.exit(1);
}
const smoke = flags.includes('--smoke');
const peer = flags.includes('--peer');
const livekit = peer || flags.includes('--livekit');
const synthetic = livekit || flags.includes('--synthetic');
let muted = false;
const output = new Writable({
  write(chunk, encoding, done) {
    if (!muted) process.stdout.write(chunk, encoding);
    done();
  },
});
const input = createInterface({ input: process.stdin, output, terminal: Boolean(process.stdin.isTTY) });
let context;
let profile;
let launching;
let stopping = false;
let stopPromise;
async function stop() {
  if (stopping) return stopPromise;
  stopping = true;
  stopPromise = (async () => {
    input.close();
    const ownedContext = context ?? await launching?.catch(() => undefined);
    if (synthetic) {
      let timeout;
      await Promise.race([
        Promise.allSettled((ownedContext?.pages() ?? []).map(page => page.evaluate(() => window.__chertSpike?.stop()))),
        new Promise(resolve => { timeout = setTimeout(resolve, 3000); }),
      ]);
      clearTimeout(timeout);
    }
    await ownedContext?.close();
    if (profile) await rm(profile, { recursive: true, force: true });
    console.log('\nStopped. The temporary Chrome profile was removed.');
  })();
  return stopPromise;
}
async function exitOnSignal() {
  try { await stop(); } catch { process.exitCode = 1; }
}
process.on('SIGINT', exitOnSignal);
process.on('SIGTERM', exitOnSignal);
input.on('SIGINT', exitOnSignal);

try {
  let roomInit;
  if (livekit) {
    let config;
    try { config = validateConfig(JSON.parse(await readFile(new URL(peer ? '../.local/peer.json' : '../.local/livekit.json', import.meta.url), 'utf8'))); }
    catch { console.error('LiveKit config missing or invalid. Run npm run tokens to create fresh local test credentials.'); throw new Error(); }
    roomInit = await livekitInit(config, peer, peer ? undefined : 'https://chert-connector.test');
  }
  profile = await mkdtemp(join(tmpdir(), 'chert-guest-'));
  launching = chromium.launchPersistentContext(profile, {
    channel: 'chrome',
    headless: false,
    chromiumSandbox: true,
    viewport: null,
    acceptDownloads: false,
    handleSIGINT: false,
    handleSIGTERM: false,
    args: flags.includes('--inspect') ? ['--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0'] : [],
  });
  context = await launching;
  // A signal can arrive while Chrome is still launching.
  if (stopping) {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  } else {
    context.on('close', () => { void stop().catch(() => { process.exitCode = 1; }); });
    if (synthetic) {
      await context.exposeBinding('__chertStop', ({ frame }) => {
        const allowed = peer ? ['https://chert-spike.test'] : ['https://facetime.apple.com', 'https://chert-connector.test'];
        if (allowed.includes(new URL(frame.url()).origin)) void stop().catch(() => { process.exitCode = 1; });
      });
      if (roomInit && peer) await context.addInitScript({ content: roomInit });
      else {
        const speech = (await readFile(new URL('../assets/speech.wav', import.meta.url))).toString('base64');
        await context.addInitScript(installMedia, { speech, allowSpeech: !livekit, caption: livekit ? 'WAITING FOR CONNECTOR' : 'CHERT • GENERATED VIDEO' });
      }
      console.log('Synthetic mode: generated camera and speech; no real mic/camera fallback.');
    }
    const page = context.pages()[0] ?? await context.newPage();
    let connectorPage;
    if (livekit && !peer) {
      await context.route('https://chert-connector.test/**', route => route.fulfill({ contentType: 'text/html', body: '<title>Chert local connector</title><h1 style="margin-top:260px">Local LiveKit connector</h1><p>Keep this window open. After the iPhone admits the FaceTime guest, click Connect LiveKit here. Stop test closes both tabs.</p>' }));
      connectorPage = await context.newPage();
      await connectorPage.addInitScript({ content: roomInit });
      connectorPage.on('close', () => { void stop().catch(() => { process.exitCode = 1; }); });
      await connectorPage.goto('https://chert-connector.test');
    }
    page.on('close', () => { void stop().catch(() => { process.exitCode = 1; }); });
    await page.setContent(`<title>Chert guest — baseline</title><h1>Chrome is ready</h1><p>Paste a FaceTime link in the terminal. Join and admission remain manual.</p><p>${synthetic ? 'Generated media mode. Real mic and camera acquisition is replaced.' : 'Baseline mode uses ordinary browser media permissions.'}</p><p>Return to the terminal and press Enter to stop after opening the link, or close this window.</p>`);
    console.log(`Fresh visible Chrome opened (${context.browser()?.version() ?? 'installed Chrome'}).`);
    if (flags.includes('--inspect')) {
      const port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0];
      console.log(`Local inspection port: ${port}`);
    }
    if (peer) {
      await context.route('https://chert-spike.test/**', route => route.fulfill({ contentType: 'text/html', body: '<title>Chert LiveKit test peer</title><h1 style="margin-top:260px">LiveKit test participant</h1><p>Connect LiveKit, then Send test speech. Use headphones to hear the caller without acoustic feedback. Stop both test windows when done.</p>' }));
      await page.goto('https://chert-spike.test');
      console.log('Test participant ready. Click Connect LiveKit. Press Enter here to stop.');
      input.once('line', () => { void stop(); });
      input.on('close', () => { void stop(); });
    } else if (smoke) {
      if (await page.title() !== 'Chert guest — baseline') throw new Error('Smoke check failed');
      console.log('PASS: visible Chrome launched and rendered the local baseline page. No FaceTime call attempted.');
      await stop();
    } else {
      console.log('Paste a fresh FaceTime link (hidden), then press Enter:');
      muted = true;
      input.question('', async value => {
        muted = false;
        let url;
        try {
          url = new URL(value.trim());
          if (url.protocol !== 'https:' || url.hostname !== 'facetime.apple.com' || url.username || url.password || url.port) throw new Error();
        } catch {
          console.error('\nExpected an HTTPS link on facetime.apple.com. Run again with a fresh FaceTime link.');
          process.exitCode = 1;
          await stop();
          return;
        }
        console.log('\nOpening FaceTime. Click Join yourself if a browser guest flow is offered.');
        console.log('Press Enter here to Stop, or close the Chrome window.');
        input.once('line', () => { void stop().catch(() => { process.exitCode = 1; }); });
        try {
          await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
          if (connectorPage) {
            await page.waitForFunction(() => !!window.__chertSpike);
            await page.getByRole('button', { name: 'Enable audio', exact: true }).click();
            await connectorPage.getByRole('button', { name: 'Enable audio', exact: true }).click();
            await connectHop(page, connectorPage);
            console.log('Local media link connected. Join FaceTime and wait for iPhone admission, then click Connect LiveKit in the connector tab.');
            await page.bringToFront();
          }
        }
        catch {
          if (!stopping) console.log('Navigation or local media setup did not finish. Check Chrome; private details are omitted. Stop and restart before retrying.');
        }
      });
      input.on('close', () => { void stop().catch(() => { process.exitCode = 1; }); });
    }
  }
} catch {
  console.error('Could not complete the Chrome check. Confirm Google Chrome is installed; private navigation details are omitted.');
  process.exitCode = 1;
  await stop().catch(() => {});
}
