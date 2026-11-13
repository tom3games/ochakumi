// お茶汲み、こぼすな（ochakumi）の文言とデータ。仕様の正本: ~/Desktop/claudecode/ideas/ochakumi.md
const OC_DATA = {
  MISSES: 2,
  // この杯数を届けたら定時（クリア）。2026-11-13 本人「むずい」で終わりを作った
  GOAL: 8,
  // 上司。sp は絵（ok / meh / mad）、m0 は線から上の滴の数、pts は届けた時の点
  BOSSES: {
    kacho: { sp: { ok: 'kacho_ok', meh: 'kacho_meh', mad: 'kacho_mad' }, m0: 9, pts: 1, ja: '課長', en: 'the manager',
      say: { ja: { full: 'うむ。満タンだな', mid: '…ちょっと減ってない？', low: '線ギリギリじゃないか', miss: '入れ直してこい' }, en: { full: 'Good. Full to the line.', mid: '...Is this a bit low?', low: 'Right at the line, huh', miss: 'Pour it again.' } } },
    bucho: { sp: { ok: 'bucho', meh: 'bucho', mad: 'bucho' }, m0: 9, pts: 1, ja: '部長', en: 'the director',
      say: { ja: { full: 'ご苦労さま', mid: 'ふーん', low: 'これ、半分飲んだ？', miss: '床、拭いといて' }, en: { full: 'Thank you.', mid: 'Hm.', low: 'Did you drink half?', miss: 'Mop the floor.' } } },
    shacho: { sp: { ok: 'shacho_ok', meh: 'shacho_ok', mad: 'shacho_mad' }, m0: 5, pts: 3, ja: '社長', en: 'the CEO',
      say: { ja: { full: '君、名前は？', mid: 'うむ', low: '…', miss: '見たね？' }, en: { full: 'What is your name, kid?', mid: 'Mm.', low: '...', miss: 'You saw that, didn’t you.' } } },
  },
  // 廊下で起きること。J はお盆が傾く強さ、slosh は波の強さ
  EVENTS: {
    doc: { sp: 'doc', walk: 0.9, J: 0.34, slosh: 0.5, shout: 1 },
    yawn: { sp: 'yawn', walk: 0.6, J: 0.38, slosh: 0.6, shout: 1 },
    golf: { sp: 'golf', walk: 0, J: 0.3, slosh: 0.8, shout: 1 },
    sneeze: { sp: 'sneezer', walk: 0.4, J: 0.12, slosh: 1.6 },
    mop: { sp: 'mop', walk: 0, J: 0.44, slosh: 0.7, wet: 1 },
    robot: { sp: 'robot', walk: 0, J: 0.24, slosh: 0.5, cross: 1 },
    creep: { sp: 'creep', walk: 0.7, J: 0, slosh: 0, rare: 1, shout: 1 },
  },
  RANKS: [
    { min: 0, ja: '床を拭く係', en: 'Floor mopper' },
    { min: 1, ja: '見習いお茶汲み', en: 'Tea trainee' },
    { min: 3, ja: '給湯室の新人', en: 'Kitchenette rookie' },
    { min: 6, ja: 'お茶汲み主任', en: 'Chief of tea' },
  ],
  // 定時まで運べた時（こぼさず＝入れ直し0回）
  CLEAR: { ja: '定時退社の新人', en: 'Home on time' },
  CLEAR0: { ja: 'こぼさない新人', en: 'Never spills' },
  TXT: {
    ja: {
      title: ['お茶汲み、', 'こぼすな'], sub: '満タンの麦茶を上司のデスクまで', start: '運ぶ', how: '遊び方', lang: 'English',
      loading: 'お茶を注いでいます', best: n => `自己ベスト ${n}杯`,
      tutT: '指を左右に動かして、お盆の傾きを戻す', tutM: 'ドラッグで左右に動かして、お盆の傾きを戻す',
      howH: '遊び方',
      howList: [
        '<b>指を左右に動かす</b>とお盆が同じ向きに傾く。傾いたら反対へ戻して水平に。',
        'コップの<b>赤い線より下まで減ったらやり直し</b>。2回で終わり。左上の数字はあと何滴こぼせるか。',
        '<b>8杯届けたら定時</b>。最初は腕も元気。だんだん疲れて傾きやすくなる。',
        'ぶつかってくる人は<b>タップで声をかけるとよける</b>。ただし変なおじさんに声をかけると一口飲まれる。',
        '途中からコップが増える。たまに社長（3杯分・あと5滴しかない）。',
      ],
      close: 'とじる', again: 'もう一回', save: '画像を保存', post: 'Xでポスト',
      order: (b, n) => n > 1 ? `${b}ほか ${n}杯` : `${b}へ 1杯`,
      drops: '滴', left: 'あと', out: 'アウト', shout: 'お茶です！', creep: 'デュフフ、いただきます',
      sneezeT: 'はっ…', slip: 'すべった', elevator: 'エレベーター', stairs: '階段',
      prog: (d, g) => `${d}/${g}杯 定時まで`, clear: '定時です。おつかれさま', stamp: ['定時', '可', '要指導'],
      unit: '杯', resTitle: 'お茶汲み 勤務評定', resN: '運んだ杯数', resLast: '最後の上司のひとこと', resLeft: n => `最後のコップ あと${n}滴`,
      postText: (n, r, c) => c ? `お茶を${n}杯運んで定時で帰った。「${r}」 #お茶汲みこぼすな #ひまつぶし横丁` : `お茶を${n}杯こぼさず運んだ。「${r}」 #お茶汲みこぼすな #ひまつぶし横丁`,
    },
    en: {
      title: ['Don’t Spill', 'the Tea'], sub: 'Carry a brim-full glass to the boss', start: 'Carry', how: 'How to play', lang: '日本語',
      loading: 'Pouring the tea', best: n => `Best: ${n}`,
      tutT: 'Slide your finger left and right to level the tray', tutM: 'Drag left and right to level the tray',
      howH: 'How to play',
      howList: [
        '<b>Slide your finger</b> and the tray tilts the same way. Tilt it back to keep it level.',
        '<b>Drop below the red line and you start over.</b> Twice and you are out. The number shows how many drops you can still spill.',
        '<b>Serve 8 and it is 5 pm.</b> Your arms start fresh and tire as the day goes on.',
        '<b>Tap people</b> who are about to bump you and they step aside. Do not tap the weird guy. He takes a sip.',
        'Later you carry more glasses. Sometimes the CEO (worth 3, only 5 drops to spare).',
      ],
      close: 'Close', again: 'Again', save: 'Save image', post: 'Post on X',
      order: (b, n) => n > 1 ? `${n} glasses` : `To ${b}`,
      drops: 'drops', left: '', out: 'OUT', shout: 'Tea coming!', creep: 'Heh heh, just a sip',
      sneezeT: 'Ah...', slip: 'Slipped', elevator: 'Elevator', stairs: 'Stairs',
      prog: (d, g) => `${d}/${g} till 5pm`, clear: '5 pm. You can go home.', stamp: ['5 PM', 'OK', 'REDO'],
      unit: '', resTitle: 'Tea Duty Review', resN: 'Glasses served', resLast: 'The boss said', resLeft: n => `Last glass: ${n} to spare`,
      postText: (n, r, c) => c ? `Served ${n} glasses of tea and went home at 5. "${r}" #DontSpillTheTea` : `Served ${n} glasses of tea without spilling. "${r}" #DontSpillTheTea`,
    },
  },
}
