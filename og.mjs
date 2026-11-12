import './mute-auto.mjs'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// og.png（1200x630）: 遊んでいる場面＋題名。node og.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
const ROOT = import.meta.dirname, PORT = 6625
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(MUTE_LAUNCH)
const ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 700 }, deviceScaleFactor: 2 }); await muteContext(ctx)
const p = await ctx.newPage()
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__ocReady); await p.waitForTimeout(500)
await p.click('#bStart')
await p.evaluate(() => { oc.dbg.pause(); oc.dbg.seed(11); oc.start(); oc.dbg.pause(); oc.G.evs = []; oc.dbg.calm(); for (let i = 0; i < 3; i++) { oc.dbg.arrive(); oc.dbg.tick(200) } oc.G.evs = []; oc.dbg.calm(); oc.G.z = 4; oc.dbg.put('golf', 1.9, 1); oc.dbg.put('doc', 6, -1); oc.G.fT = -0.1; oc.dbg.tick(30); oc.G.glasses[0].s = 0.2; oc.G.glasses[1].s = 0.14; oc.G.glasses[0].m = 1.2; oc.G.dDrift = 0.12; oc.G.dImp = 0; oc.G.tau = 0.14; for (const g of oc.G.glasses) g.sv = 0; oc.G.fx = Array.from({ length: 6 }, (_, i) => ({ x: i * 8, y: -10 + i * 14, gi: 0, side: 1, vx: 0, vy: 0, t: 0, life: 1 })); document.querySelector('#hud').style.display = 'none'; document.querySelector('#tut').style.display = 'none'; document.querySelector('#pop').style.display = 'none'; oc.dbg.render() })
const shot = (await p.screenshot()).toString('base64')
const font = 'https://fonts.googleapis.com/css2?family=BIZ+UDPGothic:wght@700&display=swap'
const q = await b.newPage({ viewport: { width: 1200, height: 630 } })
await q.setContent(`<html><head><link href="${font}" rel="stylesheet"><style>
body{margin:0;width:1200px;height:630px;background:#e9ebe6;font-family:"BIZ UDPGothic",sans-serif;color:#2a2f3a;overflow:hidden;position:relative}
img{position:absolute;left:60px;top:-210px;width:420px;transform:rotate(-3deg);border:6px solid #2a2f3a;box-shadow:10px 12px 0 rgba(42,47,58,.2)}
.t{position:absolute;left:540px;top:150px}
.s2{font-size:100px;line-height:1.15;font-weight:700}.s3{font-size:100px;color:#d9483b;line-height:1.15;margin-left:110px;font-weight:700}
.sub{position:absolute;left:546px;top:470px;font-size:34px;background:#f6dc6b;padding:8px 18px;border:3px solid #2a2f3a;transform:rotate(-1deg)}
</style></head><body><img src="data:image/png;base64,${shot}"><div class="t"><div class="s2">お茶汲み、</div><div class="s3">こぼすな</div></div><div class="sub">線まで、あと一滴。</div></body></html>`)
await q.waitForTimeout(1200)
await q.screenshot({ path: ROOT + '/og.png' })
await b.close(); server.kill()
