// お茶汲み、こぼすな（ochakumi）。線まで満タンの麦茶をお盆で上司のデスクへ。指を左右に動かしてお盆の傾きを戻す
// 仕様の正本: ~/Desktop/claudecode/ideas/ochakumi.md
;(() => {
'use strict'
window.__jsUp = true
const D = OC_DATA, A = OC_ATLAS
const $ = s => document.querySelector(s)
const on = (s, f) => $(s).addEventListener('click', f)
const isJa = () => (navigator.language || 'ja').toLowerCase().startsWith('ja')
let lang = 'ja'
try { lang = localStorage.getItem('oc_lang') || (isJa() ? 'ja' : 'en') } catch (e) { lang = isJa() ? 'ja' : 'en' }
const T = () => D.TXT[lang]

// ---- 乱数（種を固定できる） ----
let seedV = (Date.now() % 2147483646) + 1
const R = () => (seedV = seedV * 16807 % 2147483647) / 2147483647
const rr = (a, b) => a + (b - a) * R()
const pick = a => a[Math.floor(R() * a.length)]
const clamp = (v, a, b) => v < a ? a : v > b ? b : v
const lerp = (a, b, k) => a + (b - a) * k
const sgn = v => v < 0 ? -1 : 1

// ---- 音（録音素材） ----
Snd.def({
  spill: ['snd/spill1.mp3', 'snd/spill2.mp3', 'snd/spill3.mp3'], drip: ['snd/drip1.mp3', 'snd/drip2.mp3'],
  step: ['snd/step1.mp3', 'snd/step2.mp3', 'snd/step3.mp3'], bump: ['snd/bump1.mp3', 'snd/bump2.mp3'], thud: 'snd/thud.mp3',
  sneeze: 'snd/sneeze.mp3', swing: 'snd/swing.mp3', ding: 'snd/ding.mp3', clink: 'snd/clink.mp3', coin: 'snd/coin.mp3', click: 'snd/click.mp3',
  jgood: 'snd/jgood.mp3', jmeh: 'snd/jmeh.mp3', jover: 'snd/jover.mp3', jrare: 'snd/jrare.mp3',
})
const LOOPS = { bgm: 'snd/bgm.mp3', office: 'snd/amb_office.mp3', clock: 'snd/amb_clock.mp3', robot: 'snd/amb_robot.mp3' }
let muted = false
try { muted = localStorage.getItem('oc_mute') === '1' } catch (e) {}
Snd.setMute(muted)
const sfx = (n, o) => Snd.play(n, o)
function loopVol(slot, v, tc = 0.2) { const l = Snd.loops[slot]; if (l && l.g && Snd.ctx) { l.g.gain.cancelScheduledValues(Snd.ctx.currentTime); l.g.gain.setTargetAtTime(Math.max(0.0001, v), Snd.ctx.currentTime, tc) } }
const loopsOn = {}
function loop(slot, vol) { if (vol == null) { if (loopsOn[slot]) { Snd.loop(slot, null); loopsOn[slot] = 0 } return } if (!loopsOn[slot]) { Snd.loop(slot, LOOPS[slot], vol); loopsOn[slot] = 1 } else loopVol(slot, vol) }
function allLoopsOff() { for (const k in loopsOn) loop(k, null) }

// ---- 絵 ----
const IMG = new Image()
let imgOk = false
const fr = n => A.f[n]
function spr(c, name, x, y, w, rot = 0, o = {}) {
  if (!imgOk || !fr(name)) return
  const f = fr(name), h = w * f[3] / f[2]
  c.save(); c.translate(x, y); if (rot) c.rotate(rot)
  if (o.flip) c.scale(-1, 1)
  if (o.alpha != null) c.globalAlpha *= o.alpha
  const top = o.anchor === 'top' ? 0 : o.anchor === 'mid' ? -h / 2 : -h
  c.drawImage(IMG, f[0], f[1], f[2], f[3], -w / 2, top, w, h)
  c.restore()
}
const sprH = (name, w) => fr(name) ? w * fr(name)[3] / fr(name)[2] : w

// ---- 調整値（sim で決めた値） ----
const TUNE = { sag: 0.9, walk: 1.45, thr: 0.17, spillK: 42, drift: 0.07, impDecay: 0.75, hand: 13, kappa: 0.022, damp: 2.4, fingerK: 1.4, maxTilt: 0.7, step: 0.52 }

// ---- 画面 ----
const cv = $('#cv')
const cx = cv.getContext('2d')
let W = 390, H = 844, DPR = 1
function resize() {
  const r = cv.getBoundingClientRect()
  W = r.width || 390; H = r.height || 844
  DPR = Math.min(2, window.devicePixelRatio || 1)
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR)
}
addEventListener('resize', () => { resize(); sizeTitleArt() })

// ---- 状態 ----
const G = window.__ocG = { scene: 'title', phase: 'title', t: 0, paused: false }
function reset() {
  Object.assign(G, {
    phase: 'walk', t: 0, phT: 0, n: 0, served: 0, misses: 0, trips: 0, z: 0, L: 16, glasses: [], evs: [], fx: [],
    fT: 0, phi: 0, dDrift: 0, dImp: 0, driftV: 0.05, driftNext: 1.5, tau: 0, tauV: 0, stepT: 0, stepSide: 1, bob: 0,
    popUntil: 0, bubUntil: 0, bub: null, order: null, lastSay: null, lastBoss: 'kacho', lastFace: 'ok', lastLeft: 0,
    shouts: 0, creepSips: 0, elevs: 0, stairsN: 0, shachos: 0, bumps: 0, desk: null, fail: null, special: null, result: null, tutDone: false,
  })
  newTrip()
}

// ---- 1回の運び（どの上司へ・何杯・廊下に何が出るか） ----
function newTrip() {
  const n = G.trips
  const shacho = n >= 2 && R() < 0.14
  let bosses = ['kacho']
  if (shacho) bosses = ['shacho']
  else if (n >= 6) bosses = ['kacho', 'bucho', 'kacho']
  else if (n >= 2) bosses = ['kacho', 'bucho']
  const shrink = Math.min(4, Math.floor(n / 3))
  G.glasses = bosses.map((b, i) => ({ boss: b, m0: Math.max(3, D.BOSSES[b].m0 - (b === 'shacho' ? 0 : shrink)), m: Math.max(3, D.BOSSES[b].m0 - (b === 'shacho' ? 0 : shrink)), s: 0, sv: 0, w: 6.2 + i * 1.5 + R() * 0.4, out: false, spillT: 0, side: 0 }))
  G.L = clamp(16 + n * 2.6, 16, 42)
  G.z = 0; G.phase = 'walk'; G.phT = 0
  G.fT = 0; G.phi = 0; G.dDrift = 0; G.dImp = 0; G.tau = 0; G.tauV = 0
  G.desk = null; G.fail = null
  // 廊下の出来事
  const evs = []
  const nEv = Math.min(1 + n, 7)
  const kinds = ['doc', 'yawn', 'golf', 'sneeze', 'mop', 'robot'].filter(k => n >= 1 || k === 'doc')
  let z = 6.5
  for (let i = 0; i < nEv; i++) {
    z += rr(2.6, 4.2) * Math.max(0.7, 1 - n * 0.04)
    if (z > G.L - 3.5) break
    const k = i === 0 && n === 0 ? 'doc' : pick(kinds)
    evs.push(mkEv(k, z))
  }
  if (n >= 3 && R() < 0.3) { const zc = rr(5, G.L - 4); evs.push(mkEv('creep', zc)) }
  // エレベーター・階段（真ん中あたりに1つ）
  G.special = null
  if (n >= 2 && R() < 0.4) G.special = { kind: 'elev', z: G.L * 0.5, done: false }
  else if (n >= 3 && R() < 0.4) G.special = { kind: 'stairs', z: G.L * 0.5, done: false, k: 0 }
  if (G.special) for (const e of evs) if (Math.abs(e.z - G.special.z) < 1.6) e.z += 2
  G.evs = evs.filter(e => e.z < G.L - 2.5)
  G.trips++
  G.order = { bosses, shacho }
  const b0 = D.BOSSES[bosses[0]][lang]
  pop(T().order(b0, bosses.length), false, 1.6)
  if (shacho) { sfx('jrare', { vol: 0.4 }); G.shachos++ }
  drawHud()
}
function mkEv(kind, z) {
  const E = D.EVENTS[kind], side = R() < 0.5 ? -1 : 1
  const e = { id: Math.random(), kind, z, side, x: side * (kind === 'golf' ? 0.85 : kind === 'mop' ? 1.15 : 0.5), st: 'idle', t: 0, done: false, aside: 0, swing: 0 }
  if (kind === 'robot') { e.x = side * 1.3; e.vx = -side * 0.9 }
  if (kind === 'mop') e.slipSide = R() < 0.5 ? -1 : 1
  return e
}

// ---- ことば（同時に1つだけ） ----
function say(text, sx0, sy0, sec = 1.6) {
  G.bub = { text, x: sx0, y: sy0 }; G.bubUntil = G.t + Math.max(sec, 0.9 + text.length * 0.09)
  G.popUntil = Math.min(G.popUntil, G.t); $('#pop').className = ''
}
function pop(text, bad, sec = 1.5) {
  const el = $('#pop'); el.textContent = text; el.className = ''; void el.offsetWidth; el.className = 'on' + (bad ? ' bad' : '')
  G.popUntil = G.t + sec; G.bubUntil = Math.min(G.bubUntil, G.t)
}
const quiet = () => G.t > G.popUntil && G.t > G.bubUntil

// ---- HUD ----
const SAUCER = ok => `<svg viewBox="0 0 22 14"><ellipse cx="11" cy="8" rx="9.5" ry="4.5" fill="${ok ? '#8a5a2b' : 'none'}" stroke="${ok ? '#2a2f3a' : '#d9483b'}" stroke-width="1.8" ${ok ? '' : 'stroke-dasharray="3 2"'}/><ellipse cx="11" cy="7" rx="4" ry="1.6" fill="${ok ? '#b07a45' : 'none'}"/></svg>`
function drawHud() {
  const gl = G.glasses.filter(g => !g.out)
  const m = gl.length ? Math.min(...gl.map(g => g.m)) : 0
  const v = Math.max(0, Math.ceil(m - 1e-6))
  const t = T()
  $('#hL').textContent = t.left
  $('#hN').innerHTML = `${v}<small>${t.drops}</small>`
  $('#hN').classList.toggle('low', v <= 2)
  $('#hX').innerHTML = Array.from({ length: D.MISSES }, (_, i) => SAUCER(i >= G.misses)).join('')
  $('#hS').textContent = `${G.served}${t.unit || ' served'}`
}

// ---- 入力（指の動きと同じ向きに傾く。人をタップすると声をかける） ----
let ptr = null
function evAtScreen(x, y) {
  for (const e of G.evs) { if (e.done || e.aside || !e.box) continue; const b = e.box; if (x > b.x0 - 10 && x < b.x1 + 10 && y > b.y0 - 10 && y < b.y1 + 10) return e }
  return null
}
cv.addEventListener('pointerdown', e => {
  if (G.scene !== 'play') return
  e.preventDefault()
  const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top
  const ev = G.phase === 'walk' ? evAtScreen(x, y) : null
  if (ev) { shoutAt(ev); return }
  ptr = { id: e.pointerId, x0: e.clientX, f0: G.fT }
  try { cv.setPointerCapture(e.pointerId) } catch (er) {}
})
cv.addEventListener('pointermove', e => { if (ptr && ptr.id === e.pointerId) G.fT = clamp(ptr.f0 + (e.clientX - ptr.x0) / W * TUNE.fingerK, -TUNE.maxTilt, TUNE.maxTilt) })
const up = e => { if (ptr && ptr.id === e.pointerId) ptr = null }
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up)
function shoutAt(e) {
  const d = e.z - G.z
  if (d > 9 || d < 0.4 || e.done || e.aside) return false
  G.shouts++
  if (e.kind === 'creep') {
    // 変なおじさんは寄ってきて一口飲む
    e.done = true; e.sip = 1; G.creepSips++
    const g = G.glasses.find(g => !g.out); if (g) { g.m -= 2; g.sv += 0.6; checkOut() }
    sfx('drip', { vol: 0.8 }); say(T().creep, W / 2, H * 0.36, 1.6)
    drawHud(); return true
  }
  e.aside = 1; sfx('click', { vol: 0.4 })
  // 声を出した拍子に少し揺れる
  for (const g of G.glasses) g.sv += (R() < 0.5 ? -1 : 1) * 0.45
  if (quiet()) pop(T().shout, false, 0.9)
  return true
}

