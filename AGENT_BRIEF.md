# Chert FaceTime Guest — agent handoff

## Your assignment

Work in `/Users/garygao/chert-facetime-opensource`.

First understand the existing Chert FaceTime project and the OSS discussion summarized below. Then write a concrete implementation plan to `PLAN.md` in this directory. This assignment is research and planning only: do not implement the bridge, launch calls, change production, publish a repository, or install infrastructure yet.

## Read the existing project

Source repository: https://github.com/garygao333/chert-facetime/tree/main

Local Git repository: `/Users/garygao/chert-facetime`.

Important: on September 10, 2026, this local working tree was on the older `codex/phase-0` branch. Its checked-out files are NOT the complete current project. The local `origin/main` and remote `main` both resolved to `b0ce709d0eea7447595636fcd268ebec3759dd47` when this brief was written. Verify the current remote revision when you begin. Use Git object reads, or an isolated read-only source snapshot, rather than switching or modifying the existing working tree. A fetch to refresh the remote-tracking branch is fine if needed. Record the exact source revision you reviewed.

The user explicitly requests that you read ALL tracked Markdown files on the current main branch so you understand the whole picture. Start with root `AGENTS.md`, then `README.md`, `docs/CONTEXT.md`, and `docs/INDEX.md`. Read nested agent guidance, architecture, contracts, configuration, operations, plans, package READMEs, evidence, recovery records, and archived Markdown. Include `.md` and `.markdown` files, case-insensitively. Inventory the files first; split long documents into manageable reads so truncation does not silently omit content. This explicit full-context assignment includes the historical debugging log, despite the ordinary-work recommendation to read it only selectively. Avoid dependency directories, build output, ignored worktrees, and untracked private files.

Respect the documented source-of-truth order: current executable source and migrations, focused tests, canonical documentation, runbooks, evidence, then proposals/history. Reading an old plan does not make it current. Inspect relevant code/tests to resolve contradictions; distinguish implementation, observed production acceptance, and design intent. Report inaccessible or omitted files rather than claiming complete coverage.

Do not read or copy `.env.local`, worker enrollment state, credentials, raw customer logs, or other private operational files. Do not copy the private project wholesale into this future OSS repository. Keep this project's plan free of private identities, customer details, endpoints, tokens, and production configuration.

## Business context and goals

Chert is a two-founder company building deployment infrastructure for realtime AI video agents on native communication channels, beginning with FaceTime. The longer-term positioning is similar to a Vapi for video/multimodal agents. Current customer use cases include companions/characters and coaching.

Chert wants a genuinely useful open-source project for hackathons and individual developers: something they can run, customize, and demonstrate without being allocated a dedicated Chert line or spending hours provisioning a Mac. The founders can provide hosted video agents; that part is more scalable than assigning Apple devices and dedicated identities to every builder.

The company previously experienced commoditization in managed iMessage infrastructure. Its preferred OSS boundary is a small starter/developer-experience layer and commodity integrations, while retaining native device control, fleet operations, dedicated lines, production recovery, and differentiated orchestration. The claimed orchestration moat is a strategic hypothesis, not a proven fact. A small browser adapter could also become competitively important if it works well; do not assume small code means negligible moat risk.

We considered a manually operated edition of the current native bridge. The user rejected it because it still exposes too much of the existing system and requires native media setup. The selected idea must use a materially different principle: a browser guest in a FaceTime link-based call.

The user also likes a separate hosted sandbox where builders reserve short slots on shared demo lines. That is a viable complementary product idea, but it is not this project's main implementation. An OSS SDK that only calls a hosted service is different from an independently runnable OSS connector.

## Selected proposal: Chert FaceTime Guest

Working name only. Build a small open-source launcher and browser media adapter that joins a user-created FaceTime link and connects that guest to a video agent.

Proposed user flow:

1. Configure an agent, initially using one Chert-hosted example or a developer-owned compatible agent.
2. Create a FaceTime link on an iPhone and transfer it to the computer.
3. Run the local launcher and provide the link and a short-lived agent session credential.
4. The launcher opens a dedicated browser session with the adapter loaded.
5. The human clicks Join and admits the guest from the iPhone.
6. The iPhone receives the agent's speech and moving avatar; the caller's speech returns to the agent.
7. End the call or press Stop; browser media and agent session resources are cleaned up.

The browser stays running on the developer's computer. The model and avatar may run on Chert's infrastructure, so no local model deployment is required. The intended setup target is about ten minutes after prerequisites; this is a target to measure, not a demonstrated claim.

The initial product does not need automatic dialing, native incoming-call detection, automatic admission, dedicated identities, group-call management, or unattended operation. Manual clicks and supervision are acceptable. It must still support a useful real conversation and deterministic cleanup.

## Core technical hypothesis — not yet validated

Apple supports normal browser guests joining FaceTime links on Windows/Android using supported browsers and host admission. This does NOT establish an official API for AI media injection, support on Mac browsers, support in headless/Linux hosting, or compatibility with our adapter.

