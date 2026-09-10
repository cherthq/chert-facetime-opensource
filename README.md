# Chert FaceTime Guest

Put your AI agent on FaceTime, with a voice and a moving avatar.

The idea is simple: a browser joins your FaceTime link as a guest. Instead of sending your laptop's microphone and webcam, it sends your agent's speech and avatar. Your voice travels back to the agent so you can have a conversation from your iPhone.

**Status: synthetic-media spike.** The ordinary Chrome guest joined successfully on the available Mac. Generated video and speech plus an incoming-audio meter are implemented and pass a local WebRTC check. In the first live Mac test, the user confirmed moving video and clear generated speech on the iPhone. The receive-audio meter responded, and Stop closed Chrome and removed its temporary profile. Caller-speech intelligibility at the adapter still needs a separate check. The standalone LiveKit test participant connected successfully, but FaceTime’s Content Security Policy blocks the direct-in-tab LiveKit connection. The implementation now uses a separate local connector and WebRTC hop; local tests pass and the hop connects to the actual FaceTime page. In a supervised live test, the user confirmed video and speech on the iPhone and caller speech returning to the LiveKit test participant. Both test sessions stopped successfully. One disconnection required a manual rejoin; reliability is not established. The AI agent is not built yet. This is an unofficial project, not an Apple-supported integration.

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

## What you would build

Build a realtime agent for your hackathon idea: a character, tutor, coach, or something else. You control its instructions, model, voice, tools, and avatar in **your agent backend**.

This project would provide the connector that lets people talk to that agent through FaceTime. You wouldn't need to build the FaceTime connection yourself.

## How you would use it

1. **Set up your agent.** Start from the planned example, customize it, and run it locally or on a server. It connects to your LiveKit Cloud project or self-hosted LiveKit server.
2. **Point the launcher at your backend.** Your backend provides a short-lived session credential and identifies the agent's audio and video. Your model API keys stay on your backend.
3. **Create a FaceTime link on your iPhone.** Paste the link into the local launcher.
4. **Join and admit.** The launcher opens a dedicated Chrome session on your laptop. Click Join, then admit the guest on your iPhone.
5. **Talk to your agent.** You hear its replies and see its moving avatar. Keep the laptop and browser running. Press Stop when finished.

An optional Chert-hosted agent would let you try the experience without deploying an agent backend. The developer-owned example is intended to work without a Chert account.

These are the intended steps, not installation instructions for an existing release.

## How the pieces fit

```text
Your iPhone ↔ Browser guest + connector ↔ LiveKit room ↔ Your AI agent
                 on your laptop                         local or hosted
```

- **The connector** joins FaceTime and carries audio and video between the call and LiveKit.
- **LiveKit** hosts the room that transports the media. It does not supply the agent's intelligence.
- **Your agent** is a separate process that listens and responds. Its backend provides the connector with access to a session.

Think of it as: **build a LiveKit agent, then give it a way onto FaceTime.** The planned example will show the small session interface needed to connect the two.

## What's next

Prove generated speech, moving video, caller audio, and reliable Stop behavior in a real browser call. Then build the agent example and easy setup flow. The goal is roughly ten minutes after prerequisites, without OBS, physical audio loopback, or a dedicated native Mac worker.

See [PLAN.md](PLAN.md) for the Mac-first spike and the next steps if it works.