// ---- こぼれる・届く ----
function impulse(J, slosh, why) {
  const up = 1 + Math.min(G.trips, 15) * 0.04
  J *= up; slosh *= up
  G.dImp += J
  for (const g of G.glasses) g.sv += slosh * (R() < 0.5 ? -1 : 1) * rr(0.7, 1.1) + J * 2
  G.bumps++
  sfx(why === 'slip' ? 'thud' : 'bump', { vol: 0.7 }); sfx('clink', { vol: 0.5, delay: 0.05 })
}
function checkOut() {
  for (const g of G.glasses) if (!g.out && g.m < 0) {
    g.out = true
    G.misses++; drawHud()
    sfx('spill', { vol: 0.9 }); sfx('jover', { vol: 0.45, delay: 0.3 })
    pop(T().out, true, 1.4)
    G.fail = { boss: g.boss, t: 0 }
    G.lastBoss = g.boss; G.lastFace = 'mad'; G.lastSay = D.BOSSES[g.boss].say[lang].miss; G.lastLeft = 0
    G.phase = 'fail'; G.phT = 0; ptr = null
    return true
  }
  return false
}
function arrive() {
  G.phase = 'desk'; G.phT = 0; ptr = null
  if (G.special) G.special.done = true
  // 一番減ったコップで上司の顔が決まる
  let worst = null
  for (const g of G.glasses) { g.k = g.m / g.m0; if (!worst || g.k < worst.k) worst = g }
  let pts = 0; for (const g of G.glasses) pts += D.BOSSES[g.boss].pts
  G.served += pts; G.n = G.served
  const k = worst.k, face = k >= 0.6 ? 'full' : k >= 0.3 ? 'mid' : 'low'
  const boss = G.glasses.length > 1 ? 'kacho' : worst.boss
  G.lastBoss = worst.boss; G.lastFace = face === 'full' ? 'ok' : 'meh'; G.lastLeft = Math.max(0, Math.ceil(worst.m)); G.lastSay = D.BOSSES[worst.boss].say[lang][face]
  G.desk = { boss, face: face === 'full' ? 'ok' : 'meh' }
  sfx('clink', { vol: 0.7 }); sfx(face === 'full' ? 'jgood' : 'jmeh', { vol: 0.45, delay: 0.25 })
  if (face === 'full') sfx('coin', { vol: 0.4, delay: 0.5 })
  say(G.lastSay, W / 2, H * 0.30, 1.8)
  if (!G.tutDone) { G.tutDone = true; hideTut() }
  drawHud()
}

