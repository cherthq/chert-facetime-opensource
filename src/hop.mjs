// Runs separately in each tab. Only SDP crosses Node; media stays on WebRTC.
export async function prepareHop(role) {
  const media = window.__chertSpike;
  if (!media || window.__chertHop) throw new Error('Hop cannot start');
  const peer = new media.NativePeer({ iceServers: [] });
  let received = 0;
  let failure = false;
  media.onStop(() => { peer.close(); });
  peer.addEventListener('track', ({ track }) => {
    received++;
    if (role === 'connector') media.attachCallerTrack(track);
    else void media.attachRoomTrack(track).catch(() => { failure = true; });
  });
  const stream = role === 'connector'
    ? await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
    : media.callerStream();
  stream.getTracks().forEach(track => peer.addTrack(track, stream));
  async function description(type) {
    await peer.setLocalDescription(type === 'offer' ? await peer.createOffer() : await peer.createAnswer());
    if (peer.iceGatheringState !== 'complete') {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { peer.removeEventListener('icegatheringstatechange', changed); reject(new Error('Local ICE timeout')); }, 5000);
        function changed() {
          if (peer.iceGatheringState === 'complete') { clearTimeout(timer); peer.removeEventListener('icegatheringstatechange', changed); resolve(); }
        }
        peer.addEventListener('icegatheringstatechange', changed);
      });
    }
    return { type: peer.localDescription.type, sdp: peer.localDescription.sdp };
  }
  window.__chertHop = {
    description,
    remote: value => peer.setRemoteDescription(value),
    status: () => ({ state: peer.connectionState, received, failure }),
  };
}

export async function connectHop(facePage, connectorPage) {
  await facePage.evaluate(prepareHop, 'facetime');
  await connectorPage.evaluate(prepareHop, 'connector');
  const offer = await connectorPage.evaluate(() => window.__chertHop.description('offer'));
  await facePage.evaluate(value => window.__chertHop.remote(value), offer);
  const answer = await facePage.evaluate(() => window.__chertHop.description('answer'));
  await connectorPage.evaluate(value => window.__chertHop.remote(value), answer);
  await Promise.all([facePage, connectorPage].map(page => page.waitForFunction(() => window.__chertHop.status().state === 'connected', null, { timeout: 10000 })));
}
