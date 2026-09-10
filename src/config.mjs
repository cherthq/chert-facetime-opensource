export function validateConfig(config) {
  try {
    const url = new URL(config.url);
    const claims = JSON.parse(Buffer.from(config.token.split('.')[1], 'base64url').toString());
    if (url.protocol !== 'wss:' || url.username || url.password || url.search || url.hash ||
      typeof config.targetIdentity !== 'string' || !config.targetIdentity.trim() ||
      config.targetIdentity === claims.sub || !claims.sub || !claims.video?.roomJoin || !claims.video.room ||
      claims.video.canPublish !== true || claims.video.canSubscribe !== true ||
      !Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now() || claims.exp * 1000 > Date.now() + 61 * 60 * 1000) throw new Error();
    return { url: url.href, token: config.token, targetIdentity: config.targetIdentity };
  } catch { throw new Error('Use a WSS LiveKit URL, a fresh room-scoped publish/subscribe token (maximum one hour), and a different agent identity.'); }
  // Shape/expiry checks only; LiveKit authenticates the signature.
}

export function validateFaceTimeLink(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'facetime.apple.com' || url.username || url.password || url.port || url.pathname !== '/join' || !url.hash) throw new Error();
    return url.href;
  } catch { throw new Error('Use a FaceTime HTTPS join link created on your iPhone.'); }
}