// ---- 1コマ（固定60Hz） ----
function update(dt) {
  G.t += dt; G.phT += dt
  if (G.scene !== 'play') return
  for (const p of G.fx) { p.t += dt; p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt }
  G.fx = G.fx.filter(p => p.t < p.life)
  if (G.phase === 'desk') { if (G.phT > 2.6) newTrip(); return }
  if (G.phase === 'fail') { if (G.phT > 2.2) { if (G.misses >= D.MISSES) { G.phase = 'over'; G.phT = 0 } else newTrip() } return }
  if (G.phase === 'over') { if (G.phT > 0.6) showEnd(); return }

  // ---- 歩く ----
  let walking = true
  const sp = G.special
  if (sp && !sp.done && G.z >= sp.z) {
    if (sp.kind === 'elev') {
      walking = false; sp.t = (sp.t || 0) + dt
      if (sp.t < dt * 1.5) { sfx('ding', { vol: 0.7 }); G.elevs++; if (quiet()) pop(T().elevator, false, 1.1) }
      if (!sp.j1 && sp.t > 0.8) { sp.j1 = 1; impulse(rr(-0.16, 0.16), 1.1, 'elev') }
      if (!sp.j2 && sp.t > 2.3) { sp.j2 = 1; impulse(rr(-0.14, 0.14), 0.9, 'elev'); sfx('ding', { vol: 0.6 }) }
      if (sp.t > 2.8) sp.done = true
    } else if (sp.kind === 'stairs') {
      if (!sp.seen) { sp.seen = 1; G.stairsN++; if (quiet()) pop(T().stairs, false, 1.0) }
      const want = Math.floor((G.z - sp.z) / 0.35)
      if (want > sp.k && sp.k < 6) { sp.k++; impulse((sp.k % 2 ? 1 : -1) * 0.09, 0.45, 'step') }
      if (sp.k >= 6) sp.done = true
    }
  }
  if (walking) G.z += TUNE.walk * dt
  // 足音と揺れ
  if (walking) { G.stepT += dt; if (G.stepT > TUNE.step) { G.stepT = 0; G.stepSide = -G.stepSide; sfx('step', { vol: 0.25 }); for (const g of G.glasses) g.sv += G.stepSide * 0.07 } }
  G.bob = walking ? Math.sin(G.stepT / TUNE.step * Math.PI) : G.bob * 0.9

  // 腕の疲れ（ゆっくり傾いていく）
  G.driftNext -= dt
  if (G.driftNext <= 0) { G.driftNext = rr(1.6, 3.4); G.driftV = (R() < 0.5 ? -1 : 1) * rr(0.045, 0.1) * (1 + Math.min(G.trips, 8) * 0.05) }
  G.dDrift = clamp(G.dDrift + (G.driftV + TUNE.sag * G.tau) * dt, -0.7, 0.7)
  G.dImp *= Math.exp(-TUNE.impDecay * dt)

  // 手は指を追いかける
  G.phi += (G.fT - G.phi) * Math.min(1, dt * TUNE.hand)
  const tau = G.phi + G.dDrift + G.dImp
  const tv = (tau - G.tau) / dt, ta = (tv - G.tauV) / dt
  G.tau = tau; G.tauV = tv

  // 廊下の出来事
  for (const e of G.evs) {
    if (e.done) continue
    const E = D.EVENTS[e.kind]
    e.t += dt
    if (E.walk && !e.sip) e.z -= E.walk * dt
    if (e.aside) e.x = lerp(e.x, sgn(e.x || e.side) * 1.3, Math.min(1, dt * 5))
    const d = e.z - G.z
    if (e.kind === 'robot') {
      if (d < 3.2) { e.x += e.vx * dt; if (!e.on) { e.on = 1; loop('robot', 0.25) } }
      if (Math.abs(e.x) > 1.5 && d < 3) { e.done = true; loop('robot', null) }
      if (d < 0.45 && Math.abs(e.x) < 0.45 && !e.hit) { e.hit = 1; impulse(sgn(e.vx) * E.J, E.slosh, 'robot') }
      if (d < -0.5) { e.done = true; loop('robot', null) }
      continue
    }
    if (e.kind === 'mop') {
      if (d < 0.2 && !e.hit) { e.hit = 1; impulse(e.slipSide * E.J, E.slosh, 'slip'); if (quiet()) pop(T().slip, true, 1.0) }
      if (d < -1) e.done = true
      continue
    }
    if (e.kind === 'golf') {
      if (d < 1.6 && !e.swing) { e.swing = 1; e.swT = 0; sfx('swing', { vol: 0.6 }); if (!e.aside) impulse(-e.side * E.J, E.slosh, 'golf') }
      if (d < -1) e.done = true
      continue
    }
    if (e.kind === 'sneeze') {
      if (d < 2.8 && e.st === 'idle' && !e.aside) { e.st = 'wind'; e.t = 0; if (quiet()) say(T().sneezeT, W / 2 + e.x * W * 0.3, H * 0.30, 0.8) }
      if (e.st === 'wind' && e.t > 0.85) { e.st = 'blow'; sfx('sneeze', { vol: 0.8 }); if (!e.aside) impulse(rr(-1, 1) * E.J, E.slosh, 'sneeze') }
      if (d < -0.6) e.done = true
      continue
    }
    if (e.kind === 'creep') {
      if (d < 1.6 && !e.said && quiet()) { e.said = 1; say('デュフフ', W / 2 + e.x * W * 0.4, H * 0.32, 0.9) }
      if (d < -0.6) e.done = true
      continue
    }
    // 歩いてくる人（肩がぶつかる）
    if (d < 0.6 && !e.hit && !e.aside && Math.abs(e.x) < 0.9) { e.hit = 1; impulse(-sgn(e.x) * E.J, E.slosh, 'bump') }
    if (d < -0.6) e.done = true
  }

  // コップの波とこぼれ
  let spilled = 0
  for (const [i, g] of G.glasses.entries()) {
    if (g.out) continue
    const a = -g.w * g.w * g.s - TUNE.damp * g.sv - TUNE.kappa * ta * (1 + i * 0.3)
    g.sv += a * dt; g.s += g.sv * dt
    g.s = clamp(g.s, -0.9, 0.9)
    const psi = tau + g.s
    if (Math.abs(psi) > TUNE.thr) {
      const amt = (Math.abs(psi) - TUNE.thr) * TUNE.spillK * dt
      g.m -= amt; spilled += amt; g.side = sgn(psi); g.spillT += dt
      if (R() < amt * 6) G.fx.push({ x: 0, y: 0, gi: i, side: g.side, vx: g.side * rr(60, 160), vy: rr(-140, -40), t: 0, life: 0.7 })
    }
  }
  if (spilled > 0) { G.spillAcc = (G.spillAcc || 0) + spilled; if (G.spillAcc > 0.5) { G.spillAcc = 0; sfx('drip', { vol: 0.6 }) } }
  if (checkOut()) return
  if (spilled > 0 || G.t % 0.25 < dt) drawHud()
  if (G.z >= G.L - 1.1) arrive()
}

