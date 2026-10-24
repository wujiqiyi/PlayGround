import { createRequire } from 'node:module'
import { readFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const runtime = join(process.env.HOME, '.local/share/omgithub-playwright')
const require = createRequire(join(runtime, 'package.json'))
const { chromium } = require('playwright')
const config = JSON.parse(
  readFileSync(join(runtime, process.platform === 'darwin' ? 'metal.json' : 'linux.json'), 'utf8'),
)
if (process.platform === 'linux') {
  process.env.DISPLAY ||= ':' + readFileSync(join(runtime, 'display'), 'utf8').trim()
}

const url = process.env.CAPTURE_URL
const output = process.env.CAPTURE_DIR
if (!url || !output) {
  console.error('Set CAPTURE_URL and CAPTURE_DIR.')
  process.exit(1)
}
mkdirSync(output, { recursive: true })

const startSelector = process.env.CAPTURE_START_SELECTOR || '#play-button'
const startedAt = Date.now()
const mark = (label) => console.log(`[capture] ${label} ${((Date.now() - startedAt) / 1000).toFixed(2)}s`)
const fail = (error, code) => {
  throw Object.assign(error instanceof Error ? error : new Error(String(error)), { exitCode: code })
}
const transient = (error) => fail(error, 75)

let browser
let exitCode = 0
try {
  browser = await chromium.launch({ ...config.browser.launchOptions, timeout: 30000 }).catch(transient)
  mark('browser ready')

  for (const [name, width, height] of [
    ['desktop', 1440, 900],
    ['mobile', 390, 844],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } }).catch(transient)
    page.setDefaultTimeout(30000)
    const pageErrors = []
    page.on('pageerror', (error) => {
      pageErrors.push(error.message)
      console.error(`[capture] ${name} page error: ${error.message}`)
    })

    const response = await page.goto(url, { waitUntil: 'load', timeout: 45000 }).catch(transient)
    if (!response) transient(new Error('No response loading the preview.'))
    if (!response.ok()) {
      const status = response.status()
      fail(new Error(`HTTP ${status} loading the preview.`), [408, 429, 500, 502, 503, 504].includes(status) ? 75 : 1)
    }
    mark(`${name} page loaded`)

    await page
      .waitForFunction(() => window.__NEON_DRIFT__?.ready === true && document.body.dataset.ready === '1', null, {
        timeout: 30000,
      })
      .catch(() => {
        if (pageErrors.length) fail(new Error(`Game failed to render: ${pageErrors[0]}`), 1)
        fail(new Error('Game never signalled render readiness.'), 1)
      })
    await page.evaluate(() => document.fonts.ready).catch(() => {})
    await page.locator(startSelector).waitFor({ state: 'visible', timeout: 15000 }).catch(() => {
      fail(new Error('Start control is not visible.'), 1)
    })
    const framesBefore = await page.evaluate(() => window.__NEON_DRIFT__.frames)
    await page.locator(startSelector).click({ timeout: 15000 }).catch(async (error) => {
      if (!browser.isConnected()) transient(error)
      await page.evaluate((selector) => document.querySelector(selector)?.click(), startSelector).catch(() => {})
    })

    await page
      .waitForFunction(() => document.body.dataset.state === 'playing', null, { timeout: 10000 })
      .catch(() => {
        if (pageErrors.length) fail(new Error(`Game failed to start: ${pageErrors[0]}`), 1)
        fail(new Error('Game did not enter the playing state.'), 1)
      })
    await page
      .waitForFunction((before) => window.__NEON_DRIFT__.frames > before + 8, framesBefore, { timeout: 15000 })
      .catch(() => fail(new Error('Game stopped rendering after start.'), 1))
    await page.waitForTimeout(900)

    await page.screenshot({ path: join(output, `final-${name}.png`), timeout: 30000 }).catch((error) => {
      if (error.name === 'TimeoutError' || !browser.isConnected()) transient(error)
      fail(error, 1)
    })
    mark(`${name} captured`)
    await page.close().catch(() => {})
  }
} catch (error) {
  console.error(error)
  exitCode = error.exitCode || 1
} finally {
  if (browser) {
    await browser.close().catch((error) => {
      console.error(error)
      if (!exitCode) exitCode = 75
    })
  }
}
process.exitCode = exitCode
