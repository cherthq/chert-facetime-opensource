# Chert FaceTime Guest — smallest useful spike

## Goal

On the Mac we already have, prove that a visible Chrome tab can join a FaceTime link as a guest, send generated video and canned speech, and receive the caller's audio digitally.

This replaces the longer implementation roadmap. **First live result — September 10, 2026:** the Chrome guest joined on the Mac, and the user confirmed seeing the animated face and hearing the generated phrase on the iPhone. Incoming audio tracks and a nonzero receive meter were observed; caller-speech intelligibility at the adapter has not been separately confirmed. Clicking Stop closed the guest browser, exited the launcher successfully, and removed its temporary profile. The local WebRTC test also passed media teardown. This is one successful supervised trial, not a reliability claim. No LiveKit connection is built yet.

## What we need

- The existing Mac with Chrome. No waiting for a Windows machine.
- An iPhone with FaceTime and a human to create a link, admit the guest, speak, and check what arrives.
- One tiny launcher, one injected script, an animated canvas, and a short spoken audio fixture.

No LiveKit account or agent is needed for the first experiment. Mac browser guest support and FaceTime's acceptance of generated tracks are still unknown.

## First build: one tab, one call

1. **Check the browser guest path on this Mac.** Open a fresh visible Chrome session with a user-created FaceTime link. Find out whether it offers a usable browser guest flow. If it only opens the native app or cannot join, stop and report that result before building more.
2. **Install the media hook before the FaceTime page starts.** Use a small Playwright launcher and one init script. Intercept camera/microphone requests and supply an animated canvas plus canned speech as media tracks. Observe incoming FaceTime WebRTC audio tracks. Never silently fall back to the laptop's real microphone or webcam.
3. **Try everything in one call.** The human clicks Join and admits the guest on the iPhone. Check that the iPhone sees the moving canvas and hears the spoken fixture. Speak from the iPhone and verify that its audio reaches the adapter: show an audio level and briefly listen through headphones to confirm intelligible speech. Keep the laptop microphone out of this path; do not record the call.
4. **Press Stop.** Stop all generated and received track handles, audio contexts, and animation loops; close the owned browser session. Confirm the guest leaves, playback ends, and the launcher exits.

Keep media inside the browser. Do not shuttle audio samples or video frames through Playwright calls. Manual Join, admission, and audio-enable clicks are fine.

## What counts as success

One supervised call demonstrates all four:

- The iPhone sees continuously changing generated video.
- The iPhone hears intelligible canned speech while the video moves.
- The adapter receives intelligible caller audio digitally, without capturing the laptop microphone or using physical audio loopback.
- Stop ends media and closes the browser resources created by the launcher.

A local preview or a connected WebRTC status alone is not enough. If something fails, identify the first failing step and make the smallest change that tests it. No formal experiment report is needed: a short result and any blocker are enough. One successful call proves initial feasibility, not reliability.

## If that works: LiveKit in the same tab

Add the LiveKit JS client directly to the FaceTime tab. **No separate connector page or local WebRTC hop.**

```text
First spike:
iPhone ↔ FaceTime Chrome tab ↔ generated video/speech + caller audio check

Next step:
iPhone ↔ FaceTime Chrome tab + LiveKit client ↔ test LiveKit room
```

Use one throwaway room URL and a short-lived, room-scoped token in an untracked local config. Fixed values are fine for this prototype; no session endpoint or contract abstraction. Keep tokens out of committed source, command arguments, and logs. Never use a LiveKit API secret or model API key in the tab.

The FaceTime page shares the injected script's environment, so treat its room token as exposed to that page. Accept this limited prototype tradeoff and revisit isolation before a public release.

Publish caller audio into the room and feed selected room audio/video into FaceTime's generated tracks. Use a controlled test participant to verify both directions and avoid feeding the connector's own output back into its input. Stop must also disconnect the LiveKit client; manually end the disposable test room afterward.

**Only then add a real agent.** First prove the browser media path, then the room connection, then the conversation.

## Keep out of this spike

No Windows prerequisite, cross-platform matrix, agent backend, hosted integration, session-contract framework, separate media hop, polished UI, deadline tuning, ten-cycle leak study, formal evidence package, or fresh-user study. No native worker, OBS, production integration, or publication.

Build only enough to answer the media question. Packaging, stronger credential isolation, automated failure recovery, licensing, and release testing belong to later work if the spike succeeds.

## Research context

The earlier research read all 60 tracked Markdown files from verified remote main of the existing Chert repository at `b0ce709d0eea7447595636fcd268ebec3759dd47`, without changing its checkout. The existing native bridge informs this work but does not prove browser injection or Mac browser guest support.

Implementation references: [Apple guest flow](https://support.apple.com/en-ca/109364), [Playwright early scripts](https://playwright.dev/docs/api/class-browsercontext#browser-context-add-init-script), [generated audio](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaStreamDestination), [canvas video](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream), and [incoming audio tracks](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/track_event).