// ---- 描く ----
const INK = '#2a2f3a'
// 奥行き: d は前方の距離。目の高さ 1.55、地平線は画面の 38%
const HC = 1.55
const yh = () => H * 0.38 + G.bob * 3
const F = () => W * 0.95
const pX = (x, d) => W / 2 + x * F() / d
const pY = (y, d) => yh() + (HC - y) * F() / d
function drawCorridor(c) {
  const hw = 1.6, top = 2.6, near = 0.6, far = Math.min(40, G.L - G.z + 0.3)
  // 天井・壁・床
  c.fillStyle = '#dfe1dc'; c.fillRect(0, 0, W, H)
  const quad = (pts, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) c.lineTo(p[0], p[1]); c.closePath(); c.fill() }
  quad([[pX(-hw, near), pY(top, near)], [pX(hw, near), pY(top, near)], [pX(hw, far), pY(top, far)], [pX(-hw, far), pY(top, far)]], '#eef0ec')
  quad([[pX(-hw, near), pY(0, near)], [pX(hw, near), pY(0, near)], [pX(hw, far), pY(0, far)], [pX(-hw, far), pY(0, far)]], '#8e9aa6')
  quad([[pX(-hw, near), pY(top, near)], [pX(-hw, far), pY(top, far)], [pX(-hw, far), pY(0, far)], [pX(-hw, near), pY(0, near)]], '#e4e2da')
  quad([[pX(hw, near), pY(top, near)], [pX(hw, far), pY(top, far)], [pX(hw, far), pY(0, far)], [pX(hw, near), pY(0, near)]], '#d9d7cf')
  // 床のタイルの線（歩くと流れる）
  c.strokeStyle = 'rgba(42,47,58,.18)'; c.lineWidth = 1
  for (let z = Math.ceil(G.z); z < G.z + far; z += 1) { const d = z - G.z; if (d < near) continue; c.beginPath(); c.moveTo(pX(-hw, d), pY(0, d)); c.lineTo(pX(hw, d), pY(0, d)); c.stroke() }
  for (const x of [-0.8, 0, 0.8]) { c.beginPath(); c.moveTo(pX(x, near), pY(0, near)); c.lineTo(pX(x, far), pY(0, far)); c.stroke() }
  // 天井の照明
  for (let z = Math.ceil(G.z / 3) * 3; z < G.z + far; z += 3) { const d = z - G.z + 1.5; if (d < near) continue; const w = 0.5 * F() / d, h = 0.9 * F() / d * 0.18; c.fillStyle = '#fbfbf2'; c.fillRect(W / 2 - w / 2, pY(top, d) - h / 2, w, Math.max(1, h)) }
  // 腰の線
  c.strokeStyle = 'rgba(42,47,58,.25)'; c.lineWidth = 2
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(pX(s * hw, near), pY(0.9, near)); c.lineTo(pX(s * hw, far), pY(0.9, far)); c.stroke() }
  // 壁のドアと飾り（奥から描く）
  const items = []
  for (let z = Math.ceil(G.z / 4) * 4 + 2; z < G.z + far; z += 4) {
    const k = Math.round(z), sd = (k * 7919) % 2 ? 1 : -1
    items.push({ d: z - G.z, kind: 'door', s: sd }, { d: z - G.z + 2, kind: ['plant', 'cooler', 'poster', 'chair'][k % 4], s: -sd })
  }
  items.sort((a, b) => b.d - a.d)
  for (const it of items) {
    const d = it.d; if (d < near + 0.2) continue
    const x = it.s * hw
    if (it.kind === 'door') {
      const z0 = d, z1 = d + 0.9
      quad([[pX(x, z0), pY(2.05, z0)], [pX(x, z1), pY(2.05, z1)], [pX(x, z1), pY(0, z1)], [pX(x, z0), pY(0, z0)]], '#5b6b7c')
      c.strokeStyle = INK; c.lineWidth = Math.max(1, 1.5 * F() / d / 300); c.beginPath(); c.moveTo(pX(x, z0), pY(2.05, z0)); c.lineTo(pX(x, z1), pY(2.05, z1)); c.lineTo(pX(x, z1), pY(0, z1)); c.lineTo(pX(x, z0), pY(0, z0)); c.closePath(); c.stroke()
    } else if (it.kind === 'poster') {
      const z0 = d, z1 = d + 0.6
      quad([[pX(x, z0), pY(1.75, z0)], [pX(x, z1), pY(1.75, z1)], [pX(x, z1), pY(1.1, z1)], [pX(x, z0), pY(1.1, z0)]], it.s > 0 ? '#6cc4a1' : '#f0c35a')
    } else {
      const xs = it.s * (hw - 0.25), h = { plant: 1.35, cooler: 1.25, chair: 1.0 }[it.kind]
      const sp = { plant: 'plant', cooler: 'cooler', chair: 'chair' }[it.kind]
      const ww = h * F() / d * (fr(sp) ? fr(sp)[2] / fr(sp)[3] : 0.6)
      spr(c, sp, pX(xs, d), pY(0, d), ww)
    }
  }
  // 突き当たり: 上司のデスク
  const dd = G.L - G.z
  if (dd < 40) {
    const d = Math.max(2.4, dd)
    quad([[pX(-hw, d), pY(top, d)], [pX(hw, d), pY(top, d)], [pX(hw, d), pY(0, d)], [pX(-hw, d), pY(0, d)]], '#f4f1e8')
    // 窓
    c.fillStyle = '#bcd8e8'; for (const x of [-1.1, 0.25]) c.fillRect(pX(x, d), pY(2.2, d), 0.85 * F() / d, 0.9 * F() / d)
    const boss = G.desk ? G.desk.boss : (G.fail ? G.fail.boss : G.glasses.length > 1 ? 'kacho' : (G.glasses[0] || { boss: 'kacho' }).boss)
    const face = G.fail ? 'mad' : G.desk ? G.desk.face : 'ok'
    const sp = D.BOSSES[boss].sp[face] || D.BOSSES[boss].sp.ok
    const bw = 1.25 * F() / d
    spr(c, sp, pX(0, d), pY(0.15, d), bw)
  }
}
function drawEvents(c) {
  const list = G.evs.filter(e => !e.done || e.kind === 'golf').map(e => ({ e, d: e.z - G.z })).filter(o => o.d > 0.35 && o.d < 30).sort((a, b) => b.d - a.d)
  for (const { e, d } of list) {
    const E = D.EVENTS[e.kind]
    e.box = null
    if (e.kind === 'mop') {
      const sx0 = pX(e.x, d), wl = 1.6 * F() / d
      spr(c, 'mop', sx0, pY(0, d), wl * 0.55)
      spr(c, 'wetsign', pX(-e.x * 0.15, d), pY(0, d), 0.55 * F() / d)
      // 濡れた床
      c.fillStyle = 'rgba(200,230,245,.45)'; c.beginPath(); c.ellipse(pX(0, d + 0.2), pY(0, d + 0.2), 1.0 * F() / (d + 0.2), 0.2 * F() / (d + 0.2), 0, 0, 7); c.fill()
      continue
    }
    if (e.kind === 'robot') { spr(c, 'robot', pX(e.x, d), pY(0, d), 0.45 * F() / d); continue }
    const h = e.kind === 'golf' ? 1.7 : 1.68
    const name = E.sp, wpx = h * F() / d * (fr(name) ? fr(name)[2] / fr(name)[3] : 0.5)
    const x = pX(e.x, d), y = pY(0, d)
    let rot = 0
    if (e.kind === 'golf' && e.swing) rot = -e.side * 0.25
    if (e.kind === 'sneeze' && e.st === 'wind') rot = -0.08
    if (e.aside) rot = sgn(e.x) * 0.08
    spr(c, name, x, y, wpx, rot, { flip: e.side > 0 && e.kind === 'golf' })
    const hp = sprH(name, wpx)
    e.box = { x0: x - wpx / 2, x1: x + wpx / 2, y0: y - hp, y1: y }
  }
}
// 手前: お盆とコップ
function glassGeom(i, n) { const span = n === 1 ? 0 : n === 2 ? 70 : 90; return { x: (n === 1 ? 0 : -span + i * (span * 2 / (n - 1))), w: n === 1 ? 92 : n === 2 ? 74 : 62 } }
function drawTray(c) {
  const k = Math.min(W / 390, H / 740)
  const cxp = W / 2, cyp = H * 0.80 + G.bob * 4 * k
  c.save(); c.translate(cxp, cyp); c.rotate(G.tau)
  // お盆を持つ手（絵）
  spr(c, 'tray', 0, 70 * k, 330 * k, 0, { anchor: 'bottom' })
  const n = G.glasses.length
  for (const [i, g] of G.glasses.entries()) {
    const gg = glassGeom(i, n), w = gg.w * k, h = w * 1.25, x = gg.x * k, base = -6 * k
    drawGlass(c, g, x, base, w, h, k)
  }
  c.restore()
  // しずく
  for (const p of G.fx) {
    const g = G.glasses[p.gi]; if (!g) continue
    const gg = glassGeom(p.gi, G.glasses.length)
    const ox = cxp + (gg.x + p.side * gg.w * 0.55) * k, oy = cyp - gg.w * 1.25 * k
    c.fillStyle = 'rgba(181,101,29,.8)'; c.beginPath(); c.ellipse(ox + p.x * k, oy + p.y * k, 3.5 * k, 5 * k, 0, 0, 7); c.fill()
  }
}
function drawGlass(c, g, x, base, w, h, k) {
  const topW = w, botW = w * 0.78
  const path = () => { c.beginPath(); c.moveTo(x - botW / 2, base); c.lineTo(x - topW / 2, base - h); c.lineTo(x + topW / 2, base - h); c.lineTo(x + botW / 2, base); c.closePath() }
  // 中身（麦茶）
  const lineY = base - h * 0.64, rim = base - h
  const level = lineY - (Math.max(0, g.m) / g.m0) * (lineY - rim) * 0.92
  const psi = g.out ? 0 : (G.tau + g.s)
  c.save(); path(); c.clip()
  c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x - w, rim, w * 2, h)
  if (!g.out) {
    c.fillStyle = 'rgba(181,101,29,.82)'
    // 水面は傾きに合わせる（右が上がると右からこぼれる）
    c.beginPath(); c.moveTo(x - w, level + Math.tan(psi) * w); c.lineTo(x + w, level - Math.tan(psi) * w); c.lineTo(x + w, base + 2); c.lineTo(x - w, base + 2); c.closePath(); c.fill()
    c.strokeStyle = 'rgba(255,230,190,.8)'; c.lineWidth = 2 * k; c.beginPath(); c.moveTo(x - w, level + Math.tan(psi) * w); c.lineTo(x + w, level - Math.tan(psi) * w); c.stroke()
  }
  c.restore()
  // ガラス
  path(); c.strokeStyle = INK; c.lineWidth = 2.2 * k; c.stroke()
  c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 3 * k; c.beginPath(); c.moveTo(x - topW * 0.32, rim + h * 0.12); c.lineTo(x - botW * 0.3, base - h * 0.15); c.stroke()
  // 赤い線（ここまで）
  const lx = w / 2 * (0.78 + 0.22 * (base - lineY) / h)
  c.strokeStyle = '#d9483b'; c.lineWidth = 2.6 * k; c.setLineDash([5 * k, 3 * k]); c.beginPath(); c.moveTo(x - lx, lineY); c.lineTo(x + lx, lineY); c.stroke(); c.setLineDash([])
  if (g.out) { c.fillStyle = '#d9483b'; c.font = `700 ${14 * k}px "BIZ UDPGothic",sans-serif`; c.textAlign = 'center'; c.fillText(T().out, x, base - h * 0.4) }
  // 誰の分か
  c.fillStyle = INK; c.font = `700 ${11 * k}px "BIZ UDPGothic",sans-serif`; c.textAlign = 'center'; c.fillText(D.BOSSES[g.boss][lang].replace('the ', ''), x, base + 14 * k)
}
function drawElevator(c) {
  const sp = G.special
  if (!sp || sp.kind !== 'elev' || !(G.z >= sp.z) || sp.done) return
  const t = sp.t || 0, open = t < 0.5 ? 1 - t / 0.5 : t > 2.4 ? (t - 2.4) / 0.4 : 0
  c.fillStyle = '#b9bdc2'; c.fillRect(0, 0, W, H)
  c.fillStyle = '#a3a8ae'; c.fillRect(W * 0.08, H * 0.05, W * 0.84, H * 0.9)
  c.fillStyle = '#2a2f3a'; c.fillRect(W * 0.35, H * 0.08, W * 0.3, 34)
  c.fillStyle = '#f0b44a'; c.font = '700 22px "BIZ UDPGothic",monospace'; c.textAlign = 'center'; c.fillText(t < 1.6 ? '3' : t < 2.2 ? '4' : '5', W / 2, H * 0.08 + 25)
  const gap = W * 0.42 * open
  c.fillStyle = '#c9cdd2'; c.fillRect(0, 0, W / 2 - gap, H); c.fillRect(W / 2 + gap, 0, W / 2 - gap, H)
  c.strokeStyle = '#8f949a'; c.lineWidth = 2; c.beginPath(); c.moveTo(W / 2 - gap, 0); c.lineTo(W / 2 - gap, H); c.moveTo(W / 2 + gap, 0); c.lineTo(W / 2 + gap, H); c.stroke()
}
function render() {
  const c = cx
  c.setTransform(DPR, 0, 0, DPR, 0, 0)
  drawCorridor(c); drawEvents(c); drawElevator(c)
  if (G.phase === 'fail') { c.fillStyle = 'rgba(217,72,59,' + (0.25 * Math.max(0, 1 - G.phT)) + ')'; c.fillRect(0, 0, W, H) }
  drawTray(c)
  const el = $('#bub')
  if (G.bub && G.t < G.bubUntil) { el.textContent = G.bub.text; el.style.left = clamp(G.bub.x, 90, W - 90) + 'px'; el.style.top = clamp(G.bub.y, 70, H - 40) + 'px'; el.classList.add('on') }
  else el.classList.remove('on')
}

