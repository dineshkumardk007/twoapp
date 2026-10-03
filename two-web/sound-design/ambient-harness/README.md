# Ambient harness

Renders every ambient preset (`src/core/ambient/presets.ts`) offline in a
browser, measures it, and saves the audio - the level trims in `presets.ts`
come from here. Also has a live test that plays each preset in real time and
checks that stopping it stops everything, how long starting it held the
main thread, and what the buffer cache holds.

It runs on the app's own dev server, so textures render in the real worker:

```
# from two-web/
npm run dev                                                    # port 3000
node sound-design/ambient-harness/upload-server.mjs <folder>   # port 8960, only for saving .wav renders
```

Open http://localhost:3000/sound-design/ambient-harness/, then in the console:

- `await renderPreset('rain', 24, true)` - render 24 s offline, return loudness, upload the WAV
  (a fourth argument renders at another rate: `renderPreset('rain', 24, false, 44100)`)
- tap "wake audio", then `await liveTest('rain', 6)` - play live, stop, count anything started after the stop
- tap "wake audio at 44.1 kHz", then `await liveTest('rain', 6, 44100)` - the same on a 44.1 kHz context,
  which is what many phones and headsets run at
- open with `?noworker` to test the fallback for when a Web Worker cannot start: everything renders on the
  main thread, a piece at a time

Loudness targets at full volume: nature -20 dBFS RMS, sleep -21, music -19,
cosmic -21, soft landing -23, breathing drone -26.
