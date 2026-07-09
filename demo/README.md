# CDSC Client Portal — Demo Video

`cdsc-client-portal-demo.mp4` (1600×900, ~87s) is a scripted walkthrough of the
Client Portal: sign-in → dashboard → notifications → quotations (accept flow) →
my orders → browse catalog → my stock → messaging.

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

# 3. record (needs playwright-core + a Chromium; set executablePath in the script)
npm i --no-save playwright-core @ffmpeg-installer/ffmpeg
node demo/record-demo.js

# 4. convert the .webm Playwright produces to mp4
node -e "console.log(require('@ffmpeg-installer/ffmpeg').path)" # → FFMPEG
$FFMPEG -i video/*.webm -c:v libx264 -crf 23 -pix_fmt yuv420p -movflags +faststart cdsc-client-portal-demo.mp4
```

Demo sign-in used by the script: `maria.santos@northpointmfg.ph` /
`demo-portal-2026` (only exists inside the mock server).

Tip: run `record-demo.js` twice — the first pass warms Turbopack's on-demand
compilation; restart `mock-supabase.js` before the final take so the seeded
data (pending quotations, chat history) is pristine.