// ---- 時計（固定60Hz・performance.now で数える） ----
let lastT = performance.now(), acc = 0
function frame() {
  requestAnimationFrame(frame)
  const now = performance.now()
  let d = (now - lastT) / 1000; lastT = now
  if (G.paused) return
  if (d > 0.25) d = 0.25
  acc += d
  while (acc >= 1 / 60) { update(1 / 60); acc -= 1 / 60 }
  if (G.scene === 'play') render()
  else if (G.scene === 'title') drawTitleArt()
}

// ---- タイトル（廊下の先に課長、手前に満タンのコップ） ----
const ta = $('#tArt'), tc = ta.getContext('2d')
function sizeTitleArt() { const r = ta.getBoundingClientRect(); if (!r.width) return; const d = Math.min(2, devicePixelRatio || 1); ta.width = Math.round(r.width * d); ta.height = Math.round(r.height * d); ta._w = r.width; ta._h = r.height; ta._d = d }
let tt = 0
const TG = { z: 0, L: 9, bob: 0, tau: 0, glasses: [{ boss: 'kacho', m0: 9, m: 9, s: 0, out: false }], evs: [], fx: [], desk: null, fail: null }
function drawTitleArt() {
  tt += 1 / 60
  if (!ta._w) sizeTitleArt(); if (!ta._w) return
  const save = { W, H, DPR, g: { z: G.z, L: G.L, bob: G.bob, tau: G.tau, glasses: G.glasses, evs: G.evs, fx: G.fx, desk: G.desk, fail: G.fail, special: G.special } }
  W = ta._w; H = ta._h
  Object.assign(G, TG, { special: null })
  G.tau = Math.sin(tt * 1.3) * 0.12; G.glasses[0].s = Math.sin(tt * 3.1) * 0.06; G.bob = Math.sin(tt * 4) * 0.3
  tc.setTransform(ta._d, 0, 0, ta._d, 0, 0)
  drawCorridor(tc); drawTray(tc)
  W = save.W; H = save.H; Object.assign(G, save.g)
}

