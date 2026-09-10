import { chromium } from 'playwright';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { installMedia } from './media.mjs';

// Join and permission decisions remain manual in both modes.
const flags = process.argv.slice(2);
if (flags.some(flag => !['--smoke', '--inspect', '--synthetic'].includes(flag))) {
  console.error('Usage: npm start [-- --inspect --synthetic] | npm run smoke. Paste links at the prompt, not in arguments.');
  process.exit(1);
}
const smoke = flags.includes('--smoke');
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
    if (flags.includes('--synthetic')) {
      await Promise.allSettled((ownedContext?.pages() ?? []).map(page => page.evaluate(() => window.__chertSpike?.stop())));
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
    if (flags.includes('--synthetic')) {
      await context.exposeBinding('__chertStop', ({ frame }) => {
        if (new URL(frame.url()).origin === 'https://facetime.apple.com') void stop();
      });
      const speech = (await readFile(new URL('../assets/speech.wav', import.meta.url))).toString('base64');
      await context.addInitScript(installMedia, { speech });
      console.log('Synthetic mode: generated camera and speech; no real mic/camera fallback.');
    }
    const page = context.pages()[0] ?? await context.newPage();
    page.on('close', () => { void stop().catch(() => { process.exitCode = 1; }); });
    await page.setContent('<title>Chert guest — baseline</title><h1>Chrome is ready</h1><p>Paste a FaceTime link in the terminal. Join and admission remain manual.</p><p>This first check uses ordinary browser media permissions. No fake camera or microphone is installed yet.</p><p>Return to the terminal and press Enter to stop after opening the link, or close this window.</p>');
    console.log(`Fresh visible Chrome opened (${context.browser()?.version() ?? 'installed Chrome'}).`);
    if (flags.includes('--inspect')) {
      const port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0];
      console.log(`Local inspection port: ${port}`);
    }
    if (smoke) {
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
        try { await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 30000 }); }
        catch {
          if (!stopping) console.log('Navigation did not finish. Check the Chrome window; the link is omitted from diagnostics.');
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
