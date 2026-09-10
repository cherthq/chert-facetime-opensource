# Chert FaceTime Guest

Put your AI agent on FaceTime, with a voice and a moving avatar.

The idea is simple: a browser joins your FaceTime link as a guest. Instead of sending your laptop's microphone and webcam, it sends your agent's speech and avatar. Your voice travels back to the agent so you can have a conversation from your iPhone.

**Status: synthetic-media spike.** The ordinary Chrome guest joined successfully on the available Mac. Generated video and speech plus an incoming-audio meter are implemented and pass a local WebRTC check. In the first live Mac test, the user confirmed moving video and clear generated speech on the iPhone. The receive-audio meter responded, and Stop closed Chrome and removed its temporary profile. Caller-speech intelligibility at the adapter still needs a separate check. LiveKit and the agent connection are not built yet. This is an unofficial project, not an Apple-supported integration.

## Run the first check

With Node 20+ and Google Chrome installed:

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