// ---- 画面の出し分け ----
function show(id) { for (const v of ['#vTitle', '#vPlay', '#vEnd']) $(v).hidden = v !== id }
function applyLang() {
  const t = T()
  document.documentElement.lang = lang
  $('#tH').innerHTML = `<span>${t.title[0]}</span><span class="s2">${t.title[1]}</span>`
  $('#tSub').textContent = t.sub; $('#bStartT').textContent = t.start; $('#bHow').textContent = t.how; $('#bLang').textContent = t.lang
  $('#loadTxt').textContent = t.loading; $('#bAgain').textContent = t.again; $('#bSave').textContent = t.save; $('#bPost').textContent = t.post
  $('#howH').textContent = t.howH; $('#howBody').innerHTML = t.howList.map(s => `<li>${s}</li>`).join(''); $('#howClose').textContent = t.close
  $('#howCred').textContent = lang === 'ja' ? '音: Kenney / rubberduck / Neo139 / natalie / Bobjt ほか（CC0・パブリックドメイン）' : 'Sound: Kenney / rubberduck / Neo139 / natalie / Bobjt and others (CC0 / public domain)'
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches
  $('#tutT').textContent = fine ? t.tutM : t.tutT
  let b = 0; try { b = +localStorage.getItem('oc_best') || 0 } catch (e) {}
  $('#tBest').textContent = b ? t.best(b) : ''
  if (G.scene === 'play') drawHud()
  if (G.scene === 'end') drawRes()
}
function setMuteIcons() { for (const s of ['#bMute', '#bMute2']) { const el = $(s); el.querySelector('.wave').style.display = muted ? 'none' : ''; el.querySelector('.x').style.display = muted ? '' : 'none' } }
function toggleMute() { muted = !muted; Snd.setMute(muted); try { localStorage.setItem('oc_mute', muted ? '1' : '0') } catch (e) {} setMuteIcons() }
on('#bMute', () => { Snd.init(); toggleMute() }); on('#bMute2', () => { Snd.init(); toggleMute() })
on('#bLang', () => { lang = lang === 'ja' ? 'en' : 'ja'; try { localStorage.setItem('oc_lang', lang) } catch (e) {} applyLang() })
on('#bHow', () => { sfx('click', { vol: 0.5 }); $('#how').hidden = false })
on('#howClose', () => { $('#how').hidden = true })
$('#how').addEventListener('click', e => { if (e.target.id === 'how') $('#how').hidden = true })
on('#bStart', () => { Snd.init(); sfx('click', { vol: 0.6 }); startGame() })
on('#bAgain', () => { Snd.init(); sfx('click', { vol: 0.6 }); startGame() })
document.addEventListener('pointerdown', () => { if (G.scene === 'title' && !loopsOn.office && $('#loading').style.display === 'none') { Snd.init(); loop('office', 0.25) } }, true)

function hideTut() { const el = $('#tut'); if (!el.hidden) { el.style.opacity = '0'; setTimeout(() => { if (G.tutDone) el.hidden = true }, 400) } }
function startGame() {
  G.scene = 'play'; show('#vPlay'); resize(); reset()
  $('#tut').hidden = false; $('#tut').style.opacity = '1'
  $('#pop').className = ''; G.bub = null; ptr = null
  allLoopsOff(); loop('bgm', 0.2); loop('office', 0.25); loop('clock', 0.12)
  drawHud()
  window.TM && TM.start()
}

