/**
 * Generates the demo narration with Kokoro-82M (natural human-sounding TTS),
 * fully offline: model + voices come bundled in the expo-kokoro npm package,
 * phonemization via the espeak-ng WASM in the `phonemizer` npm package.
 * Inference recipe mirrors kokoro-js.
 */
const ort = require('onnxruntime-node')
const { phonemize } = require('phonemizer')
const fs = require('fs')
const path = require('path')

const PKG = path.join(__dirname, 'kokoro-extract', 'package', 'build')
const MODEL = path.join(PKG, 'kokoro-quantized.onnx')
const VOICE = 'af_heart'
const SR = 24000

const tokenizerJSON = JSON.parse(fs.readFileSync(path.join(PKG, 'tokenizer.json'), 'utf8'))
const vocab = tokenizerJSON.model.vocab
const PAD_ID = vocab['$']

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

// available seconds for each clip, from timeline.json section gaps
const t = require('./timeline.json')
const order = Object.keys(LINES)
const SLOTS = {}
for (let i = 0; i < order.length; i++) {
  const start = t[order[i]]
  const end = i + 1 < order.length ? t[order[i + 1]] : t[order[i]] + 6400
  SLOTS[order[i]] = (end - start) / 1000
}

const PUNCT_RE = /(\s*[;:,.!?¡¿—…"«»“”(){}[\]]+\s*)+/g

// text -> IPA phoneme string (kokoro-js en-us recipe)
async function toPhonemes(text) {
  const sections = []
  let last = 0
  for (const m of text.matchAll(PUNCT_RE)) {
    if (last < m.index) sections.push({ punct: false, text: text.slice(last, m.index) })
    sections.push({ punct: true, text: m[0] })
    last = m.index + m[0].length
  }
  if (last < text.length) sections.push({ punct: false, text: text.slice(last) })
  const parts = await Promise.all(sections.map(async s =>
    s.punct ? s.text : (await phonemize(s.text, 'en-us')).join(' ')
  ))
  return parts.join('')
    .replace(/ʲ/g, 'j').replace(/r/g, 'ɹ').replace(/x/g, 'k').replace(/ɬ/g, 'l')
    .replace(/(?<=[a-zɹː])(?=hˈʌndɹɪd)/g, ' ')
    .replace(/ z(?=[;:,.!?¡¿—…"«»“” ]|$)/g, 'z')
    .trim()
}

function writeWav(file, f32) {
  const data = Buffer.alloc(f32.length * 2)
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]))
    data.writeInt16LE(Math.round(s * 32767), i * 2)
  }
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8)
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22)
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34)
  h.write('data', 36); h.writeUInt32LE(data.length, 40)
  fs.writeFileSync(file, Buffer.concat([h, data]))
}

async function main() {
  const dir = path.join(__dirname, 'vo-kokoro')
  fs.mkdirSync(dir, { recursive: true })
  const session = await ort.InferenceSession.create(MODEL)
  console.log('model inputs:', session.inputNames.join(', '))
  const voiceBuf = fs.readFileSync(path.join(PKG, 'voices', VOICE + '.bin'))
  const voice = new Float32Array(voiceBuf.buffer, voiceBuf.byteOffset, voiceBuf.length / 4)

  async function synth(text, speed) {
    const phonemes = await toPhonemes(text)
    const ids = [PAD_ID]
    for (const ch of phonemes) if (vocab[ch] !== undefined) ids.push(vocab[ch])
    ids.push(PAD_ID)
    const styleOff = 256 * Math.min(Math.max(ids.length - 2, 0), 509)
    const feeds = {
      input_ids: new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
      style: new ort.Tensor('float32', voice.slice(styleOff, styleOff + 256), [1, 256]),
      speed: new ort.Tensor('float32', Float32Array.from([speed]), [1]),
    }
    const out = await session.run(feeds)
    return out.waveform.data
  }

  const durations = {}
  for (const [key, text] of Object.entries(LINES)) {
    let speed = 1.0
    let wave = await synth(text, speed)
    let dur = wave.length / SR
    const budget = SLOTS[key] - 0.4
    if (dur > budget) {
      speed = Math.min(1.35, dur / budget + 0.02)
      wave = await synth(text, speed)
      dur = wave.length / SR
    }
    writeWav(path.join(dir, key + '.wav'), wave)
    durations[key] = +dur.toFixed(2)
    console.log(key.padEnd(14), durations[key] + 's', '(slot ' + SLOTS[key].toFixed(1) + 's' + (speed > 1 ? ', speed ' + speed.toFixed(2) : '') + ')')
  }
  fs.writeFileSync(path.join(dir, 'durations.json'), JSON.stringify(durations, null, 2))
}
main().catch(e => { console.error(e); process.exit(1) })