Hypothesis: load a script before FaceTime's webpage initializes, intercept its microphone/camera requests (`getUserMedia`), and supply generated agent audio/video tracks instead. Observe incoming WebRTC tracks and forward caller audio to the agent. Browser automation handles launch and optional join controls; realtime media should use a media transport, not frame-by-frame automation RPC calls.

Possible primitives:

- Playwright initialization scripts before page code runs.
- Web Audio output as a `MediaStream` for agent speech.
- Canvas video capture, or suitable existing video tracks, for avatar output.
- WebRTC incoming track observation for caller audio.
- One agent connector, with LiveKit as an initial candidate given the existing stack.

These APIs exist, but their composition with FaceTime is unproven. The implementation may encounter device enumeration and constraints, initialization timing, frames/realms, codec availability, autoplay/user-gesture requirements, page restrictions, media renegotiation, or web-client changes. Inspect actual behavior; do not present a speculative hook as a supported FaceTime API. Do not propose defeating admission, authentication, or access controls.

Start with visible Chrome on Windows as the documented desktop baseline. Test Mac browser feasibility early because MacBooks matter to adoption. A Windows-only result could be technically successful but a poor fit for the audience; make that a product decision gate. Hosted/headless/Linux operation is separate research, not an MVP assumption.

The intended bridge is entirely digital: iPhone FaceTime ↔ browser guest ↔ adapter ↔ hosted/developer-owned agent. Success would remove OBS, physical audio loopback, and Mac Accessibility from this path.

## Relevant existing-system context to verify

The existing project includes a Swift native worker, web control plane, managed-agent package, media adapters, and fleet operations. Current canonical material reviewed in the prior discussion described accepted two-way BYOR audio using a physical acoustic route. Dynamic BYOR video was not accepted end to end, and caller-video publication was outside that production profile. Verify against the source revision you read rather than carrying these observations forward as permanent facts.

Do not import the native worker or control plane into this project just to make the prototype work. Existing code may inform agent-transport contracts and failure handling, but dependencies should remain narrow and reviewable.

## OSS scope

Potential public components: launcher, browser adapter, agent media interface, one connector, synthetic audio/video fixtures, setup checks, diagnostics, examples, and documentation.

The tool should permit a developer-owned agent through a documented interface. Chert-hosted agents can be the easiest default. Keep native worker/device control, fleet management, dedicated-line scheduling, production recovery, and private agent infrastructure outside this repository.

No provider master keys in the FaceTime page, command-line arguments, URLs, or logs. Plan explicit credential boundaries: injected page scripts share an environment with third-party code, so any required call-scoped material must be narrowly scoped and short-lived. No recordings by default; use counters and levels for diagnostics. Handle loop prevention, resource ownership, session expiry, and terminal cleanup deliberately.

## What PLAN.md must contain

1. A simple product summary, intended users, non-goals, and the precise OSS/managed boundary.
2. The theoretical developer walkthrough and where each component runs.
3. A reviewed-source summary with exact revision, Markdown coverage, and relevant contradictions.
4. Verified browser capabilities versus FaceTime-specific hypotheses, with current primary-source references.
5. A minimal architecture and proposed repository structure; explain each component's purpose.
6. A feasibility-first implementation sequence with concrete tests and go/no-go criteria:
   - ordinary manual browser guest joins;
   - generated moving video reaches iPhone;
   - generated speech reaches iPhone;
   - caller audio returns digitally;
   - simultaneous media avoids self-feedback;
   - termination stops all media;
   - early Mac compatibility assessment;
   - one real hosted agent conversation;
   - launcher/diagnostics packaging and fresh-user setup test.
7. Testing strategy separating synthetic browser fixtures from supervised real FaceTime acceptance. Include repeat calls, denied admission, invalid/expired links, agent disconnects, browser closure, and cleanup.
8. Technical and product risks, fallback options, and explicit stop conditions. Do not silently replace the selected approach with the native worker or OBS.
9. Prerequisites and user actions needed for real testing: Apple-device host, FaceTime link, supported test computer/browser, and agent session access. Inventory available resources before assuming Windows access exists.
10. Public-release criteria: independently useful example, tested platform matrix, dependency/license review, secrets review, explicit OSS license choice, unofficial-project wording, honest demo, and clear limitations. Publication happens after implementation and acceptance, not during this planning assignment.
11. A concrete first engineering task that proves the hardest assumptions with the least code. Use evidence-based effort estimates only; identify uncertainty instead of promising delivery dates.

Write a plan specific enough for another agent to execute. Do not build a large framework before the basic browser media experiment works. Finish by linking PLAN.md and summarizing the recommendation, unresolved feasibility questions, and first implementation step.

## Starting references

- Apple browser guest flow: https://support.apple.com/en-ca/109364
- Apple FaceTime link creation: https://support.apple.com/en-gb/guide/iphone/iphfc9b58aaa/ios
- Playwright early scripts: https://playwright.dev/docs/api/class-browsercontext#browser-context-add-init-script
- Web Audio generated stream: https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaStreamDestination
- Canvas video stream: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream
- Incoming WebRTC tracks: https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/track_event

These establish general capabilities only. Recheck current documentation and independently verify FaceTime behavior during implementation.
