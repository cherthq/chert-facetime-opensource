import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { installMedia } from './media.mjs';

export async function livekitInit(config, testPeer = false, pageOrigin) {
  const speech = (await readFile(new URL('../assets/speech.wav', import.meta.url))).toString('base64');
  const result = await build({
    entryPoints: [fileURLToPath(new URL('./livekit.mjs', import.meta.url))],
    bundle: true, write: false, format: 'iife', globalName: 'ChertRoom', platform: 'browser',
    define: { RTCPeerConnection: 'window.__chertSpike.NativePeer' },
    minify: true, logLevel: 'silent',
  });
  const origin = pageOrigin ?? (testPeer ? 'https://chert-spike.test' : 'https://facetime.apple.com');
  // One ordered init bundle, held in memory. No token in generated files or URLs.
  const mediaOptions = { speech, origin, allowSpeech: testPeer, caption: testPeer ? 'LIVEKIT TEST PEER' : 'WAITING FOR LIVEKIT VIDEO' };
  return `if(location.origin===${JSON.stringify(origin)}){(${installMedia.toString()})(${JSON.stringify(mediaOptions)});${result.outputFiles[0].text}\nChertRoom.installLiveKit(${JSON.stringify(config)},${testPeer});}`;
}

export { validateConfig } from './config.mjs';
