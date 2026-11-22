# Geed Hardwin AI Agent — session builder

## Session model

- The AI conversation and editor observations live only in the current page's JavaScript memory.
- Each new user request includes a fresh, bounded editor snapshot (scene, canvas size, timeline, selected layers and visible layer metadata).
- After each editor action, the browser reports the observed before/after state back to the agent.
- The page clears the in-memory conversation on `pagehide`. A reload or a new tab starts a new conversation.
- The AI panel does not read or write persistent AI-memory records.

## Current editor actions

- `inspect`: read a bounded editor snapshot.
- `buildScene`: create 1–12 rectangle, circle and text layers in one action. Every new layer receives start/end keyframes. Stage coordinates are 1280×720.
- `createCircle` and `animateCircle`: legacy single-circle operations.
- `play`, `stop`, and `setFrame`: control the timeline.
- `deleteSelected`: delete only the currently selected layers, after a separate browser confirmation.

All AI actions are constrained by server-side and browser-side allow-lists. No arbitrary JavaScript, shell or code execution is available to the agent.

## Current limitations

This is the first scene-building increment, not the completed production AI. The batch builder currently creates built-in vector rectangles, circles and text. It does not yet retrieve community-library images, add audio/voice/subtitles, or autonomously export a finished video. Video export remains a manual editor action.

## Runtime configuration

The live AI endpoint remains fail-closed until the deployment owner configures the Supabase server environment, provider credentials/model, account entitlements and quota. Provider credentials belong only in server-side environment settings; never commit them to Git or expose them in the browser. No provider or quota is enabled by this change.
