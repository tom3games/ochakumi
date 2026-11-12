import './mute-auto.mjs'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 遊び方ごとの分布: node sim.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
const ROOT = import.meta.dirname, PORT = 6622
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(MUTE_LAUNCH)
const ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 } }); await muteContext(ctx)
const p = await ctx.newPage()
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__ocReady)
const BOTS = {
  idle: null,
  human: { lag: 0.45, err: 0.03, gain: 1, spd: 2 },
  humanPre: { lag: 0.45, err: 0.03, gain: 1, spd: 2, pre: true },
  humanShout: { lag: 0.45, err: 0.03, gain: 1, spd: 2, pre: true, shout: true },
  expert: { lag: 0.25, err: 0.015, gain: 1, spd: 2.5, pre: true, shout: true, slosh: true },
  jerky: { lag: 0.15, err: 0.05, gain: 2.2, spd: 9 },
  tapCreep: { lag: 0.45, err: 0.03, gain: 1, spd: 2, pre: true, shout: true, tapCreep: true },
}
const out = {}
for (const [name, cfg] of Object.entries(BOTS)) {
  out[name] = await p.evaluate(([cfg]) => {
    const rs = []
    for (let s = 1; s <= 12; s++) {
      oc.dbg.seed(s * 101 + 7); oc.start(); oc.dbg.pause()
      let r0 = s * 13 + 1; const Rb = () => (r0 = r0 * 16807 % 2147483647) / 2147483647
      const bot = cfg ? oc.makeBot(cfg, Rb) : null
      let f = 0, first = null
      while (oc.G.scene === 'play' && f++ < 60 * 600) { if (bot) bot(1 / 60); oc.dbg.tick(1); if (first === null && (oc.G.served > 0 || oc.G.misses > 0)) first = oc.G.served > 0 }
      const res = oc.G.result || {}
      rs.push({ n: oc.G.served, t: Math.round(oc.G.t), first, sh: res.shouts, cs: res.creepSips, el: res.elevs, st: res.stairs, sc: res.shachos })
    }
    const ns = rs.map(r => r.n).sort((a, b) => a - b)
    return { mean: +(ns.reduce((a, b) => a + b, 0) / ns.length).toFixed(1), med: ns[6], ns: ns.join(','), firstOk: rs.filter(r => r.first).length, tMean: Math.round(rs.reduce((a, r) => a + r.t, 0) / rs.length), sh: rs.reduce((a, r) => a + (r.sh || 0), 0), cs: rs.reduce((a, r) => a + (r.cs || 0), 0), el: rs.reduce((a, r) => a + (r.el || 0), 0), st: rs.reduce((a, r) => a + (r.st || 0), 0), sc: rs.reduce((a, r) => a + (r.sc || 0), 0) }
  }, [cfg])
  console.log(name.padEnd(12), JSON.stringify(out[name]))
}
await b.close(); server.kill()
