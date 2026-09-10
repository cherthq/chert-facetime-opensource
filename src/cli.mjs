#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { readFile } from 'node:fs/promises';
import { FaceTimeGuest } from './sdk.mjs';

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`@trychert/facetime-opensource

Usage: facetime-opensource [--config path/to/livekit.json]

Opens a visible Chrome guest for an existing LiveKit agent.
Requires Node 22.22+ and installed Google Chrome. Tested on macOS.
Without --config, prompts for the room URL, short-lived token, and agent identity.
Always prompts privately for the FaceTime link. Never pass tokens or links as arguments.
Config fields: url, token, targetIdentity. No configuration is saved by this CLI.
Join and iPhone admission stay manual. Ctrl+C or Stop test closes the connector.
Your agent runs separately; this command does not deploy or stop its backend.`);
  process.exit(0);
}
if (args.length && !(args.length === 2 && args[0] === '--config')) {
  console.error('Unknown arguments. Run facetime-opensource --help.'); process.exit(1);
}
if (!process.stdin.isTTY) { console.error('Run this CLI in an interactive terminal, or use the SDK.'); process.exit(1); }
let hidden = false;
const input = createInterface({ input: process.stdin, terminal: true, output: new Writable({ write(chunk, encoding, done) { if (!hidden) process.stdout.write(chunk, encoding); done(); } }) });
const abort = new AbortController();
let guest;
function cancel() { abort.abort(); input.close(); }
process.on('SIGINT', cancel); process.on('SIGTERM', cancel); input.on('SIGINT', cancel);
input.on('close', () => abort.abort());
async function ask(label, secret = false) {
  console.log(label); hidden = secret;
  try { return (await input.question('')).trim(); }
  finally { hidden = false; if (secret) console.log(); }
}
try {
  let config;
  if (args[0] === '--config') {
    try { config = JSON.parse(await readFile(args[1], 'utf8')); }
    catch { throw new Error('Could not read the config file. Expected JSON with url, token, targetIdentity.'); }
  } else {
    config = { url: await ask('LiveKit server URL (wss://…):'), token: await ask('Room token (hidden):', true), targetIdentity: await ask('Agent participant identity:') };
  }
  const faceTimeLink = await ask('FaceTime link (hidden):', true);
  console.log('Opening Chrome and preparing the local media link…');
  guest = await FaceTimeGuest.open({ faceTimeLink, livekitUrl: config.url, roomToken: config.token, agentIdentity: config.targetIdentity, signal: abort.signal });
  guest.closed.then(() => input.close());
  await ask('Click Join in Chrome, then admit the guest on your iPhone. Press Enter here ONLY after admission:');
  await guest.connect();
  console.log('LiveKit connected. Talk to your agent on FaceTime.');
  await ask('Press Enter to stop, or use Stop test in Chrome.');
} catch (error) {
  if (!abort.signal.aborted) { console.error(error.message); process.exitCode = 1; }
} finally {
  await guest?.close().catch(() => { console.error('Chrome cleanup failed. Close the test window manually.'); process.exitCode = 1; });
  input.close();
  process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel);
  if (guest) console.log('Connector stopped.');
}
