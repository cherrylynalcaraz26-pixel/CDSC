/**
 * Records the CDSC Client Portal demo video using the pre-installed Chromium.
 * Free/local: Playwright video recording + a mock Supabase backend.
 */
const { chromium } = require('playwright-core')
const path = require('path')
const fs = require('fs')

const BASE = 'http://localhost:3000'
const VIDEO_DIR = path.join(__dirname, 'video')
const W = 1600, H = 900

const sleep = ms => new Promise(r => setTimeout(r, ms))

// injected on every document: fake cursor, click ripple, caption + overlay helpers
const INIT = `
(() => {
  if (window.__demoInit) return; window.__demoInit = true
  function ready(fn){ if (document.body) fn(); else document.addEventListener('DOMContentLoaded', fn) }
  ready(() => {
    const c = document.createElement('div')
    c.id = '__cursor'
    c.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:22px;border-radius:50%;background:rgba(220,38,38,.85);border:2.5px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.4);z-index:2147483647;pointer-events:none;transform:translate(-50%,-50%);transition:opacity .2s;opacity:0'
    document.body.appendChild(c)
    document.addEventListener('mousemove', e => {
      c.style.opacity = '1'
      c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'
    }, true)
    document.addEventListener('mousedown', e => {
      const r = document.createElement('div')
      r.style.cssText = 'position:fixed;left:'+e.clientX+'px;top:'+e.clientY+'px;width:14px;height:14px;border-radius:50%;border:3px solid rgba(220,38,38,.9);z-index:2147483646;pointer-events:none;transform:translate(-50%,-50%);animation:__rip .55s ease-out forwards'
      document.body.appendChild(r); setTimeout(() => r.remove(), 600)
    }, true)
    const st = document.createElement('style')
    st.textContent = '@keyframes __rip{to{width:64px;height:64px;opacity:0}} @keyframes __capIn{from{opacity:0;transform:translate(-50%,14px)}to{opacity:1;transform:translate(-50%,0)}} nextjs-portal{display:none!important}'
    document.head.appendChild(st)
  })
  window.__caption = (text) => ready(() => {
    let el = document.getElementById('__caption')
    if (!text) { el && el.remove(); return }
    if (!el) {
      el = document.createElement('div'); el.id = '__caption'
      el.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:rgba(17,17,17,.92);color:#fff;font:600 17px/1.4 system-ui,-apple-system,sans-serif;padding:12px 26px;border-radius:999px;z-index:2147483645;pointer-events:none;box-shadow:0 4px 24px rgba(0,0,0,.35);animation:__capIn .35s ease-out;white-space:nowrap'
      document.body.appendChild(el)
    }
    el.textContent = text
  })
  window.__overlay = (title, sub) => ready(() => {
    let el = document.getElementById('__overlay')
    if (!title) {
      if (el) { el.style.transition = 'opacity .6s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 650) }
      return
    }
    el = document.createElement('div'); el.id = '__overlay'
    el.style.cssText = 'position:fixed;inset:0;z-index:2147483644;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:linear-gradient(145deg,#b91c1c 0%,#7f1d1d 60%,#450a0a 100%);color:#fff;font-family:system-ui,-apple-system,sans-serif'
    el.innerHTML = '<div style="font-size:46px;font-weight:800;letter-spacing:-.5px">'+title+'</div>'
      + (sub ? '<div style="font-size:21px;opacity:.85;font-weight:500">'+sub+'</div>' : '')
      + '<div style="position:absolute;bottom:34px;font-size:13px;opacity:.55">© 2026 CDSC Industrial Supply</div>'
    document.body.appendChild(el)
  })
})()`

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/opt/pw-browsers/chromium',
  })
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir: VIDEO_DIR, size: { width: W, height: H } },
    deviceScaleFactor: 1,
  })
  await ctx.addInitScript(INIT)
  const page = await ctx.newPage()
  global.__page = page
  page.setDefaultTimeout(30000)

  // narration timeline: section name -> ms offset from recording start
  const T0 = Date.now()
  const timeline = {}
  const mark = (name) => { timeline[name] = Date.now() - T0 }

  const caption = async (t) => page.evaluate(t => window.__caption(t), t)
  const moveTo = async (loc) => {
    const box = await loc.boundingBox()
    if (!box) throw new Error('no box for locator')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 32 })
  }
  const clickNice = async (loc) => {
    await loc.scrollIntoViewIfNeeded()
    await sleep(250)
    await moveTo(loc)
    await sleep(420)
    await loc.click()
  }
  const wheel = async (dy, chunks = 8) => {
    for (let i = 0; i < chunks; i++) { await page.mouse.wheel(0, dy / chunks); await sleep(90) }
  }

  // ---------- 1. intro on login page ----------
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
  mark('intro')
  await page.evaluate(() => window.__overlay('CDSC Client Portal', 'Product Demo — order, track & manage your supplies online'))
  await sleep(8800)
  await page.evaluate(() => window.__overlay(null))
  await sleep(900)

  // ---------- 2. sign in ----------
  mark('login')
  await caption('Sign in with your client account')
  await page.mouse.move(W / 2, H / 2, { steps: 10 })
  const email = page.getByPlaceholder('you@cdsc.com')
  await clickNice(email)
  await email.pressSequentially('maria.santos@northpointmfg.ph', { delay: 42 })
  await sleep(350)
  const pass = page.getByPlaceholder('••••••••')
  await clickNice(pass)
  await pass.pressSequentially('demo-portal-2026', { delay: 55 })
  await sleep(500)
  await clickNice(page.getByRole('button', { name: 'Sign In' }))

  // ---------- 3. dashboard ----------
  await page.getByText('Welcome back, Northpoint').waitFor({ timeout: 45000 })
  mark('dashboard')
  await sleep(600)
  await caption('Dashboard — orders, quotations & stock at a glance')
  await sleep(2600)
  await wheel(500); await sleep(1700)          // KPI cards + charts
  await wheel(500); await sleep(1700)          // stock levels
  await wheel(600); await sleep(1800)          // recent orders / quotations
  await wheel(-1600, 10); await sleep(900)

  // notifications
  mark('notifications')
  await caption('Delivery and low-stock alerts, right in your portal')
  const bell = page.locator('header button:has(svg.lucide-bell)').first()
  await clickNice(bell)
  await page.getByText('Mark all read').waitFor()
  await sleep(2600)
  // close: the click-away backdrop only spans the header strip (header has
  // backdrop-filter, which re-contains the fixed div), so click inside the header
  await page.mouse.move(700, 28, { steps: 20 })
  await sleep(300)
  await page.mouse.click(700, 28)
  await page.getByText('Mark all read').waitFor({ state: 'hidden' })
  await sleep(700)

  // ---------- 4. quotations ----------
  mark('quotations')
  await caption('Quotations — review offers and respond online')
  await clickNice(page.locator('aside').first().getByRole('link', { name: 'Quotations' }))
  await page.getByText('QT-2026-0212').waitFor()
  await sleep(1800)
  await clickNice(page.getByRole('button', { name: 'View items' }).first())
  await sleep(2400)
  mark('accept')
  await caption('Accept a quotation with one click')
  await clickNice(page.getByRole('button', { name: 'Mark as Accepted' }).first())
  await sleep(2600)

  // ---------- 5. my orders ----------
  mark('orders')
  await caption('My Orders — live status, items and delivery records')
  await clickNice(page.locator('aside').first().getByRole('link', { name: 'My Orders' }))
  await page.getByText('SO-2026-0148').waitFor()
  await sleep(1600)
  await clickNice(page.getByRole('button', { name: 'Details' }).first())
  await sleep(2200)
  await wheel(450); await sleep(1600)
  await wheel(-600, 6); await sleep(600)

  // ---------- 6. browse catalog ----------
  mark('catalog')
  await caption('Browse the CDSC catalog and order what you need')
  await clickNice(page.locator('aside').first().getByRole('link', { name: 'Browse Catalog' }))
  await page.getByPlaceholder('Search products…').waitFor()
  await sleep(1800)
  const search = page.getByPlaceholder('Search products…')
  await clickNice(search)
  await search.pressSequentially('bearing', { delay: 85 })
  await sleep(1900)
  // clear and show categories
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Backspace')
  await sleep(900)
  await wheel(400); await sleep(1500)
  await wheel(-500, 6); await sleep(600)

  // ---------- 7. my stock ----------
  mark('stock')
  await caption('My Stock — track on-hand levels and item movements')
  await clickNice(page.locator('aside').first().getByRole('link', { name: 'My Stock' }))
  await sleep(2400)
  await wheel(500); await sleep(1800)
  await wheel(-700, 6); await sleep(600)

  // ---------- 8. account settings ----------
  mark('account')
  await caption('Account — manage your profile, logo and departments')
  await clickNice(page.locator('aside').first().getByRole('link', { name: 'Account' }))
  await page.getByText('Account Settings').first().waitFor()
  await sleep(2300)
  await clickNice(page.getByRole('button', { name: 'Department' }).first())
  await sleep(2400)

  // ---------- 9. messages ----------
  mark('messages')
  await caption('Message the CDSC team directly from your portal')
  await clickNice(page.getByRole('button', { name: 'Messages' }))
  await sleep(2400)
  const ta = page.getByPlaceholder('Type a message… (Enter to send)')
  await clickNice(ta)
  await ta.pressSequentially('Please send a quote for 20 more drums of ISO 68 hydraulic oil.', { delay: 32 })
  await sleep(500)
  await page.keyboard.press('Enter')
  await sleep(2400)

  // ---------- 10. outro ----------
  await caption(null)
  mark('outro')
  await page.evaluate(() => window.__overlay('Order smarter. Track everything.', 'CDSC Industrial Supply — Client Portal'))
  await sleep(5200)

  await ctx.close()
  fs.writeFileSync(path.join(__dirname, 'timeline.json'), JSON.stringify(timeline, null, 2))
  const video = await page.video().path()
  console.log('TIMELINE=' + JSON.stringify(timeline))
  console.log('VIDEO=' + video)
  await browser.close()
}

main().catch(async e => {
  console.error(e)
  try {
    const pages = (global.__page ? [global.__page] : [])
    for (const p of pages) await p.screenshot({ path: path.join(__dirname, 'fail.png') })
  } catch {}
  process.exit(1)
})
