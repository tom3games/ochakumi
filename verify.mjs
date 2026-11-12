import './mute-auto.mjs'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// お茶汲み、こぼすなの検証。node verify.mjs
import { chromium, webkit } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
const ROOT = import.meta.dirname
mkdirSync(ROOT + '/shots', { recursive: true })
const PORT = +(process.env.VPORT || 6624)
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const URL0 = `http://localhost:${PORT}/`
let pass = 0, fail = 0
const results = []
async function t(name, fn) {
  try { const r = await fn(); if (r === false) throw new Error('false'); pass++; results.push(`ok   ${name}${r && r !== true ? '  ' + JSON.stringify(r) : ''}`) }
  catch (e) { fail++; results.push(`FAIL ${name}  ${e.message.split('\n')[0]}`) }
}
const expect = (c, msg) => { if (!c) throw new Error(msg) }
async function open(browser, opts = {}) {
  const ctx = await browser.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  await ctx.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  const p = await ctx.newPage(); p.errs = []
  p.on('pageerror', e => p.errs.push('pageerror ' + e.message))
  p.on('console', m => { if (m.type() === 'error') p.errs.push('console ' + m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)|googletagmanager/.test(r.url())) p.errs.push('reqfail ' + r.url()) })
  await p.goto(URL0); await p.waitForFunction(() => window.__ocReady, null, { timeout: 15000 })
  return p
}
const overflow = p => p.evaluate(() => {
  const W = document.documentElement.clientWidth, bad = []
  for (const el of document.querySelectorAll('main:not([hidden]) *')) {
    if (el.closest('[hidden]') || (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true }))) continue
    if (el.closest('#bub,#pop')) continue
    const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) bad.push((el.id || el.className || el.tagName) + ':' + Math.round(r.left) + '-' + Math.round(r.right))
  }
  return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 5) }
})
const fit = q => q.evaluate(() => {
  const H = innerHeight, de = document.documentElement, over = []
  if (de.scrollHeight > H + 1) over.push('page:' + de.scrollHeight)
  for (const el of document.querySelectorAll('main:not([hidden]) button,main:not([hidden]) canvas,main:not([hidden]) a,.ovl:not([hidden]) button,#tmSupport,#tmHome')) { if (!el.offsetParent && el.id !== 'tmSupport') continue; const r = el.getBoundingClientRect(); if (!r.height) continue; if (r.bottom > H + 1 || r.top < -1) over.push((el.id || el.className) + ':' + Math.round(r.top) + '-' + Math.round(r.bottom)) }
  return { H, over: over.slice(0, 6) }
})
const variance = (p, sel) => p.evaluate(sel => {
  const c = document.querySelector(sel), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
  let s = 0, s2 = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 13) { const v = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; s += v; s2 += v * v; n++ }
  return Math.round(s2 / n - (s / n) ** 2)
}, sel)
const SIZES = [[360, 640, 'small'], [375, 667, 'se'], [390, 844, 'phone'], [412, 915, 'android'], [430, 932, 'max'], [768, 1024, 'tablet']]
const HUMAN = "{ lag: 0.45, err: 0.03, gain: 1, spd: 2, pre: true }"
const EXPERT = "{ lag: 0.25, err: 0.015, gain: 1, spd: 2.5, pre: true, shout: true, slosh: true }"

