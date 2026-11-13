import './mute-auto.mjs'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 人の速さの bot で「定時まで運べるか」を数える: node simhuman.mjs [回数] [フォルダ]
// bot はこのファイルの中にある（ゲームの版に依らず同じ bot で前と後を比べるため）
// 見る→動くまでの遅れ（delay）・考え直す間隔（plan）・手のぶれ（jit）・指の速さ（spd）
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
const N = +(process.argv[2] || 20), ROOT = resolve(process.argv[3] || import.meta.dirname), PORT = 6623, GOAL = +(process.env.GOAL || 8)
const server = spawn(process.execPath, [resolve(ROOT, 'server.mjs')], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 500))
const b = await chromium.launch(MUTE_LAUNCH)
const ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 } }); await muteContext(ctx)
const p = await ctx.newPage()
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__ocReady)
if (process.env.TUNE) await p.evaluate(e => Object.assign(oc.TUNE, JSON.parse(e)), process.env.TUNE)
if (process.env.EASE) await p.evaluate(e => Object.assign(oc.EASE, JSON.parse(e)), process.env.EASE)
const BOTS = {
  // 初めての人: 先読みも声かけもしない。傾いたのを見て戻すだけ
  novice: { delay: 0.32, plan: 0.2, jit: 0.035, spd: 1.8, gain: 0.9 },
  // 数回遊んだ人: 近づいてくる人に半分くらい声をかける。おじさんにも半分は声をかけてしまう
  casual: { delay: 0.3, plan: 0.2, jit: 0.03, spd: 2, gain: 1, shout: 0.5, creep: 0.5 },
  // 慣れた人: 先に傾ける・声をかける
  // 雑な人: 大きく速く動かして行き過ぎる（見るのは速いが戻しすぎ）
  jerky: { delay: 0.15, plan: 0.15, jit: 0.06, spd: 9, gain: 2.2 },
  skilled: { delay: 0.25, plan: 0.15, jit: 0.025, spd: 2.4, gain: 1, shout: 0.8, creep: 0.1, pre: true },
}
const out = {}
for (const [name, cfg] of Object.entries(BOTS)) {
  out[name] = await p.evaluate(([cfg, N, GOAL]) => {
    const G = oc.G, D = oc.D
    const rs = []
    for (let s = 1; s <= N; s++) {
      oc.dbg.seed(s * 101 + 7); oc.start(); oc.dbg.pause()
      let r0 = s * 13 + 1; const Rb = () => (r0 = r0 * 16807 % 2147483647) / 2147483647
      const gauss = () => (Rb() + Rb() + Rb() - 1.5) * 1.15
      const hist = []; let want = 0, next = 0, jit = 0, lastPh = '', deliv = 0, f = 0, missAt = []
      const tapped = new Set()
      while (G.scene === 'play' && f++ < 60 * 900) {
        // 見えている傾き（自分の指のぶんを除いた、腕の疲れとぶつかり）を記録して、delay 秒前のものを見る
        hist.push({ t: G.t, d: G.tau - G.phi })
        while (hist.length > 2 && hist[1].t <= G.t - cfg.delay) hist.shift()
        if (G.phase === 'walk') {
          if (G.t >= next) {
            next = G.t + cfg.plan * (0.8 + Rb() * 0.4)
            want = -hist[0].d * cfg.gain + gauss() * cfg.jit
            if (cfg.pre) for (const e of G.evs) {
              const d = e.z - G.z, E = D.EVENTS[e.kind]
              if (e.done || e.hit || e.aside || d < 0 || d > 1.3) continue
              if (['doc', 'yawn'].includes(e.kind) && Math.abs(e.x) < 0.9) want += Math.sign(e.x || 1) * E.J * 0.7
              if (e.kind === 'golf' && !e.swing) want += e.side * E.J * 0.7
            }
            if (cfg.shout) for (const e of G.evs) {
              const d = e.z - G.z
              if (e.done || e.aside || tapped.has(e) || !D.EVENTS[e.kind].shout || d > 4.5 || d < 1.2) continue
              tapped.add(e)
              if (Rb() < (e.kind === 'creep' ? cfg.creep || 0 : cfg.shout)) oc.shoutAt(e)
            }
          }
          jit += (gauss() * cfg.jit - jit) * 0.08
          const mx = cfg.spd / 60
          G.fT = Math.max(-0.7, Math.min(0.7, G.fT + Math.max(-mx, Math.min(mx, want - G.fT)) + jit * 0.05))
        } else { want = 0 }
        oc.dbg.tick(1)
        if (G.phase !== lastPh) { if (G.phase === 'desk') deliv++; if (G.phase === 'fail') missAt.push(deliv); lastPh = G.phase }
        if (G.phase === 'clear') deliv = Math.max(deliv, G.delivered || 0)
      }
      // 古い版は終わりが無いので、2回こぼす前に GOAL 回届けたらクリアとみなす
      const cleared = G.result && G.result.cleared != null ? G.result.cleared : (missAt.length < 2 ? deliv >= GOAL : missAt[1] >= GOAL)
      rs.push({ deliv, cleared, firstMiss: missAt[0] ?? null, t: Math.round(G.t) })
    }
    const cl = rs.filter(r => r.cleared).length
    const reach = rs.map(r => r.firstMiss == null ? r.deliv : r.firstMiss)
    return { clear: `${cl}/${N}`, clearPct: Math.round(cl / N * 100), delivMean: +(rs.reduce((a, r) => a + r.deliv, 0) / N).toFixed(1), firstMissAt: reach.sort((a, b) => a - b).join(','), tMed: rs.map(r => r.t).sort((a, b) => a - b)[N >> 1] }
  }, [cfg, N, GOAL])
  console.log(name.padEnd(8), JSON.stringify(out[name]))
}
await b.close(); server.kill()
