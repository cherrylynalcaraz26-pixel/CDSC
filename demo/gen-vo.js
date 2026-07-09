/**
 * Generates the narration clips for the demo voiceover (free local piper VITS
 * voice bundled in the terran-adjutant-tts npm package) and writes their
 * durations to vo/durations.json.
 */
const PiperTTS = require('terran-adjutant-tts')
const fs = require('fs')
const path = require('path')

const LINES = {
  intro: 'Welcome to the CDSC Client Portal — the easiest way to order industrial supplies from CDSC, and track everything in one place.',
  login: 'Sign in securely with your client account.',
  dashboard: 'Your dashboard gives you a live overview — orders in progress, quotations, total spending, and stock alerts, all at a glance.',
  notifications: 'Notifications keep you posted on deliveries and low stock.',
  quotations: 'Review quotations from CDSC, inspect the line items, and respond online.',
  accept: 'Accept a quotation with a single click.',
  orders: 'Track every order — live status, items, and delivery records.',
  catalog: 'Browse the full CDSC catalog, search for products, and add items to a new order.',
  stock: 'My Stock tracks your on-hand inventory, and warns you before anything runs out.',
  account: 'Manage your account — company profile, logo, and your departments.',
  messages: 'And if you need anything, message the CDSC team directly, right from your portal.',
  outro: 'The CDSC Client Portal. Order smarter. Track everything.',
}

async function main() {
  const dir = path.join(__dirname, 'vo')
  fs.mkdirSync(dir, { recursive: true })
  const tts = new PiperTTS({ outputDir: dir })
  const durations = {}
  for (const [key, text] of Object.entries(LINES)) {
    const out = path.join(dir, key + '.wav')
    await tts.processStreamWithAudio(text, out)
    const buf = fs.readFileSync(out)
    // WAV: locate data chunk size; assume PCM s16 mono 22050 from this model
    const dataLen = buf.length - 44
    durations[key] = +(dataLen / (22050 * 2)).toFixed(2)
    console.log(key.padEnd(14), durations[key] + 's')
  }
  fs.writeFileSync(path.join(dir, 'durations.json'), JSON.stringify(durations, null, 2))
}
main().catch(e => { console.error(e); process.exit(1) })
