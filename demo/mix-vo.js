/**
 * Builds one narration WAV (PCM s16 mono 22050) by placing each clip at its
 * timeline offset with silence in between, then muxes it onto the video.
 */
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const FF = require('@ffmpeg-installer/ffmpeg').path
const t = require('./timeline.json')
const keys = ['intro', 'login', 'dashboard', 'notifications', 'quotations', 'accept',
  'orders', 'catalog', 'stock', 'account', 'messages', 'outro']

const SR = 24000
const VO_DIR = 'vo-kokoro'
const chunks = []
let cursor = 0 // samples written so far

for (const k of keys) {
  const startSample = Math.round((t[k] / 1000) * SR)
  if (startSample > cursor) {
    chunks.push(Buffer.alloc((startSample - cursor) * 2)) // silence gap
    cursor = startSample
  }
  const pcm = fs.readFileSync(path.join(__dirname, VO_DIR, k + '.wav')).subarray(44)
  chunks.push(pcm)
  cursor += pcm.length / 2
}

const data = Buffer.concat(chunks)
const header = Buffer.alloc(44)
header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4)
header.write('WAVE', 8); header.write('fmt ', 12)
header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22)
header.writeUInt32LE(SR, 24); header.writeUInt32LE(SR * 2, 28)
header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34)
header.write('data', 36); header.writeUInt32LE(data.length, 40)
fs.writeFileSync(path.join(__dirname, 'narration.wav'), Buffer.concat([header, data]))
console.log('narration.wav', ((data.length / 2) / SR).toFixed(1) + 's')

const webm = fs.readdirSync(path.join(__dirname, 'video')).find(f => f.endsWith('.webm'))
const r = spawnSync(FF, [
  '-i', path.join(__dirname, 'video', webm),
  '-i', path.join(__dirname, 'narration.wav'),
  '-map', '0:v', '-map', '1:a',
  '-af', 'dynaudnorm=f=250:g=15:p=0.9:m=6',
  '-c:v', 'libx264', '-crf', '23', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
  '-movflags', '+faststart', '-y',
  path.join(__dirname, 'cdsc-client-portal-demo.mp4'),
], { stdio: ['ignore', 'inherit', 'pipe'] })
if (r.status !== 0) { console.error(r.stderr.toString().split('\n').slice(-8).join('\n')); process.exit(1) }
console.log('done')
