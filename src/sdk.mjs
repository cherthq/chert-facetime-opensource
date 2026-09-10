import { chromium } from 'playwright-core';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installMedia } from './media.mjs';
import { connectHop } from './hop.mjs';
import { validateConfig, validateFaceTimeLink } from './config.mjs';

const LOCAL = 'https://chert-connector.test';
export class FaceTimeGuest {
  static async open(options) {
    const link = validateFaceTimeLink(options?.faceTimeLink);
    const config = validateConfig({ url: options?.livekitUrl, token: options?.roomToken, targetIdentity: options?.agentIdentity });
    if (options.signal?.aborted) throw new Error('Opening the guest was cancelled.');
    const guest = new FaceTimeGuest();
    guest._signal = options.signal;
    guest._abort = () => { void guest.close().catch(() => {}); };
    options.signal?.addEventListener('abort', guest._abort, { once: true });
    try { await guest._open(link, config); return guest; }
    catch {
      await guest.close().catch(() => {});
      if (guest._profile) await rm(guest._profile, { recursive: true, force: true }).catch(() => {});
      throw new Error('Could not open the FaceTime guest. Check that Chrome is installed and the FaceTime page is reachable. Private navigation details are omitted.');
    }
  }
  constructor() {
    this.closed = new Promise(resolve => { this._resolveClosed = resolve; });
    this._closing = false;
  }
  _assertOpen() { if (this._closing) throw new Error('The FaceTime guest is closed.'); }
  async _open(link, config) {
    const bundle = await readFile(new URL('../dist/livekit.js', import.meta.url), 'utf8');
    this._assertOpen();
    this._profile = await mkdtemp(join(tmpdir(), 'chert-guest-'));
    this._assertOpen();
    this._launching = chromium.launchPersistentContext(this._profile, {
      channel: 'chrome', headless: false, chromiumSandbox: true, viewport: null,
      acceptDownloads: false, handleSIGINT: false, handleSIGTERM: false,
    });
    this._context = await this._launching;
    this._assertOpen();
    this._context.on('close', this._abort);
    this._face = this._context.pages()[0] ?? await this._context.newPage();
    this._connector = await this._context.newPage();
    for (const page of [this._face, this._connector]) {
      page.on('close', this._abort);
      // Stop and unexpected navigation end this owned session. No signaling endpoint is exposed.
      await page.exposeBinding('__chertStop', ({ frame }) => {
        if (frame === page.mainFrame()) this._abort();
      });
    }
    await this._face.addInitScript(installMedia, { speech: '', allowSpeech: false, caption: 'WAITING FOR YOUR AGENT' });
    await this._context.route(`${LOCAL}/**`, route => route.fulfill({ contentType: 'text/html', body: '<title>Chert connector</title><h1 style="margin-top:260px">Your LiveKit connector</h1><p>First join FaceTime and admit the guest on your iPhone. Then connect using the terminal, your SDK, or Connect LiveKit here. Stop test closes both tabs.</p>' }));
    await this._connector.addInitScript({ content: `if(location.origin===${JSON.stringify(LOCAL)}){(${installMedia.toString()})(${JSON.stringify({ speech: '', origin: LOCAL, allowSpeech: false, caption: 'WAITING FOR YOUR AGENT' })});${bundle}\nChertRoom.installLiveKit(${JSON.stringify(config)},false);}` });
    await this._connector.goto(LOCAL);
    await this._face.goto(link, { waitUntil: 'domcontentloaded', timeout: 30000 });
    this._assertOpen();
    await this._face.waitForFunction(() => !!window.__chertSpike);
    await this._face.getByRole('button', { name: 'Enable audio', exact: true }).click();
    await this._connector.getByRole('button', { name: 'Enable audio', exact: true }).click();
    await connectHop(this._face, this._connector);
    this._assertOpen();
    for (const page of [this._face, this._connector]) page.on('framenavigated', frame => {
      if (frame === page.mainFrame()) this._abort();
    });
    await this._face.bringToFront();
  }
  /** Call only after the human has joined and been admitted on the iPhone. */
  async connect() {
    this._assertOpen();
    try {
      await this._connector.evaluate(() => window.__chertRoom.connect());
      const state = await this.status();
      if (!state.roomConnected) throw new Error();
      return state;
    } catch { throw new Error('LiveKit did not connect. Check the connector tab, token expiry, room access, and network.'); }
  }
  async status() {
    if (this._closing) return { closed: true, roomConnected: false, audio: false, video: false, mediaLinkConnected: false };
    try {
      const result = await this._connector.evaluate(() => ({ ...window.__chertRoom.status(), mediaLinkConnected: window.__chertHop.status().state === 'connected' }));
      return { closed: false, ...result };
    } catch { throw new Error('The connector is no longer available.'); }
  }
  close() {
    if (this._closePromise) return this._closePromise;
    this._closing = true;
    this._signal?.removeEventListener('abort', this._abort);
    this._closePromise = Promise.resolve().then(async () => {
      const context = this._context ?? await this._launching?.catch(() => undefined);
      let timer;
      await Promise.race([
        Promise.allSettled((context?.pages() ?? []).map(page => page.evaluate(() => window.__chertSpike?.stop()))),
        new Promise(resolve => { timer = setTimeout(resolve, 3000); }),
      ]);
      clearTimeout(timer);
      await context?.close();
      if (this._profile) await rm(this._profile, { recursive: true, force: true });
    }).finally(() => this._resolveClosed());
    return this._closePromise;
  }
  async [Symbol.asyncDispose]() { await this.close(); }
}
