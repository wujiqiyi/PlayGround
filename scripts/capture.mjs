import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const url = process.env.CAPTURE_URL
const output = process.env.CAPTURE_DIR
if (!url || !output) {
  console.error('[capture] CAPTURE_URL and CAPTURE_DIR are required.')
  process.exit(1)
}

const captureDir = resolve(output)
mkdirSync(captureDir, { recursive: true })

const runtimeRoot = process.env.OMGITHUB_PLAYWRIGHT_ROOT || join(process.env.HOME || '/home/runner', '.local/share', 'omgithub-playwright')
const runtimeDir = process.env.RUNTIME_DIR || '/home/runner/work/_temp/omgithub-runtime'

if (!existsSync(join(runtimeRoot, 'node_modules', 'playwright'))) {
  console.error(`[capture] Playwright runtime missing at ${runtimeRoot}`)
  process.exit(75)
}

const require = createRequire(join(runtimeRoot, 'package.json'))
const { chromium } = require('playwright')
try {
  require(join(runtimeRoot, 'wip-screenshots.cjs')).instrument(chromium)
} catch (error) {
  console.error(`[capture] WIP screenshot instrumentation unavailable: ${error.message}`)
}

let decodePng = null
let analysePixels = null
const gpuCapture = join(runtimeDir, 'scripts', 'gpu-capture.mjs')
if (existsSync(gpuCapture)) {
  const module = await import(pathToFileURL(gpuCapture).href)
  decodePng = module.decodePng
  analysePixels = module.analysePixels
}

const configPath = join(runtimeRoot, process.platform === 'darwin' ? 'metal.json' : 'linux.json')
const config = JSON.parse(readFileSync(configPath, 'utf8'))
if (process.platform === 'linux' && !process.env.DISPLAY) {
  try {
    process.env.DISPLAY = ':' + readFileSync(join(runtimeRoot, 'display'), 'utf8').trim()
  } catch {
    process.env.DISPLAY = ':0'
  }
}

class CaptureError extends Error {
  constructor(message, exitCode = 1) {
    super(message)
    this.exitCode = exitCode
  }
}

const transient = (error) => new CaptureError(error?.message || String(error), 75)

async function step(label, fn) {
  const started = performance.now()
  try {
    return await fn()
  } finally {
    console.log(`[capture] ${label}: ${((performance.now() - started) / 1000).toFixed(3)}s`)
  }
}

