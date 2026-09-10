# Chert FaceTime Guest

Put your AI agent on FaceTime, with a voice and a moving avatar.

The idea is simple: a browser joins your FaceTime link as a guest. Instead of sending your laptop's microphone and webcam, it sends your agent's speech and avatar. Your voice travels back to the agent so you can have a conversation from your iPhone.

## Your agent and our connector are separate

**We are not hosting your agent for you.** There are two separate pieces:

- **Your agent:** its code, personality, voice, model, and avatar. You run it locally or deploy it yourself, including through LiveKit.
- **Our connector:** runs on your laptop and carries audio/video between FaceTime and a LiveKit room. The CLI starts this connection; it does not require you to build your agent through our tool.

LiveKit hosts the room that carries the media. Your agent is a separate process that connects to that room and decides what to say.

```text
Your iPhone ↔ Browser guest + connector ↔ LiveKit room ↔ Your AI agent
                 on your laptop                      local or deployed
```

We include a starter agent so you can try the whole experience. [examples/agent.json](examples/agent.json) only customizes **that starter**. If you already build LiveKit agents, keep your own agent code and configure it however you normally do.

## CLI or SDK: use your existing agent

**Version 0.1.0 is published as [@trychert/facetime-opensource](https://www.npmjs.com/package/@trychert/facetime-opensource)**, licensed under [Apache-2.0](LICENSE). You can use the connector without cloning this repository or manually editing configuration files.

**Same package, two ways to use it:**

- **CLI (`npx`):** run the connector directly in your terminal and answer its prompts. No coding needed.
- **SDK (`npm install`):** add the connector to your JavaScript project. Your code controls when it opens, connects, and stops. Installing it alone starts nothing.

Both run on your computer and open Chrome. Your LiveKit agent runs separately; **we only connect it to FaceTime**. Neither option hosts or starts your agent, automatically dials someone, or bypasses human admission.

You need **Node 22.22+, installed Google Chrome, an iPhone, and your own running LiveKit agent**. The browser path has been tested on macOS; other platforms are unverified. Keep your laptop running during the call.

### 1. CLI: the easiest setup

Run:

```sh
npx @trychert/facetime-opensource
```

It asks for:

```text
LiveKit server URL:
Room token: [hidden]
Agent participant identity:
FaceTime link: [hidden]
```

Then it opens Chrome and guides you through joining, admission, and connecting:

1. Run or deploy your agent and have it join a LiveKit room. Your existing backend handles agent dispatch if needed.
2. Run the command. Enter your LiveKit WebSocket URL, a short-lived connector participant token, and your agent's **participant identity**. This identity is not an agent deployment name.
3. Create a FaceTime link on your iPhone and paste it at the hidden prompt.
4. Click **Join** in the Chrome window and admit the browser guest on your iPhone.
5. Return to the terminal and press **Enter** to connect LiveKit. Talk to your agent through FaceTime.
6. Press **Enter**, **Ctrl+C**, or **Stop test** to close the connector. Your independently hosted agent remains under your control.

Give the connector a different participant identity from the agent, in the **same room**. Its token must explicitly allow room join, publishing, and subscribing, and expire within one hour. The agent should consume `facetime-caller` audio and publish its speech and, optionally, avatar video. Without avatar video, the waiting graphic remains. Compatibility with arbitrary third-party agents still needs testing.

The prompts hide the token and FaceTime link; the CLI does not save them. You can also supply an existing JSON file with `url`, `token`, and `targetIdentity` using `--config ./livekit.json`. Keep that file private and out of Git. Do not pass tokens or FaceTime links as command arguments.

**Use it from this checkout now:**

```sh
nvm use
npm ci
npm run build
npm run cli
# Or reuse the local token helper's configuration:
npm run cli -- --config .local/livekit.json
```

Choose one launch command. Our repository's `npm run tokens` creates tokens for the starter/test participant; bring your own matching room token when using an existing agent.

### 2. SDK: integrate it into your code

Install it in your Node project:

```sh
npm install @trychert/facetime-opensource
```

Save this as an `.mjs` file. Supply the three credentials/link values from your application's private configuration; never put real values in committed source.

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
    agentIdentity: 'my-agent', // Exact participant identity in your room.
  });
  await terminal.question('Join in Chrome and admit on your iPhone, then press Enter.');
  await guest.connect();
  terminal.close();
  await guest.closed; // Click Stop test or close the browser when finished.
} finally {
  terminal.close();
  await guest?.close();
}
```

`open()` prepares the browser and media link; `connect()` joins LiveKit after human admission. `status()` reports connection/publication state, and `close()` shuts down the owned browser and removes its temporary profile. Pass an `AbortSignal` to `open()` to connect cancellation to your application. Importing the SDK alone starts nothing. TypeScript declarations are included; the package uses ESM.

The package bundles the browser LiveKit client and depends on `playwright-core` to operate your installed Chrome. It does not install Chrome, host an agent, or include the optional OpenAI starter and speech fixtures. The new packaged entry points passed offline browser and clean-install checks; their full FaceTime flow still needs a supervised call.

## How this works

The connector has **four core files**:

| File | Simple explanation |
| --- | --- |
| `src/sdk.mjs` | **Starts and stops everything in the browser.** Opens the FaceTime tab and the local connector tab. |
| `src/media.mjs` | **Supplies the agent’s video and speech instead of your webcam and microphone**, and receives the caller’s audio. |
| `src/hop.mjs` | **Connects the two tabs.** Carries media between FaceTime and the local connector because FaceTime blocks direct LiveKit connections. |
| `src/livekit.mjs` | **Connects to the agent’s room.** Sends caller audio into LiveKit and receives the agent’s speech and video. |

When you speak, the audio travels like this:

```text
You on your iPhone
       ↓
