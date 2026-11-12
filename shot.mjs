import './mute-auto.mjs'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 台本で撮る: node shot.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
const ROOT = import.meta.dirname, PORT = 6621
mkdirSync(ROOT + '/shots', { recursive: true })
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(MUTE_LAUNCH)
const ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await muteContext(ctx)
const p = await ctx.newPage(); const errs = []
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__ocReady, null, { timeout: 15000 }); await p.waitForTimeout(700)
await p.screenshot({ path: ROOT + '/shots/s-title.png' })
await p.click('#bStart'); await p.evaluate(() => { oc.dbg.pause(); oc.dbg.seed(11); oc.start(); oc.dbg.pause(); oc.dbg.step(60) })
await p.screenshot({ path: ROOT + '/shots/s-walk.png' })
const BOT = { lag: 0.35, err: 0.02, gain: 1, spd: 2.2, pre: true, shout: false, slosh: true }
await p.evaluate((B) => { const bot = oc.makeBot(B); let f = 0; while (f++ < 60 * 6) { bot(1 / 60); oc.dbg.tick(1) } oc.dbg.put('doc', 2.2, -1); oc.dbg.put('golf', 4, 1); for (let i = 0; i < 40; i++) { bot(1 / 60); oc.dbg.tick(1) } oc.dbg.render() }, BOT)
await p.screenshot({ path: ROOT + '/shots/s-walk2.png' })
const r = await p.evaluate((B) => { oc.dbg.seed(5); oc.start(); oc.dbg.pause(); const bot = oc.makeBot(B); let f = 0; while (oc.G.scene === 'play' && oc.G.trips < 4 && f++ < 60 * 300) { bot(1 / 60); oc.dbg.tick(1) } while (oc.G.phase !== 'walk' && f++ < 60*300) oc.dbg.tick(1); for (let i = 0; i < 200; i++) { bot(1 / 60); oc.dbg.tick(1) } oc.dbg.render(); return oc.state() }, BOT)
console.log(JSON.stringify(r))
await p.screenshot({ path: ROOT + '/shots/s-walk3.png' })
await p.evaluate(() => { oc.dbg.arrive(); oc.dbg.step(30) })
await p.screenshot({ path: ROOT + '/shots/s-desk.png' })
await p.evaluate(() => { oc.dbg.tick(200); oc.dbg.finish(); oc.dbg.tick(400) }); await p.waitForTimeout(800)
await p.screenshot({ path: ROOT + '/shots/s-end.png' })
console.log('errs', errs)
await b.close(); server.kill()