// ---- 結果（SNS に貼れる1枚 = 勤務評定） ----
const rankOf = n => { let r = D.RANKS[0]; for (const k of D.RANKS) if (n >= k.min) r = k; return r }
function drawCard(c, Wc, Hc) {
  const t = T(), n = G.served, rk = rankOf(n)
  c.setTransform(1, 0, 0, 1, 0, 0)
  c.fillStyle = '#fbfbf7'; c.fillRect(0, 0, Wc, Hc)
  const Fn = (wt, px) => `${wt} ${px}px "BIZ UDPGothic","Hiragino Sans",sans-serif`
  c.strokeStyle = INK; c.lineWidth = 4; c.strokeRect(40, 40, Wc - 80, Hc - 80)
  c.fillStyle = INK; c.font = Fn(700, 56); c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillText(t.resTitle, 80, 130)
  c.lineWidth = 2; c.beginPath(); c.moveTo(80, 160); c.lineTo(Wc - 80, 160); c.stroke()
  c.fillStyle = '#6b7280'; c.font = Fn(400, 32); c.fillText(t.resN, 84, 225)
  c.fillStyle = INK; c.font = Fn(700, 200); const ns = String(n); c.fillText(ns, 80, 410)
  const nw = c.measureText(ns).width; c.font = Fn(700, 64); c.fillText(t.unit, 96 + nw, 404)
  c.fillStyle = '#d9483b'; c.font = Fn(700, 54); c.fillText(rk[lang], 500, 300)
  // ハンコ
  c.save(); c.translate(Wc - 190, 370); c.rotate(-0.18); c.strokeStyle = '#d9483b'; c.lineWidth = 7; c.beginPath(); c.arc(0, 0, 74, 0, 7); c.stroke(); c.fillStyle = '#d9483b'; c.font = Fn(700, 34); c.textAlign = 'center'; c.fillText(lang === 'ja' ? (n >= 3 ? '可' : '要指導') : (n >= 3 ? 'OK' : 'REDO'), 0, 12); c.restore()
  c.textAlign = 'left'
  c.strokeStyle = 'rgba(42,47,58,.3)'; c.lineWidth = 2; c.beginPath(); c.moveTo(80, 470); c.lineTo(Wc - 80, 470); c.stroke()
  c.fillStyle = '#6b7280'; c.font = Fn(400, 32); c.fillText(t.resLast, 84, 530)
  // 上司
  const B = D.BOSSES[G.lastBoss] || D.BOSSES.kacho, sp = B.sp[G.lastFace] || B.sp.ok
  c.fillStyle = '#eef0ec'; c.fillRect(80, 560, 420, 420)
  c.save(); c.beginPath(); c.rect(80, 560, 420, 420); c.clip(); spr(c, sp, 290, 990, 400); c.restore()
  c.strokeStyle = INK; c.lineWidth = 3; c.strokeRect(80, 560, 420, 420)
  bubbleText(c, G.lastSay || '…', 540, 600, 460, 52)
  // 最後のコップ
  c.strokeStyle = 'rgba(42,47,58,.3)'; c.lineWidth = 2; c.beginPath(); c.moveTo(80, 1030); c.lineTo(Wc - 80, 1030); c.stroke()
  drawCardGlass(c, 230, 1235, 150)
  c.fillStyle = INK; c.font = Fn(700, 44); c.fillText(t.resLeft(G.lastLeft), 380, 1150)
  c.fillStyle = '#6b7280'; c.font = Fn(400, 28); c.fillText('tom3games.com', 380, 1225)
}
function drawCardGlass(c, x, base, w) {
  const h = w * 1.25, botW = w * 0.78, rim = base - h, lineY = base - h * 0.64
  const m0 = (D.BOSSES[G.lastBoss] || D.BOSSES.kacho).m0, lv = lineY - Math.max(0, G.lastLeft) / m0 * (lineY - rim) * 0.92
  const path = () => { c.beginPath(); c.moveTo(x - botW / 2, base); c.lineTo(x - w / 2, rim); c.lineTo(x + w / 2, rim); c.lineTo(x + botW / 2, base); c.closePath() }
  c.save(); path(); c.clip(); c.fillStyle = 'rgba(181,101,29,.82)'; c.fillRect(x - w, G.lastFace === 'mad' ? lineY + 30 : lv, w * 2, h); c.restore()
  path(); c.strokeStyle = INK; c.lineWidth = 5; c.stroke()
  c.strokeStyle = '#d9483b'; c.lineWidth = 5; c.setLineDash([12, 7]); c.beginPath(); c.moveTo(x - w * 0.46, lineY); c.lineTo(x + w * 0.46, lineY); c.stroke(); c.setLineDash([])
}
function bubbleText(c, s, x, y, maxW, px) {
  c.font = `700 ${px}px "BIZ UDPGothic","Hiragino Sans",sans-serif`
  const lines = wrap(c, s, maxW - 60)
  const bw = Math.max(...lines.map(l => c.measureText(l).width)) + 60, bh = lines.length * px * 1.3 + 40
  c.fillStyle = '#fff'; c.strokeStyle = INK; c.lineWidth = 4
  rrect(c, x, y, bw, bh, 18); c.fill(); c.stroke()
  c.beginPath(); c.moveTo(x + 4, y + bh * 0.4); c.lineTo(x - 34, y + bh * 0.62); c.lineTo(x + 4, y + bh * 0.66); c.fill(); c.stroke()
  c.fillStyle = '#fff'; c.fillRect(x + 1, y + bh * 0.4 + 2, 6, bh * 0.25)
  c.fillStyle = INK; c.textAlign = 'left'; lines.forEach((l, i) => c.fillText(l, x + 30, y + 20 + px * 1.05 + i * px * 1.3))
}
function wrap(c, s, maxW) {
  const out = []; let cur = ''
  for (const ch of (lang === 'ja' ? [...s] : s.split(/(?<= )/))) { if (c.measureText(cur + ch).width > maxW && cur) { out.push(cur.trim()); cur = ch } else cur += ch }
  if (cur) out.push(cur.trim()); return out
}
function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath() }
function fitRes() {
  const box = $('#resBox').getBoundingClientRect(), el = $('#res')
  const w = Math.min(box.width, box.height * 0.8)
  el.style.width = w + 'px'; el.style.height = (w * 1.25) + 'px'
}
function drawRes() { const el = $('#res'); drawCard(el.getContext('2d'), el.width, el.height); fitRes() }
function showEnd() {
  G.scene = 'end'; show('#vEnd'); ptr = null
  allLoopsOff(); loop('office', 0.2)
  const n = G.served
  let b = 0; try { b = +localStorage.getItem('oc_best') || 0 } catch (e) {}
  if (n > b) { try { localStorage.setItem('oc_best', String(n)) } catch (e) {} }
  G.result = { n, rank: rankOf(n)[lang], newBest: n > b, trips: G.trips, shouts: G.shouts, creepSips: G.creepSips, elevs: G.elevs, stairs: G.stairsN, shachos: G.shachos, bumps: G.bumps, t: +G.t.toFixed(1) }
  drawRes(); const el = $('#res'); el.classList.remove('in'); void el.offsetWidth; el.classList.add('in')
  window.TM && TM.end(n, n >= 6)
  applyLang()
}
on('#bSave', async () => {
  window.TM && TM.share('save')
  const el = $('#res')
  el.toBlob(async blob => {
    if (!blob) return
    const file = new File([blob], 'ochakumi.png', { type: 'image/png' })
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file] }); return } catch (e) { if (e && e.name === 'AbortError') return } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ochakumi.png'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 1000)
  }, 'image/png')
})
on('#bPost', () => {
  window.TM && TM.share('x')
  const r = G.result || { n: 0, rank: '' }
  const u = 'https://x.com/intent/post?text=' + encodeURIComponent(T().postText(r.n, r.rank)) + '&url=' + encodeURIComponent('https://tom3games.com/play/ochakumi/')
  window.open(u, '_blank', 'noopener')
})