FaceTime tab                 media.mjs
       ↓
Local connector tab          hop.mjs
       ↓
LiveKit room                 livekit.mjs
       ↓
Your agent
```

The agent’s speech and video travel back along the same path.

`sdk.mjs` opens this setup and closes it when you press Stop. `cli.mjs` gives it a terminal interface. `scripts/build.mjs` packages the browser LiveKit code for npm. The older `launch.mjs` and `bundle.mjs` remain for the repository’s starter and diagnostic commands.

**The agent is separate.** Our optional `examples/agent.mjs` listens and answers using OpenAI, while `examples/avatar.mjs` draws its moving face. An experienced developer can supply their own agent instead.

The other files help with credentials, configuration, documentation, and checking that these core pieces work.

## Already have a LiveKit agent?

The intended flow is:

1. Run or deploy your own LiveKit agent.
2. Have that agent join a room.
3. Give our connector access to the same room and identify the agent participant.
4. Join the FaceTime link in Chrome and admit the browser guest on your iPhone.
5. Talk to your agent through FaceTime.

You do not need our starter agent or its OpenAI setup if you bring your own. Your model keys stay with your agent. The connector needs a short-lived room token, not your model API keys.

**Current limitation:** we have tested the included starter. Other agents still need compatibility checks, especially for audio/video publications, participant selection, and dispatch into the correct room. The connector does not deploy or dispatch your agent, or automatically shut down an independently hosted agent; your backend owns that lifecycle.

## Try the included starter today

1. **Download the project** and install its dependencies with `npm ci`. You need Node 22.22+, Chrome, a LiveKit project, an OpenAI API key, and an iPhone with FaceTime.
2. **Add your credentials:** run `npm run tokens` for LiveKit, then `npm run agent:setup` for OpenAI. Enter credentials at the local prompts.
3. **Customize the starter:** edit [examples/agent.json](examples/agent.json) to change its personality, voice, and model.
4. **Start the agent:** run `npm run agent`.
5. **Start the browser connector:** in another terminal, run `npm run livekit` and paste a FaceTime link created on your iPhone.
6. **Join and admit:** click **Join** in Chrome, then admit the guest on your iPhone.
7. **Connect and talk:** click **Connect LiveKit** in the local connector tab. The starter agent greets you on FaceTime with a moving face.
8. **Finish:** click **Stop test**. The browser and included starter agent shut down.

Your laptop stays running throughout. A planned improvement is to combine the starter's agent and connector launch into one command; bringing your own agent will remain a separate option.

**Status: working prototype on the tested Mac.** Video, two-way conversation, interruptions, and clean shutdown passed a supervised test. One earlier disconnection required a manual rejoin; reliability and other platforms are not established. This is an unofficial project, not an Apple-supported integration.

The sections below cover individual checks and more detailed setup.

## Run the first check

With Node 22.22+ and Google Chrome installed (run `nvm use` if you use nvm):

```sh
npm ci
npm start
```

Paste a fresh FaceTime link at the hidden terminal prompt. Check whether Chrome offers a browser guest flow. Join and iPhone admission are manual. This baseline uses ordinary camera/microphone permission prompts; it does **not** inject fake media yet. Press Enter in the terminal after opening the link, press Ctrl+C, or close the Chrome window to stop.

`npm run smoke` checks that a fresh visible Chrome window opens and closes without contacting FaceTime. Launch and cleanup passed on this Mac with Chrome 152.0.7977.83, and the ordinary FaceTime guest joined successfully.

## Try synthetic media

Run `npm run synthetic`, paste your FaceTime link at the hidden prompt, and continue as a browser guest. The preview should show the animated Chert face, with no real camera or microphone capture. Click **Join** and admit the guest on the iPhone.

In the small Chert panel, click **Enable audio**, then **Send test speech**. Confirm that the iPhone sees the moving face and hears the phrase. Speak from the iPhone and check that **Caller tracks** and **level** respond. Use headphones for normal FaceTime playback. Click **Stop test** to end the test and close this Chrome session.

`npm test` verifies generated audio/video through a local WebRTC connection, received video motion, the incoming-audio meter, and media teardown. It does not place a FaceTime call. This first hook uses fixed media settings and is not a general camera-device emulator.

## Test the LiveKit connection

**Current approach:** FaceTime blocks direct LiveKit signaling. The launcher now opens a local connector tab alongside the FaceTime tab and relays media through WebRTC. Room credentials stay in the connector tab. This route passed a supervised live test for video, speech in both directions, and Stop. One manual rejoin was needed after a disconnection.

Use your LiveKit project's **WebSocket URL**, **API key**, and **API secret** from the LiveKit Cloud dashboard. Run this in your own terminal:

```sh
nvm use
npm ci
npm run tokens
```

The helper asks for the project URL and hidden API credentials. It creates a unique disposable room name and two one-hour join tokens in ignored `.local/livekit.json` and `.local/peer.json`. It signs tokens locally; it does not save the API secret or provision an agent. The server checks the credentials when you connect. See [LiveKit token documentation](https://docs.livekit.io/frontends/reference/tokens-grants/).

Then use two terminals, with Node 22 selected in each:

1. Run `npm run peer`. In its browser window, click **Connect LiveKit**. This test participant publishes generated media and can play caller audio through headphones.
2. Run `npm run livekit`. Paste the FaceTime link, join in Chrome, and admit the guest on the iPhone. **After the iPhone admits the guest**, switch to the **Local LiveKit connector** tab and click **Connect LiveKit** there. A Leave button alone is not proof that admission finished.
3. In the **test participant** window, click **Send test speech**. Confirm the iPhone hears it and sees the **LIVEKIT TEST PEER** caption moving. The FaceTime tab's waiting graphic does not count as room video.
4. Speak from the iPhone. In the test participant, click **Listen to caller** if needed and confirm intelligible speech through headphones. There is no microphone capture in either test window.
5. Click **Stop test** in both windows. Confirm both participants leave the room. Check the LiveKit dashboard if either process crashes; token expiry alone does not disconnect an existing session.

The FaceTime tab publishes a mix of its incoming audio tracks as `facetime-caller`; this spike assumes one human caller. It accepts room output only from the configured test participant. Room media uses separate audio routes and bypasses the FaceTime peer observer to prevent feedback. No AI agent or recording is involved.

**Prototype credential boundary:** the room token runs only in the local connector page. The FaceTime page gets media and signaling, not that token. Use a disposable test room. Keep API secrets out of page scripts, command arguments, and committed files. For an existing token, use the same three fields as the generated config: `url`, `token`, and `targetIdentity`; tokens must expire within one hour and explicitly allow room join, publish, and subscribe.

## Talk to the agent

The first agent runs locally with OpenAI Realtime. Its model API key never enters Chrome. Conversation audio is sent to OpenAI; local recordings and transcript publication are disabled. Provider-side data handling is governed by your OpenAI account settings.

1. Run `npm run agent:setup` and enter your OpenAI API key at the hidden prompt. It is saved only in ignored `.local/openai.json`.
2. If the room tokens have expired, run `npm run tokens` again. The agent uses `.local/peer.json` in place of the test participant, so **do not run `npm run peer` at the same time**.
3. Run `npm run agent` in one terminal, then `npm run livekit` in another. Paste the FaceTime link, join in Chrome, and admit the guest on the iPhone.
4. After admission, click **Connect LiveKit** in the local connector tab. The agent starts its model session when the caller-audio track arrives, greets you, and accepts conversation and interruptions.
5. Stop the browser test to disconnect the connector and end the agent. You can also press Ctrl+C in the agent terminal. The agent has a ten-minute total test limit, including time waiting for the connector.

Edit [examples/agent.json](examples/agent.json) to change the prompt, voice, model, or test duration. The default is [gpt-realtime-1.5](https://developers.openai.com/api/docs/models/gpt-realtime-1.5) with the `marin` voice. The procedural face reacts to speaking state; it is not a lip-synced avatar. This example uses room-scoped credentials directly and does not require an agent deployment or dispatch service.

`npm run agent:check` initializes the SDK and native avatar frames without calling LiveKit or OpenAI. The first supervised conversation, interruption, and Stop check passed. This is prototype feasibility evidence, not a production reliability guarantee.

## Repository layout

| Folder | What belongs here |
| --- | --- |
| `src/` | The SDK, CLI, configuration checks, browser connector, and media routing. |
| `dist/` | Generated browser bundle and third-party license notices shipped with npm. |
| `examples/` | The optional starter agent, animated face, and `agent.json` settings. |
| `scripts/` | Credential setup helpers, package build, and clean-install verification. |
| `tests/` | Offline checks for media, room routing, the link between tabs, and SDK cleanup. |
| `assets/` | The canned speech fixture and its provenance. |
| `docs/` | The implementation plan, test results, and original project brief. |

Package files and Node/Git settings stay at the root. Credentials stay in ignored `.local/`; installed dependencies stay in ignored `node_modules/`. The `npm run` commands are unchanged.

## What's next

Complete a supervised call through the new CLI/SDK entry point, investigate the earlier disconnection, and test longer calls and recovery. Run `npm run check:package` to build and verify a clean installation without placing calls.

See [PLAN.md](docs/PLAN.md) for the implementation details and observed results.
