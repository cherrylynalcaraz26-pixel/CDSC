# CDSC Client Portal — Demo Video

`cdsc-client-portal-demo.mp4` (1600×900, ~1m47s, narrated) is a scripted
walkthrough of the Client Portal: sign-in → dashboard → notifications →
quotations (accept flow) → my orders → browse catalog → my stock → account
settings → messaging.

The recording is fully self-contained and free to regenerate — no Supabase
project, paid service, or real client data is used. A tiny Node mock of the
Supabase API (`mock-supabase.js`) serves fictional demo data for a made-up
client ("Northpoint Manufacturing Inc."), and Playwright drives Chromium with
its built-in screen recorder (`record-demo.js`).

## Regenerating the video

```bash
# 1. mock backend (auth + PostgREST on :54321)
node demo/mock-supabase.js &

# 2. app pointed at the mock
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6ImRlbW8ifQ.ZmFrZQ \
npm run dev &

# 3. record (drives Chromium; set executablePath in the script). Writes the
#    .webm plus timeline.json with the ms offset of each narrated section.
npm i --no-save playwright-core @ffmpeg-installer/ffmpeg
node demo/record-demo.js

# 4. voiceover clips — Kokoro-82M neural TTS, fully offline & free. The model
#    and voices ship inside the expo-kokoro npm package; phonemization uses
#    the espeak-ng WASM in the `phonemizer` package. Extract the model first:
ONNXRUNTIME_NODE_INSTALL_CUDA=skip npm i --no-save onnxruntime-node phonemizer
npm pack expo-kokoro && mkdir -p kokoro-extract && tar xzf expo-kokoro-*.tgz -C kokoro-extract
node demo/gen-vo-kokoro.js   # writes vo-kokoro/*.wav, auto-fits clips to slots

# 5. place narration at the timeline offsets and encode the final mp4
node demo/mix-vo.js
```

Demo sign-in used by the script: `maria.santos@northpointmfg.ph` /
`demo-portal-2026` (only exists inside the mock server).

Tip: run `record-demo.js` twice — the first pass warms Turbopack's on-demand
compilation; restart `mock-supabase.js` before the final take so the seeded
data (pending quotations, chat history) is pristine.
