import { AccessToken } from 'livekit-server-sdk';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { mkdir, writeFile, chmod } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

if (!process.stdin.isTTY) { console.error('Run npm run tokens in an interactive terminal.'); process.exit(1); }
let hidden = false;
const output = new Writable({ write(chunk, encoding, done) { if (!hidden) process.stdout.write(chunk, encoding); done(); } });
const input = createInterface({ input: process.stdin, output, terminal: true });
input.on('SIGINT', () => { input.close(); process.exit(130); });
async function ask(label, secret = false) {
  console.log(label);
  hidden = secret;
  const answer = (await input.question('')).trim();
  hidden = false;
  if (secret) console.log();
  return answer;
}
try {
  const url = await ask('LiveKit project URL (wss://…):');
  const parsed = new URL(url);
  if (parsed.protocol !== 'wss:' || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error();
  const key = await ask('LiveKit API key (hidden):', true);
  const secret = await ask('LiveKit API secret (hidden; never saved):', true);
  if (!key || !secret) throw new Error();
  const room = `chert-spike-${randomUUID()}`;
  await mkdir('.local', { recursive: true, mode: 0o700 });
  await chmod('.local', 0o700);
  for (const [file, identity, targetIdentity] of [
    ['livekit.json', 'facetime-guest', 'test-peer'], ['peer.json', 'test-peer', 'facetime-guest'],
  ]) {
    const token = new AccessToken(key, secret, { identity, ttl: '1h' });
    token.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true, canPublishData: false });
    const path = `.local/${file}`;
    await writeFile(path, JSON.stringify({ url, token: await token.toJwt(), targetIdentity }, null, 2) + '\n', { mode: 0o600 });
    await chmod(path, 0o600);
  }
  console.log('Created .local/livekit.json and .local/peer.json with one-hour join tokens. API secret was not saved. Stop both test sessions when done; token expiry alone does not end a connected call.');
} catch { console.error('Could not create tokens. Check the URL and API credentials; private details are omitted.'); process.exitCode = 1; }
finally { input.close(); }