// ---- 読み込み ----
async function boot() {
  applyLang(); setMuteIcons(); resize()
  const list = ['snd/spill1.mp3', 'snd/step1.mp3', 'snd/bump1.mp3', 'snd/click.mp3']
  let done = 0; const total = list.length + 2, bar = $('#loadBar i')
  const tick = () => { done++; bar.style.width = Math.round(done / total * 100) + '%' }
  const img = new Promise(ok => { IMG.onload = () => { imgOk = true; ok() }; IMG.onerror = () => ok(); IMG.src = A.img + '?v=1' }).then(tick)
  const font = (document.fonts ? document.fonts.load('700 20px "BIZ UDPGothic"', 'お茶汲み、こぼすな滴杯0123456789') : Promise.resolve()).catch(() => {}).then(tick)
  const snds = list.map(u => fetch(u).then(r => r.arrayBuffer()).catch(() => {}).then(tick))
  await Promise.race([Promise.all([img, font, ...snds]), new Promise(r => setTimeout(r, 12000))])
  const l = $('#loading'); l.style.opacity = '0'; setTimeout(() => { l.style.display = 'none' }, 380)
  sizeTitleArt()
  window.__ocReady = true
}
requestAnimationFrame(frame)
boot()

// ---- 人の速さで遊ぶ bot（sim と ?demo=1 で使う） ----
// cfg: lag 見てから動くまで（秒）/ err ずれ / gain 戻す強さ / spd 指の速さ（傾き/秒）/ pre ぶつかる前に先に傾ける / shout 声をかける / slosh 波も見る / tapCreep 変なおじさんにも声をかける
function makeBot(cfg, rnd = Math.random) {
  let want = 0, next = 0
  const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 1.15
  return function step(dt) {
    if (G.phase !== 'walk') { want = 0; return }
    if (G.t >= next) {
      next = G.t + (cfg.lag || 0.3)
      const sAvg = G.glasses.length ? G.glasses.reduce((a, g) => a + (g.out ? 0 : g.s), 0) / G.glasses.length : 0
      want = -(G.dDrift + G.dImp) * (cfg.gain || 1) - (cfg.slosh ? sAvg * 0.6 : 0) + gauss() * (cfg.err || 0)
      if (cfg.pre) for (const e of G.evs) {
        const d = e.z - G.z, E = D.EVENTS[e.kind]
        if (e.done || e.hit || e.aside || d < 0 || d > 1.3) continue
        if (['doc', 'yawn'].includes(e.kind) && Math.abs(e.x) < 0.9) want += sgn(e.x) * E.J * 0.8
        if (e.kind === 'golf' && !e.swing) want += e.side * E.J * 0.8
        if (e.kind === 'robot' && Math.abs(e.x) < 1) want -= sgn(e.vx) * E.J * 0.5
      }
      if (cfg.shout) for (const e of G.evs) { const d = e.z - G.z; if (!e.done && !e.aside && D.EVENTS[e.kind].shout && d > 1.5 && d < 5 && (e.kind !== 'creep' || cfg.tapCreep) && rnd() < 0.5) shoutAt(e) }
    }
    const mx = (cfg.spd || 2) * dt
    G.fT = clamp(G.fT + clamp(want - G.fT, -mx, mx), -TUNE.maxTilt, TUNE.maxTilt)
  }
}

// 実機・シミュレーターでの通し確認用（?demo=1）。確認中は鳴らさない
if (/[?&]demo=1/.test(location.search)) {
  muted = true; Snd.setMute(true); setMuteIcons()
  const go = () => {
    if (!window.__ocReady) return setTimeout(go, 200)
    $('#bStart').click()
    const bot = makeBot({ lag: 0.4, err: 0.03, gain: 1, spd: 2, pre: true, shout: true })
    const r = cv.getBoundingClientRect(); let down = false, x0 = r.left + r.width / 2
    const tick = () => {
      if (G.scene !== 'play') return
      const save = G.fT; bot(1 / 30); const want = G.fT; G.fT = save
      if (!down) { cv.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x0, clientY: r.top + r.height * 0.9, pointerId: 9, pointerType: 'touch' })); down = true; x0 -= save / TUNE.fingerK * W }
      cv.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x0 + want / TUNE.fingerK * W, clientY: r.top + r.height * 0.9, pointerId: 9, pointerType: 'touch' }))
      setTimeout(tick, 33)
    }
    tick()
  }
  go()
}

// ---- 検証用の窓口 ----
window.oc = {
  G, D, TUNE, start: startGame, result: () => G.result, rankOf, makeBot, shoutAt, lang: () => lang,
  state: () => ({ scene: G.scene, phase: G.phase, t: +G.t.toFixed(2), served: G.served, misses: G.misses, trips: G.trips, z: +G.z.toFixed(2), L: +G.L.toFixed(1), tau: +G.tau.toFixed(3), fT: +G.fT.toFixed(3), glasses: G.glasses.map(g => ({ boss: g.boss, m: +g.m.toFixed(2), out: g.out })), bub: G.bub && G.t < G.bubUntil ? G.bub.text : null, evs: G.evs.map(e => ({ kind: e.kind, d: +(e.z - G.z).toFixed(1), aside: e.aside, hit: !!e.hit })) }),
  evXY: kind => { const e = G.evs.find(e => e.kind === kind && e.box && !e.done); if (!e) return null; const r = cv.getBoundingClientRect(); return { x: r.left + (e.box.x0 + e.box.x1) / 2, y: r.top + (e.box.y0 * 0.4 + e.box.y1 * 0.6) } },
  dbg: {
    pause(b = true) { G.paused = b; lastT = performance.now(); acc = 0 },
    step(n = 1) { for (let i = 0; i < n; i++) update(1 / 60); render() },
    tick(n = 1) { for (let i = 0; i < n; i++) update(1 / 60) },
    seed(s) { seedV = (s % 2147483646) + 1 },
    calm() { G.driftV = 0; G.driftNext = 1e9; G.dDrift = 0 },
    arrive() { G.z = G.L; update(1 / 60) },
    finish() { G.misses = D.MISSES - 1; const g = G.glasses.find(g => !g.out); if (g) { g.m = -1; checkOut() } this.tick(200) },
    put(kind, d, side = -1) { const e = mkEv(kind, G.z + d); e.side = side; e.x = side * (kind === 'golf' ? 0.85 : kind === 'mop' ? 1.15 : kind === 'robot' ? 1.3 : 0.5); if (kind === 'robot') e.vx = -side * 0.9; G.evs.push(e); return e },
    render, drawRes,
  },
}
})()
