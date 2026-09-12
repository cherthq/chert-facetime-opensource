<h1 align="center">Chert FaceTime Opensource</h1>

<p align="center"><strong>An open-source CLI/SDK for deploying real-time video agents to FaceTime</strong></p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.1-blue" alt="version 0.1.1">
  <a href="https://trychert.com/facetime"><img src="https://img.shields.io/badge/Chert-Website-black" alt="Chert Website"></a>
  <a href="https://www.ycombinator.com/companies/chert"><img src="https://img.shields.io/badge/Y%20Combinator-Spring%202026-ff6600" alt="Y Combinator Spring 2026"></a>
</p>

Chert FaceTime Opensource lets any builder put their AI agent on a live FaceTime call with a simple CLI/SDK. You own the agent's code, personality, voice, model, and avatar, and run it locally or deploy it yourself through services such as LiveKit. The connector runs on your computer and carries audio and video between FaceTime and a LiveKit room. It starts the connection without requiring you to build or host your agent through Chert.

> [!NOTE]
> For managed outbound calling, incoming call monitoring and acceptance, and media bridging through an API, use [Chert's managed FaceTime service](https://trychert.com/facetime).

## Demo

Watch a LiveKit agent connect to FaceTime through the Chert CLI.

https://github.com/user-attachments/assets/1fde265d-5e53-4d98-be87-b64ea07eeeff

## How to use

**Before you start:** you need Node.js 22.22+, Google Chrome, a running LiveKit agent, and an iPhone to create a FaceTime link and admit the browser guest. For video, your agent must publish a video track as well as audio. Keep your computer running during the call.

The intended flow is:

1. Run or deploy your own LiveKit agent.
2. Have that agent join a LiveKit room.
3. Give the connector access to the same room and identify the agent participant.
4. Join the FaceTime link in Chrome and admit the browser guest on your iPhone.
5. Talk to your agent through FaceTime.

Your model keys stay with your agent. The connector only needs a short-lived room token. You do not need our optional starter agent or its OpenAI setup to bring your own.

### CLI: run it from your terminal

```sh
npx @trychert/facetime-opensource
```

Enter these details when prompted:

```text
LiveKit server URL: wss://your-project.livekit.cloud
Room token: [hidden]
Agent participant identity: your-agent
FaceTime link: [hidden]
```

The token must allow joining, publishing, and subscribing to the agent's room, expire within one hour, and use a different participant identity from the agent. Use the agent's exact room participant identity, not its deployment name.

Chrome opens automatically. Click **Join**, admit the guest on your iPhone, then press **Enter** in the terminal to connect LiveKit. Press **Enter**, **Ctrl+C**, or **Stop test** to stop the connector. Your independently hosted agent's lifecycle stays under your control.

### SDK: use it in your code

```sh
npm install @trychert/facetime-opensource
```

In a Node.js `.mjs` file, load the connection details from your private environment configuration:

```js
import { FaceTimeGuest } from '@trychert/facetime-opensource';
import { createInterface } from 'node:readline/promises';

const terminal = createInterface({ input: process.stdin, output: process.stdout });
let guest;
try {
  guest = await FaceTimeGuest.open({
    faceTimeLink: process.env.FACETIME_LINK,
    livekitUrl: process.env.LIVEKIT_URL,
    roomToken: process.env.LIVEKIT_ROOM_TOKEN,
    agentIdentity: 'your-agent',
  });
  await terminal.question('Join in Chrome and admit on your iPhone, then press Enter.');
  await guest.connect();
  terminal.close();
  await guest.closed; // Click Stop test in Chrome when finished.
} finally {
  terminal.close();
  await guest?.close();
}
```

The SDK opens Chrome on your computer. Call `connect()` after admission and `close()` to stop. Keep real tokens and FaceTime links out of committed code. Installing the package alone does not start the connector or your agent.

## How this works

The connector has **four core files**:

| File | Simple explanation |
| --- | --- |
| `src/sdk.mjs` | **Starts and stops the browser setup.** Opens the FaceTime tab and local connector tab. |
| `src/media.mjs` | **Supplies the agent's video and speech** instead of your webcam and microphone, and receives the caller's audio. |
| `src/hop.mjs` | **Connects the two tabs.** Carries media between them because FaceTime blocks direct LiveKit connections. |
| `src/livekit.mjs` | **Connects to the agent's room.** Sends caller audio into LiveKit and receives the agent's speech and video. |

Your voice travels from FaceTime through the connector to your agent's LiveKit room. The agent's speech and video travel back along the same path. The CLI is a terminal interface to this same SDK. Your agent runs separately.

**Status:** experimental, with a successful live conversation on the tested Mac. The updated local CLI passed a supervised FaceTime call with agent audio and video, alongside offline SDK and media checks. Longer-call reliability, other platforms, and other agents remain unverified. This is an unofficial project, not an Apple-supported integration.

See the [detailed guide](docs/GUIDE.md) for the optional starter agent, configuration, tests, and development background. Licensed under [Apache-2.0](LICENSE).

---

Built by Chert Technologies Inc.