const views = [
  { name: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  { name: 'mobile', width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
]

const report = { url, output: captureDir, startedAt: new Date().toISOString(), views: [] }
let browser = null
let exitCode = 0

try {
  browser = await step('launch browser', async () => {
    try {
      return await chromium.launch({ ...config.browser.launchOptions, timeout: 30000 })
    } catch (error) {
      throw transient(error)
    }
  })

  for (const view of views) {
    const pageErrors = []
    const consoleErrors = []
    const httpErrors = []
    let context = null
    try {
      context = await step(`new ${view.name} context`, async () => {
        try {
          return await browser.newContext({
            viewport: { width: view.width, height: view.height },
            deviceScaleFactor: view.deviceScaleFactor,
            isMobile: view.isMobile,
            hasTouch: view.hasTouch
          })
        } catch (error) {
          throw transient(error)
        }
      })

      const page = await context.newPage()
      page.setDefaultTimeout(30000)
      page.on('pageerror', (error) => pageErrors.push(error.message))
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text())
      })
      page.on('response', (response) => {
        if (response.status() >= 400) httpErrors.push(`${response.status()} ${response.url()}`)
      })

      const response = await step(`navigate ${view.name}`, async () => {
        try {
          return await page.goto(url, { waitUntil: 'load', timeout: 45000 })
        } catch (error) {
          throw transient(error)
        }
      })

      if (!response || !response.ok()) {
        const status = response?.status() || 0
        const code = !status || [408, 425, 429, 500, 502, 503, 504].includes(status) ? 75 : 1
        throw new CaptureError(`HTTP ${status || 'no response'} loading ${url}`, code)
      }

      await step(`wait for canvas ${view.name}`, async () => {
        try {
          await page.locator('#game-canvas').waitFor({ state: 'visible', timeout: 30000 })
        } catch (error) {
          if (!browser.isConnected()) throw transient(error)
          throw new CaptureError(`Game canvas did not become visible: ${error.message}`)
        }
      })

      await step(`wait for scene ${view.name}`, async () => {
        try {
          await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 30000 })
          await page.waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 10000 })
        } catch (error) {
          if (!browser.isConnected()) throw transient(error)
          throw new CaptureError(`3D scene did not finish rendering: ${error.message}`)
        }
      })

      await step(`start game ${view.name}`, async () => {
        try {
          await page.locator('#start-button').click({ timeout: 5000 })
        } catch (error) {
          if (!browser.isConnected()) throw transient(error)
          throw new CaptureError(`Start button was not actionable: ${error.message}`)
        }
        try {
          await page.waitForFunction(() => document.body.dataset.playing === 'true', null, { timeout: 8000 })
        } catch (error) {
          if (!browser.isConnected()) throw transient(error)
          throw new CaptureError(`Gameplay did not start: ${error.message}`)
        }
      })

      await page.waitForTimeout(1100)
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))

      const sceneState = await page.evaluate(() => {
        const canvas = document.getElementById('game-canvas')
        const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl')
        return {
          ready: window.__gameReady === true,
          playing: document.body.dataset.playing === 'true',
          width: canvas?.width || 0,
          height: canvas?.height || 0,
          hasWebgl: Boolean(gl),
          gameState: window.__gameState || null
        }
      })

      if (!sceneState.ready || !sceneState.playing) {
        throw new CaptureError(`Game did not reach a playable frame: ${JSON.stringify(sceneState)}`)
      }
      if (!sceneState.width || !sceneState.height || !sceneState.hasWebgl) {
        throw new CaptureError(`WebGL canvas was not initialized: ${JSON.stringify(sceneState)}`)
      }

      const file = join(captureDir, `final-${view.name}.png`)
      const screenshot = await step(`screenshot ${view.name}`, async () => {
        try {
          return await page.screenshot({ path: file, timeout: 30000 })
        } catch (error) {
          if (error.name === 'TimeoutError' || !browser.isConnected()) throw transient(error)
          throw new CaptureError(`Screenshot failed: ${error.message}`)
        }
      })

      let pixels = null
      if (decodePng && analysePixels) {
        pixels = analysePixels(decodePng(screenshot))
        if (!pixels.nonblank || pixels.distinctInteriorColors < 24) {
          throw new CaptureError(`Screenshot ${view.name} looks blank or unrendered: ${JSON.stringify(pixels)}`)
        }
      }

      if (pageErrors.length) {
        throw new CaptureError(`Page runtime errors during ${view.name}: ${pageErrors.join(' | ')}`)
      }

      report.views.push({
        name: view.name,
        file,
        bytes: screenshot.length,
        pixels,
        scene: sceneState,
        consoleErrors,
        httpErrors
      })
      console.log(`[capture] ${view.name} screenshot ready: ${file}`)
    } finally {
      if (context) await context.close().catch(() => {})
    }
  }
} catch (error) {
  console.error(`[capture] ERROR: ${error.message}`)
  writeFileSync(join(captureDir, 'capture-error.txt'), `${error.stack || error.message}\n`)
  exitCode = error.exitCode || 1
} finally {
  if (browser) {
    const closed = await step('close browser', () => browser.close().then(() => true).catch((error) => {
      console.error(`[capture] close failed: ${error.message}`)
      return false
    }))
    if (!closed && !exitCode) exitCode = 75
  }
  report.finishedAt = new Date().toISOString()
  report.exitCode = exitCode
  try {
    writeFileSync(join(captureDir, 'capture-report.json'), JSON.stringify(report, null, 2))
  } catch (error) {
    console.error(`[capture] report write failed: ${error.message}`)
  }
}

process.exit(exitCode)
