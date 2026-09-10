import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { mkdir, writeFile, chmod } from 'node:fs/promises';

if (!process.stdin.isTTY) { console.error('Run npm run agent:setup in your terminal.'); process.exit(1); }
const input = createInterface({ input: process.stdin, output: new Writable({ write(_chunk, _encoding, done) { done(); } }), terminal: true });
input.on('SIGINT', () => { input.close(); process.exit(130); });
try {
  console.log('OpenAI API key (hidden; stored only in ignored .local/openai.json):');
  const apiKey = (await input.question('')).trim();
  if (!apiKey || /\s/.test(apiKey)) throw new Error();
  const directory = new URL('../.local/', import.meta.url);
  const file = new URL('openai.json', directory);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  await writeFile(file, JSON.stringify({ apiKey }) + '\n', { mode: 0o600 });
  await chmod(file, 0o600);
  console.log('\nSaved locally. The key is not sent to the browser. Model access is checked when the agent starts.');
} catch { console.error('\nCould not save the key. No private details logged.'); process.exitCode = 1; }
finally { input.close(); }
