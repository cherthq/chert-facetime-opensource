import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
const result = await build({
  entryPoints: [fileURLToPath(new URL('../src/livekit.mjs', import.meta.url))],
  outfile: fileURLToPath(new URL('../dist/livekit.js', import.meta.url)),
  bundle: true, format: 'iife', globalName: 'ChertRoom', platform: 'browser',
  define: { RTCPeerConnection: 'window.__chertSpike.NativePeer' },
  minify: true, legalComments: 'eof', logLevel: 'warning', metafile: true,
});
const dependencies = new Map();
for (const input of Object.keys(result.metafile.inputs)) {
  if (!input.includes('node_modules/')) continue;
  let directory = dirname(resolve(input));
  while (directory.includes('node_modules')) {
    try {
      const pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
      if (pkg.name) { dependencies.set(directory, pkg); break; }
    } catch { /* Move up to the containing package. */ }
    directory = dirname(directory);
  }
}
const notices = ['Third-party code bundled into dist/livekit.js.\n'];
for (const [directory, pkg] of [...dependencies].sort((a,b) => a[1].name.localeCompare(b[1].name))) {
  notices.push(`\n--- ${pkg.name} ${pkg.version} (${pkg.license ?? 'see license below'}) ---\n`);
  const files = (await readdir(directory, { withFileTypes: true })).filter(f => f.isFile() && /^(licen[cs]e|copying|notice)/i.test(f.name));
  if (!files.length) throw new Error(`Missing license notice for ${pkg.name}`);
  for (const file of files) notices.push(await readFile(join(directory, file.name), 'utf8'));
}
await writeFile(new URL('../dist/THIRD_PARTY_NOTICES.txt', import.meta.url), notices.join('\n'));
console.log('Built browser connector bundle.');
