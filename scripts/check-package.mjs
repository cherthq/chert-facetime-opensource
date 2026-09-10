import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../', import.meta.url));
const directory = await mkdtemp(join(tmpdir(), 'chert-package-check-'));
try {
  const [packed] = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', directory], { cwd: root, encoding: 'utf8' }));
  for (const { path } of packed.files) assert.match(path, /^(src\/(sdk\.mjs|cli\.mjs|index\.d\.ts|config\.mjs|media\.mjs|hop\.mjs)|dist\/(livekit\.js|THIRD_PARTY_NOTICES\.txt)|README\.md|LICENSE|package\.json)$/);
  await writeFile(join(directory, 'package.json'), JSON.stringify({ private:true,type:'module' }));
  execFileSync('npm', ['install', '--ignore-scripts', '--omit=dev', '--package-lock=false', join(directory, packed.filename)], { cwd: directory, stdio: 'pipe' });
  const manifest = JSON.parse(await readFile(join(directory, 'node_modules/@trychert/facetime-opensource/package.json'), 'utf8'));
  assert.deepEqual(Object.keys(manifest.dependencies), ['playwright-core']);
  const help = execFileSync(join(directory, 'node_modules/.bin/facetime-opensource'), ['--help'], { cwd: directory, encoding:'utf8' });
  assert.match(help, /@trychert\/facetime-opensource/);
  const sdk = pathToFileURL(join(directory, 'node_modules/@trychert/facetime-opensource/src/sdk.mjs')).href;
  execFileSync(process.execPath, [join(root, 'tests/sdk.mjs')], { cwd: directory, env: { ...process.env, CHERT_SDK_TEST_ENTRY: sdk }, stdio: 'inherit' });
  console.log(`PASS: packed ${packed.files.length} allowlisted files (${Math.round(packed.size/1024)} KiB), installed in a clean directory, and verified installed CLI + SDK. No credentials, agent dependencies, or fixtures shipped.`);
} finally { await rm(directory, { recursive:true,force:true }); }