const browser = await chromium.launch(MUTE_LAUNCH)
const p = await open(browser)
await t('起動時にエラーが出ない', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await t('ブラウザの拡大が起きない（viewport・ピンチ・Ctrl+ホイール・Ctrl+プラス）', async () => {
  const r = await p.evaluate(() => {
    const vp = document.querySelector('meta[name=viewport]').content
    const g = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(g)
    const w = new WheelEvent('wheel', { ctrlKey: true, deltaY: -10, bubbles: true, cancelable: true }); window.dispatchEvent(w)
    const k = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true, cancelable: true }); window.dispatchEvent(k)
    return { vp, gesture: g.defaultPrevented, wheel: w.defaultPrevented, key: k.defaultPrevented, ta: getComputedStyle(document.documentElement).touchAction, us: getComputedStyle(document.body).userSelect }
  })
  expect(/user-scalable=no/.test(r.vp) && r.gesture && r.wheel && r.key && r.ta === 'manipulation' && r.us === 'none', JSON.stringify(r)); return r
})
await t('OGP 一式がある', async () => {
  const r = await p.evaluate(() => ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'].map(k => !!document.querySelector(`meta[property="${k}"]`)).concat(!!document.querySelector('meta[name="twitter:card"]')))
  expect(r.every(Boolean), JSON.stringify(r))
})
await t('ロード画面が消えて、タイトルの絵が描けている', async () => {
  await p.waitForTimeout(500)
  const r = await p.evaluate(() => ({ load: getComputedStyle(document.querySelector('#loading')).display, title: document.querySelector('#tH').textContent }))
  const v = await variance(p, '#tArt')
  expect(r.load === 'none' && r.title.includes('こぼすな') && v > 200, JSON.stringify({ ...r, v })); return { v }
})
await t('はじめると遊ぶ画面・音を鳴らす呼び出しがある・それでも実際は無音', async () => {
  await p.click('#bStart'); await p.waitForTimeout(300)
  const r = await p.evaluate(() => ({ scene: oc.state().scene, click: Snd.played.click || 0, mute: window.__muteOk() }))
  expect(r.scene === 'play' && r.click >= 1 && r.mute, JSON.stringify(r)); return r
})
await t('固定60Hz: 実時間1秒でゲーム時間も約1秒', async () => {
  const r = await p.evaluate(async () => { oc.dbg.pause(false); const t0 = oc.G.t, p0 = performance.now(); await new Promise(r => setTimeout(r, 1500)); return { dg: oc.G.t - t0, dr: (performance.now() - p0) / 1000 } })
  const k = r.dg / r.dr
  expect(k > 0.9 && k < 1.05, JSON.stringify(r)); return { ratio: +k.toFixed(3) }
})
await t('本物の指（マウス）: 右へドラッグでお盆が右へ、左へで左へ傾く', async () => {
  await p.evaluate(() => { oc.dbg.seed(3); oc.start(); oc.dbg.pause(); oc.G.evs = []; oc.dbg.calm(); oc.TUNE.sag0 = oc.TUNE.sag; oc.TUNE.sag = 0 })
  await p.mouse.move(195, 760); await p.mouse.down()
  for (let i = 1; i <= 8; i++) await p.mouse.move(195 + i * 6, 760)
  await p.evaluate(() => oc.dbg.tick(20))
  const a = await p.evaluate(() => oc.state())
  for (let i = 1; i <= 16; i++) await p.mouse.move(243 - i * 6, 760)
  await p.evaluate(() => oc.dbg.tick(20))
  const b = await p.evaluate(() => oc.state())
  await p.mouse.up(); await p.evaluate(() => { oc.TUNE.sag = oc.TUNE.sag0 })
  expect(a.tau > 0.1 && b.tau < -0.1, JSON.stringify({ a: a.tau, b: b.tau })); return { right: a.tau, left: b.tau }
})
await t('何もしないとお盆が傾いてこぼれ、アウトになる', async () => {
  const r = await p.evaluate(() => { oc.dbg.seed(5); oc.start(); oc.dbg.pause(); let f = 0; while (oc.G.misses === 0 && f++ < 60 * 30) oc.dbg.tick(1); return { ...oc.state(), sec: f / 60, pop: document.querySelector('#pop').textContent } })
  expect(r.misses === 1 && r.sec < 14 && r.pop === 'アウト', JSON.stringify(r)); return { sec: +r.sec.toFixed(1) }
})
await t('近づく人を本物のタップで呼ぶと、よけてくれる（ぶつからない）', async () => {
  await p.evaluate(() => { oc.dbg.seed(6); oc.start(); oc.dbg.pause(); oc.G.evs = []; oc.dbg.calm(); oc.dbg.put('doc', 4, -1); oc.dbg.step(2) })
  const xy = await p.evaluate(() => oc.evXY('doc'))
  await p.mouse.click(xy.x, xy.y)
  const r = await p.evaluate(() => { const before = oc.G.bumps; oc.dbg.tick(60 * 4); return { ...oc.state(), bumps: oc.G.bumps - before, shouts: oc.G.shouts } })
  expect(xy && r.shouts === 1 && r.bumps === 0, JSON.stringify({ xy, r })); return { shouts: r.shouts }
})
await t('呼ばなければ肩がぶつかって揺れる', async () => {
  const r = await p.evaluate(() => { oc.dbg.seed(6); oc.start(); oc.dbg.pause(); oc.G.evs = []; oc.dbg.calm(); oc.dbg.put('doc', 4, -1); const b = oc.G.bumps; oc.dbg.tick(60 * 4); return { bumps: oc.G.bumps - b } })
  expect(r.bumps === 1, JSON.stringify(r)); return r
})
await t('変なおじさんを呼ぶと一口飲まれる（2滴減る）', async () => {
  await p.evaluate(() => { oc.dbg.seed(7); oc.start(); oc.dbg.pause(); oc.G.evs = []; oc.dbg.calm(); oc.dbg.put('creep', 4, 1); oc.dbg.step(2) })
  const m0 = await p.evaluate(() => oc.G.glasses[0].m)
  const xy = await p.evaluate(() => oc.evXY('creep'))
  await p.mouse.click(xy.x, xy.y)
  const r = await p.evaluate(() => ({ m: oc.G.glasses[0].m, sips: oc.G.creepSips, bub: oc.state().bub }))
  expect(r.sips === 1 && Math.abs(m0 - r.m - 2) < 0.2, JSON.stringify({ m0, r })); return r.bub
})
await t('デスクに着くと上司がひとこと言い、次の運びが始まる', async () => {
  const r = await p.evaluate(() => { oc.dbg.seed(8); oc.start(); oc.dbg.pause(); oc.dbg.arrive(); oc.dbg.step(2); const said = oc.state().bub, served = oc.G.served; oc.dbg.tick(200); return { said, served, trips: oc.G.trips, phase: oc.G.phase } })
  expect(r.said === 'うむ。満タンだな' && r.served === 1 && r.trips === 2 && r.phase === 'walk', JSON.stringify(r)); return r.said
})
await t('2回アウトで勤務評定が出る（称号・ボタン・支援リンク）', async () => {
  await p.evaluate(() => { oc.dbg.seed(9); oc.start(); oc.dbg.pause(); for (let i = 0; i < 4; i++) { oc.dbg.arrive(); oc.dbg.tick(200) } oc.dbg.finish(); oc.dbg.tick(200); oc.dbg.finish(); oc.dbg.tick(400) })
  const r = await p.evaluate(() => ({ s: oc.state(), res: oc.result(), btn: document.querySelector('#bAgain').textContent, sup: !!document.querySelector('#tmSupport') }))
  const v = await variance(p, '#res')
  await p.waitForTimeout(700); await p.screenshot({ path: `${ROOT}/shots/v-end.png` })
  expect(r.s.scene === 'end' && r.res && r.res.n >= 4 && r.btn === 'もう一回' && r.sup && v > 300, JSON.stringify({ ...r, v })); return { n: r.res.n, rank: r.res.rank, v }
})
await t('自己ベストが残る', async () => { const r = await p.evaluate(() => localStorage.getItem('oc_best')); expect(+r >= 4, r); return r })
await t('もう一回で最初から（0杯・ミス0）', async () => {
  await p.click('#bAgain'); await p.waitForTimeout(200)
  const r = await p.evaluate(() => oc.state())
  expect(r.scene === 'play' && r.served === 0 && r.misses === 0 && r.trips === 1, JSON.stringify(r)); return r.phase
})
await t('何もしない通しは最低の称号（床を拭く係）', async () => {
  const rs = await p.evaluate(() => { const out = []; for (let s = 1; s <= 6; s++) { oc.dbg.seed(s * 31); oc.start(); oc.dbg.pause(); let f = 0; while (oc.G.scene === 'play' && f++ < 60 * 120) oc.dbg.tick(1); out.push({ n: oc.G.served, rank: oc.rankOf(oc.G.served).ja, scene: oc.G.scene }) } return out })
  expect(rs.every(r => r.rank === '床を拭く係' && r.scene === 'end'), JSON.stringify(rs)); return rs.map(r => r.n).join(',')
})
await t('同じ種と同じ操作なら同じ結果（3回）', async () => {
  const rs = await p.evaluate((H) => { const out = []; for (let i = 0; i < 3; i++) { oc.dbg.seed(4242); oc.start(); oc.dbg.pause(); let r0 = 9; const Rb = () => (r0 = r0 * 16807 % 2147483647) / 2147483647; const bot = oc.makeBot(eval('(' + H + ')'), Rb); let f = 0; while (oc.G.scene === 'play' && f++ < 60 * 400) { bot(1 / 60); oc.dbg.tick(1) } out.push(oc.G.served + '/' + oc.G.t.toFixed(2)) } return out }, HUMAN)
  expect(rs[0] === rs[1] && rs[1] === rs[2] && +rs[0].split('/')[0] > 0, JSON.stringify(rs)); return rs[0]
})
await t('人の速さの bot は最初の1杯を運べる（12回中10回以上）', async () => {
  const rs = await p.evaluate((H) => { const out = []; for (let s = 1; s <= 12; s++) { oc.dbg.seed(s * 77 + 1); oc.start(); oc.dbg.pause(); let r0 = s * 99 + 5; const Rb = () => (r0 = r0 * 16807 % 2147483647) / 2147483647; const bot = oc.makeBot(eval('(' + H + ')'), Rb); let f = 0; while (oc.G.scene === 'play' && oc.G.served === 0 && oc.G.misses === 0 && f++ < 60 * 60) { bot(1 / 60); oc.dbg.tick(1) } out.push(oc.G.served > 0) } return out }, HUMAN)
  expect(rs.filter(Boolean).length >= 10, JSON.stringify(rs)); return rs.filter(Boolean).length
})
await t('上手い操作（先読み・声かけ・なめらか）が、雑に大きく動かすより運ぶ', async () => {
  const r = await p.evaluate((E) => { const run = cfg => { let sum = 0; for (let s = 1; s <= 8; s++) { oc.dbg.seed(s * 53 + 3); oc.start(); oc.dbg.pause(); let r0 = s * 7 + 1; const Rb = () => (r0 = r0 * 16807 % 2147483647) / 2147483647; const bot = oc.makeBot(cfg, Rb); let f = 0; while (oc.G.scene === 'play' && f++ < 60 * 400) { bot(1 / 60); oc.dbg.tick(1) } sum += oc.G.served } return sum / 8 }; return { good: run(eval('(' + E + ')')), jerky: run({ lag: 0.15, err: 0.05, gain: 2.2, spd: 9 }) } }, EXPERT)
  expect(r.good >= 3 && r.good > r.jerky * 2, JSON.stringify(r)); return r
})
await t('文字は同時に1つまで（吹き出しと大きい文字が重ならない）', async () => {
  const r = await p.evaluate((H) => { oc.dbg.seed(5); oc.start(); oc.dbg.pause(); let r0 = 7; const Rb = () => (r0 = r0 * 16807 % 2147483647) / 2147483647; const bot = oc.makeBot(eval('(' + H + ')'), Rb); let both = 0, bubs = 0, f = 0; while (oc.G.scene === 'play' && f++ < 60 * 300) { bot(1 / 60); oc.dbg.tick(1); if (f % 6 === 0) { oc.dbg.render(); const b = document.querySelector('#bub').classList.contains('on'), pp = oc.G.t < oc.G.popUntil; if (b) bubs++; if (b && pp) both++ } } return { both, bubs } }, HUMAN)
  expect(r.both === 0 && r.bubs > 5, JSON.stringify(r)); return r
})
await t('声かけ・エレベーター・階段・社長・2杯以上・おじさんが通しの中で起きる', async () => {
  const r = await p.evaluate(() => { const seen = { shout: 0, elev: 0, stairs: 0, shacho: 0, multi: 0, sip: 0 }; for (let s = 1; s <= 8; s++) { oc.dbg.seed(s * 13); oc.start(); oc.dbg.pause(); let r0 = s; const Rb = () => (r0 = r0 * 16807 % 2147483647) / 2147483647; const bot = oc.makeBot({ lag: 0.25, err: 0.015, gain: 1, spd: 2.5, pre: true, shout: true, slosh: true, tapCreep: s % 2 === 0 }, Rb); let f = 0; while (oc.G.scene === 'play' && f++ < 60 * 400) { bot(1 / 60); oc.dbg.tick(1); if (oc.G.glasses.length > 1) seen.multi = 1 } const g = oc.G; seen.shout += g.shouts; seen.elev += g.elevs; seen.stairs += g.stairsN; seen.shacho += g.shachos; seen.sip += g.creepSips } return seen })
  expect(Object.values(r).every(v => v > 0), JSON.stringify(r)); return r
})
await t('ページを離れたら BGM と環境音が止まる', async () => {
  const r = await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); return { away: Snd.away, playing: Snd.playing().length, hide: Snd.life.hide } })
  await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }) })
  expect(r.away && r.playing === 0 && r.hide >= 1, JSON.stringify(r)); return r
})
await t('英語に切り替えると文言が英語・結果も英語', async () => {
  const q = await open(browser)
  await q.click('#bLang')
  const a = await q.evaluate(() => ({ h: document.querySelector('#tH').textContent, b: document.querySelector('#bStartT').textContent }))
  await q.click('#bStart'); await q.evaluate(() => { oc.dbg.pause(); oc.dbg.arrive(); oc.dbg.tick(200); oc.dbg.finish(); oc.dbg.tick(200); oc.dbg.finish(); oc.dbg.tick(400) })
  const r = await q.evaluate(() => ({ rank: oc.result().rank, again: document.querySelector('#bAgain').textContent }))
  await q.waitForTimeout(700); await q.screenshot({ path: `${ROOT}/shots/v-end-en.png` })
  await q.close()
  expect(a.h.includes('Spill') && a.b === 'Carry' && r.rank === 'Tea trainee' && r.again === 'Again', JSON.stringify({ a, r })); return { a, r }
})
await t('遊び方が開いて閉じる', async () => {
  const q = await open(browser)
  await q.click('#bHow'); const a = await q.evaluate(() => !document.querySelector('#how').hidden && document.querySelectorAll('#howBody li').length)
  await q.click('#howClose'); const b = await q.evaluate(() => document.querySelector('#how').hidden)
  await q.close(); expect(a === 4 && b, JSON.stringify({ a, b }))
})
await t('X 内ブラウザ（?inapp=x）: 下52pxに操作が入らない', async () => {
  const q = await open(browser)
  await q.goto(URL0 + '?inapp=x'); await q.waitForFunction(() => window.__ocReady)
  const r = await q.evaluate(() => { const H = innerHeight, bad = []; for (const el of document.querySelectorAll('#vTitle button')) { const b = el.getBoundingClientRect(); if (b.height && b.bottom > H - 52) bad.push(el.id + ':' + Math.round(b.bottom)) } return { H, bad, cls: document.documentElement.className } })
  await q.close(); expect(!r.bad.length && /inapp-x/.test(r.cls), JSON.stringify(r)); return r
})
await t('全体でエラーなし', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await p.close()

for (const [w, h, name] of SIZES) {
  const q = await open(browser, { viewport: { width: w, height: h } })
  const views = {}
  await q.waitForTimeout(600); views.title = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-title.png` })
  await q.click('#bHow'); views.how = await fit(q); await q.click('#howClose')
  await q.click('#bStart'); await q.evaluate(() => { oc.dbg.pause(); oc.dbg.seed(9); oc.start(); oc.dbg.pause(); oc.dbg.calm(); oc.dbg.put('doc', 3, -1); oc.dbg.step(40) })
  views.play = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-play.png` })
  await q.evaluate(() => { for (let i = 0; i < 6; i++) { oc.dbg.arrive(); oc.dbg.tick(200) } oc.dbg.finish(); oc.dbg.tick(200); oc.dbg.finish(); oc.dbg.tick(400) })
  await q.waitForTimeout(700)
  views.end = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-end.png` })
  for (const [v, r] of Object.entries(views)) await t(`一画面に収まる ${name} ${w}x${h} ${v}`, async () => { expect(!r.over.length, JSON.stringify(r)) })
  await t(`${name}: はみ出し・エラーなし`, async () => { const o = await overflow(q); expect(o.sw <= o.W && !o.bad.length && !q.errs.length, JSON.stringify(o) + q.errs.join('|')) })
  await q.close()
}
await browser.close()
const wb = await webkit.launch(), wp = await open(wb, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
await t('WebKit: 2本指の touchmove を止める', async () => {
  const r = await wp.evaluate(() => { const e = new Event('touchmove', { cancelable: true, bubbles: true }); Object.defineProperty(e, 'touches', { value: [{}, {}] }); document.body.dispatchEvent(e); return e.defaultPrevented })
  expect(r, r)
})
await t('WebKit: タップで始めて bot で通し、結果まで行ける・無音', async () => {
  await wp.tap('#bStart'); await wp.waitForTimeout(300)
  const r = await wp.evaluate((H) => { oc.dbg.pause(); oc.dbg.seed(3); oc.start(); oc.dbg.pause(); let r0 = 3; const Rb = () => (r0 = r0 * 16807 % 2147483647) / 2147483647; const bot = oc.makeBot(eval('(' + H + ')'), Rb); let f = 0; while (oc.G.scene === 'play' && f++ < 60 * 400) { bot(1 / 60); oc.dbg.tick(1) } return { scene: oc.G.scene, n: oc.G.served, mute: window.__muteOk() } }, EXPERT)
  await wp.waitForTimeout(700); await wp.screenshot({ path: `${ROOT}/shots/v-webkit-end.png` })
  expect(r.scene === 'end' && r.n > 0 && r.mute, JSON.stringify(r)); return r
})
await t('WebKit: 本物のタッチ（pointer）でお盆が傾く', async () => {
  await wp.evaluate(() => { oc.start(); oc.dbg.pause(); oc.G.evs = []; oc.dbg.calm(); oc.TUNE.sag = 0 })
  await wp.evaluate(() => { const cv = document.querySelector('#cv'); cv.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 195, clientY: 760, pointerId: 3, pointerType: 'touch' })); cv.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 255, clientY: 760, pointerId: 3, pointerType: 'touch' })) })
  const r = await wp.evaluate(() => { oc.dbg.tick(20); return oc.state().tau })
  expect(r > 0.1, String(r)); return r
})
await t('WebKit: エラーなし', async () => { expect(wp.errs.length === 0, wp.errs.join('|')) })
await wb.close()
server.kill()
console.log(results.join('\n'))
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
