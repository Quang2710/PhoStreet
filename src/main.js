import './style.css';
import { INGREDIENTS, RECIPES, LEVELS, STATE_ICON } from './data.js';
import { Audio } from './audio.js';
import { Game } from './game.js';
import { mountOrnaments, icon } from './ornaments.js';

// tiện debug trong console khi chạy npm run dev
if (import.meta.env.DEV) window.Game = Game;

// Tranh minh hoạ cho tem bưu chính của từng màn (chỉ dùng ở giao diện)
const ART = {
  hanoi:    { sky: '#f8cf98', sky2: '#ec9461', sun: '#fff3cf', ground: '#7a3f2a', tag: 'Phố cổ' },
  mientay:  { sky: '#b6e6f2', sky2: '#64bad8', sun: '#fff6cf', ground: '#1f6f8f', tag: 'Sông nước' },
  benthanh: { sky: '#ffe0a6', sky2: '#f5a25c', sun: '#fff2c8', ground: '#55524e', tag: 'Sài Gòn' },
  tet:      { sky: '#6d2141', sky2: '#2c0e25', sun: '#ffd54f', ground: '#9b1c1c', tag: 'Giao thừa', dark: true },
  sapa:     { sky: '#e6eef0', sky2: '#a7bcc4', sun: '#ffffff', ground: '#3f6a3a', tag: 'Tây Bắc' },
};
// tâm trạng khách theo phần thời gian chờ còn lại
const MOODS = [[0.6, 'ok', '🙂'], [0.35, 'meh', '😒'], [0.15, 'mad', '😠'], [-1, 'rage', '🤬']];
const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// Chạy lại animation CSS: gỡ class, ép reflow, gắn lại
function bump(el, cls, ...others) {
  el.classList.remove(cls, ...others);
  void el.offsetWidth;
  el.classList.add(cls);
}

// ===== Giao diện: menu, HUD, kết quả =====
(() => {
  const $ = id => document.getElementById(id);
  let mode = 'coop', current = 0, previewIdx = 0;
  const BEST_KEY = 'phoLoanPho.best';
  const SCREENS = ['menu', 'pause', 'result'];

  function loadBest() { try { return JSON.parse(localStorage.getItem(BEST_KEY)) || {}; } catch (e) { return {}; } }
  function saveBest(b) { try { localStorage.setItem(BEST_KEY, JSON.stringify(b)); } catch (e) { /* bỏ qua */ } }

  mountOrnaments();
  // biển hiệu và nhãn thùng trong cảnh 3D vẽ chữ bằng canvas:
  // nếu font web (kể cả bộ dấu tiếng Việt) tải xong sau lần dựng đầu thì dựng lại cảnh xem trước
  let fontT = 0;
  document.fonts?.addEventListener('loadingdone', e => {
    if (!e.fontfaces.some(f => /Phudu|Be Vietnam Pro/.test(f.family))) return;
    clearTimeout(fontT);
    fontT = setTimeout(() => swapPreview(previewIdx), 150);
  });
  Game.init($('game'), $('overlay'));
  Game.preview(0);

  function show(id) {
    for (const s of SCREENS) {
      const el = $(s), on = s === id;
      el.classList.toggle('open', on);
      el.inert = !on;
    }
    if (!id && document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  }
  show('menu');

  // ---------- XEM TRƯỚC MÀN (cảnh 3D phía sau menu) ----------
  let hoverT = 0, swapT = 0;
  function swapPreview(i) {
    if (Game.state !== 'preview') return;
    previewIdx = i;
    $('levels').querySelectorAll('.lvcard').forEach(c => c.classList.toggle('cur', +c.dataset.i === i));
    const cv = $('game');
    cv.classList.add('swap');
    clearTimeout(swapT);
    // làm mờ cảnh cũ rồi mới dựng cảnh mới để không bị giật
    swapT = setTimeout(() => {
      if (Game.state === 'preview') Game.preview(i);
      requestAnimationFrame(() => requestAnimationFrame(() => cv.classList.remove('swap')));
    }, 130);
  }
  function hoverPreview(i) {
    clearTimeout(hoverT);
    if (i !== previewIdx) hoverT = setTimeout(() => swapPreview(i), 110);
  }

  // ---------- MENU ----------
  function renderLevels() {
    const best = loadBest();
    $('levels').innerHTML = LEVELS.map((lv, i) => {
      const b = best[lv.id] || { stars: 0, score: 0 };
      const a = ART[lv.id] || ART.hanoi;
      return `<button type="button" class="lvcard${i === previewIdx ? ' cur' : ''}" data-i="${i}"${a.dark ? ' data-dark' : ''}
          style="--i:${i + 4};--sky:${a.sky};--sky2:${a.sky2};--sun:${a.sun};--ground:${a.ground}" aria-label="Màn ${i + 1}: ${lv.name}">
        <span class="stamp">
          <span class="st-art">
            <span class="st-sun"></span><span class="st-ground"></span><span class="st-emoji">${lv.emoji}</span>
            <span class="st-top"><em>Việt Nam</em><em>${String(i + 1).padStart(2, '0')}</em></span>
          </span>
          <span class="st-body">
            <span class="lvtag">${a.tag} · ${mmss(lv.duration)}</span>
            <span class="lvname">${lv.name}</span>
            <span class="lvdesc" title="${lv.desc}">${lv.desc}</span>
            <span class="lvrec">${lv.recipes.map(r => `<i title="${RECIPES[r].name}">${RECIPES[r].emoji}</i>`).join('')}</span>
            <span class="lvfoot">
              <span class="lvstars">${[0, 1, 2].map(k => `<i class="${k < b.stars ? 'on' : ''}">★</i>`).join('')}</span>
              <span class="lvbest">${b.score ? `Kỷ lục <b>${b.score}</b>` : 'Chưa nấu'}</span>
            </span>
          </span>
        </span>
        <span class="lvplay">Vào bếp ▶</span>
      </button>`;
    }).join('');
    $('levels').querySelectorAll('.lvcard').forEach(el => {
      const i = +el.dataset.i;
      el.addEventListener('mouseenter', () => hoverPreview(i));
      el.addEventListener('focus', () => hoverPreview(i));
      el.addEventListener('click', () => startLevel(i));
    });
  }
  renderLevels();

  $('modes').querySelectorAll('.mode').forEach(b => b.addEventListener('click', () => {
    Audio.init(); Audio.play('pick');
    mode = b.dataset.mode;
    $('modes').querySelectorAll('.mode').forEach(x => {
      x.classList.toggle('active', x === b);
      x.setAttribute('aria-pressed', String(x === b));
    });
  }));
  $('optMusic').addEventListener('change', e => { Audio.init(); Audio.setMusic(e.target.checked); });
  $('optTTS').addEventListener('change', e => Audio.setTTS(e.target.checked));

  function startLevel(i) {
    Audio.init(); Audio.startMusic();
    clearTimeout(hoverT); clearTimeout(swapT); $('game').classList.remove('swap');
    current = i; previewIdx = i;
    show(null);
    resetHud();
    $('hud').classList.add('open');
    Game.start(i, mode);
    const lv = LEVELS[i];
    $('lvTag').textContent = `Màn ${i + 1} · ${(ART[lv.id] || ART.hanoi).tag}`;
    $('lvName').textContent = lv.name;
    $('versus').classList.toggle('hidden', mode !== 'versus');
    $('hint').innerHTML = mode === 'solo'
      ? `${icon('i-ha')}<kbd>WASD</kbd> đi <kbd>E</kbd> nhặt <kbd>F</kbd> thái <kbd>Q</kbd> ném <kbd>Shift</kbd> lao<i class="sep"></i><kbd>Tab</kbd> đổi bếp<i class="sep"></i><kbd>Esc</kbd> dừng`
      : `${icon('i-ha')}<kbd>WASD</kbd><kbd>E</kbd><kbd>F</kbd><kbd>Q</kbd><kbd>Shift</kbd><i class="sep"></i>${icon('i-son')}<kbd>↑↓←→</kbd><kbd>.</kbd><kbd>/</kbd><kbd>,</kbd><kbd>Shift phải</kbd><i class="sep"></i><kbd>Esc</kbd> dừng`;
  }

  function toMenu() {
    Game.setPaused(false);
    show('menu');
    $('hud').classList.remove('open');
    previewIdx = current;
    renderLevels();
    Game.preview(current);
  }

  // ---------- PAUSE ----------
  window.addEventListener('keydown', e => {
    if ((e.code === 'Escape' || e.code === 'KeyP') && (Game.state === 'play' || Game.state === 'countdown')) {
      const p = !Game.paused;
      Game.setPaused(p);
      show(p ? 'pause' : null);
      if (p) setTimeout(() => $('btnResume').focus({ preventScroll: true }), 60);
    }
  });
  $('btnResume').onclick = () => { Game.setPaused(false); show(null); };
  $('btnRestart').onclick = () => { Game.setPaused(false); startLevel(current); };
  $('btnMenu').onclick = toMenu;
  $('btnMenu2').onclick = toMenu;
  $('btnAgain').onclick = () => startLevel(current);
  $('btnNext').onclick = () => startLevel((current + 1) % LEVELS.length);

  // ---------- HUD ----------
  let lastOrderKey = '', orderEls = new Map(), lastFrame = 0;
  const hud = { score: 0, shown: 0, tip: 0, t: -1, low: false, vs: [-1, -1] };
  const coin = document.querySelector('#scorebox .coin');

  function resetHud() {
    lastOrderKey = '';
    orderEls = new Map();
    $('orders').innerHTML = '';
    Object.assign(hud, { score: 0, shown: 0, tip: 0, t: -1, low: false, vs: [-1, -1] });
    $('score').textContent = '0';
    $('timerbox').classList.remove('low');
    $('timerbar').style.strokeDashoffset = '0';
    $('banner').classList.remove('show', 'bump');
    $('combo').classList.remove('show');
  }

  // Phiếu gọi món treo trên dây
  function makeTicket(o, G) {
    const rc = RECIPES[o.recipe];
    const el = document.createElement('div');
    el.className = 'order';
    el.dataset.mood = 'ok'; el.dataset.lvl = 'ok';
    el.style.setProperty('--sway-d', `${(-Math.random() * 3.4).toFixed(2)}s`);
    const table = o.cust ? G.customers.indexOf(o.cust) + 1 : 0;
    el.innerHTML = `<div class="swing"><i class="pin"></i>
      <div class="ticket">
        <div class="otop"><span class="oemoji">${rc.emoji}</span><span class="oname">${rc.name}</span></div>
        <div class="oparts">${rc.parts.map(p => {
          const [k, s] = p.split(':');
          return `<span class="part" title="${INGREDIENTS[k].name}">${INGREDIENTS[k].emoji}${STATE_ICON[s] ? `<sub>${STATE_ICON[s]}</sub>` : ''}</span>`;
        }).join('')}</div>
        <div class="ofoot"><span class="otable">${table ? `Bàn ${table}` : 'Mang đi'}</span><span class="otime"><i></i></span></div>
      </div>
      <div class="omood"><span class="ocust">${o.cust ? o.cust.def.emoji : '🧑'}</span><b>🙂</b></div>
      <span class="ostamp"></span></div>`;
    return { el, o, bar: el.querySelector('.otime i'), face: el.querySelector('.omood b'), mood: 'ok', lvl: 'ok', urgent: false };
  }

  // Đồng bộ danh sách phiếu; phiếu dịch chỗ mượt (FLIP), phiếu xong/hủy đóng dấu rồi bay đi
  function syncOrders(G) {
    const key = G.orders.map(o => o.id).join(',');
    if (key === lastOrderKey) return;
    lastOrderKey = key;
    const box = $('orders'), bx = box.getBoundingClientRect().left;
    const first = new Map();
    for (const [id, r] of orderEls) first.set(id, r.el.getBoundingClientRect().left);
    const keep = new Map();
    for (const o of G.orders) {
      const r = orderEls.get(o.id) || makeTicket(o, G);
      keep.set(o.id, r);
      box.appendChild(r.el);
    }
    let leaving = 0;
    for (const [id, r] of orderEls) {
      if (keep.has(id)) continue;
      leaving++;
      r.el.style.left = `${first.get(id) - bx}px`;
      r.el.classList.add(r.o.done === 'served' ? 'served' : 'failed');
      setTimeout(() => r.el.remove(), 1100);
    }
    orderEls = keep;
    // phiếu còn lại đợi phiếu cũ đóng dấu xong rồi mới trượt vào chỗ trống
    const delay = leaving ? 380 : 0;
    for (const [id, r] of keep) {
      if (!first.has(id)) continue;
      const dx = first.get(id) - r.el.getBoundingClientRect().left;
      if (Math.abs(dx) > 0.5) r.el.animate([{ translate: `${dx}px 0` }, { translate: '0 0' }], { duration: 460, delay, fill: 'backwards', easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
  }

  function updateTicket(o) {
    const r = orderEls.get(o.id);
    if (!r) return;
    const f = Math.max(0, o.t / o.max);
    r.bar.style.transform = `scaleX(${f.toFixed(4)})`;
    const [, mood, face] = MOODS.find(m => f > m[0]);
    if (mood !== r.mood) {
      r.mood = mood; r.el.dataset.mood = mood;
      r.face.textContent = face; bump(r.face, 'bump');
    }
    const lvl = f > 0.5 ? 'ok' : f > 0.25 ? 'warn' : 'bad';
    if (lvl !== r.lvl) { r.lvl = lvl; r.el.dataset.lvl = lvl; }
    const urgent = f < 0.2;
    if (urgent !== r.urgent) { r.urgent = urgent; r.el.classList.toggle('urgent', urgent); }
  }

  Game.onHud = G => {
    if (G.state !== 'play' && G.state !== 'countdown') return;
    const now = performance.now(), dt = Math.min(0.1, (now - lastFrame) / 1000 || 0);
    lastFrame = now;
    syncOrders(G);
    for (const o of G.orders) updateTicket(o);

    // điểm: đếm dần tới số thật
    if (G.score !== hud.score) {
      const up = G.score > hud.score;
      hud.score = G.score;
      bump($('score'), up ? 'up' : 'down', up ? 'down' : 'up');
      if (up) bump(coin, 'spin');
    }
    if (hud.shown !== hud.score) {
      hud.shown += (hud.score - hud.shown) * Math.min(1, dt * 9);
      if (Math.abs(hud.score - hud.shown) < 0.5) hud.shown = hud.score;
      $('score').textContent = Math.round(hud.shown);
    }
    if (G.tipMult !== hud.tip) {
      const el = $('tipmult');
      el.textContent = `Tip ×${G.tipMult}`; el.dataset.m = G.tipMult;
      if (hud.tip && G.tipMult > hud.tip) bump(el, 'bump');
      hud.tip = G.tipMult;
    }

    // đồng hồ
    const t = Math.max(0, Math.ceil(G.timeLeft));
    if (t !== hud.t) {
      hud.t = t;
      $('timer').textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
      const low = t <= 20;
      if (low !== hud.low) { hud.low = low; $('timerbox').classList.toggle('low', low); }
      if (t <= 10 && G.state === 'play') bump($('timer'), 'tick');
    }
    $('timerbar').style.strokeDashoffset = (100 * (1 - Math.max(0, G.timeLeft) / G.lv.duration)).toFixed(2);

    if (G.mode === 'versus') {
      for (let i = 0; i < 2; i++) {
        const c = G.chefs[i].caused;
        if (c === hud.vs[i]) continue;
        const el = $(`vs${i}`);
        el.textContent = c;
        if (hud.vs[i] >= 0) bump(el, 'bump');
        hud.vs[i] = c;
      }
    }
  };

  let bannerTimer = 0;
  Game.onBanner = (text, dur) => {
    const b = $('banner');
    $('bannerText').textContent = text;
    if (b.classList.contains('show')) bump(b, 'bump'); else b.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.classList.remove('show', 'bump'), dur * 1000);
  };

  let comboTimer = 0;
  Game.onCombo = n => {
    const c = $('combo');
    c.innerHTML = `<small>Phản ứng dây chuyền</small><b>×${n}</b>`;
    bump(c, 'show');
    clearTimeout(comboTimer);
    comboTimer = setTimeout(() => c.classList.remove('show'), 1600);
  };

  Game.onCountdown = v => {
    const c = $('countdown');
    c.querySelector('b').textContent = v;
    c.classList.toggle('go', typeof v !== 'number');
    bump(c, 'show');
  };

  // ---------- KẾT QUẢ ----------
  Game.onEnd = res => {
    const lv = LEVELS[res.level];
    const best = loadBest();
    const prev = best[lv.id] || { stars: 0, score: 0 };
    const isRecord = res.score > prev.score;
    best[lv.id] = { stars: Math.max(prev.stars, res.stars), score: Math.max(prev.score, res.score) };
    saveBest(best);

    setTimeout(() => {
      show('result');
      $('hud').classList.remove('open');
      const receipt = document.querySelector('#result .receipt');
      $('resLevel').textContent = `Phiếu tổng kết · Màn ${res.level + 1}: ${lv.name}`;
      $('resTitle').textContent = res.stars === 3 ? '🏆 Quán đắt khách!' : res.stars >= 1 ? '⏰ Hết giờ!' : '😵 Quán vỡ trận!';

      // thanh mốc sao
      const max = Math.max(lv.stars[2] * 1.15, res.score * 1.04, 1);
      $('resTrack').innerHTML = '<i class="fill"></i>' + lv.stars.map(s => `<span class="mk" style="left:${(s / max * 100).toFixed(1)}%">★<small>${s}</small></span>`).join('');
      const marks = $('resTrack').querySelectorAll('.mk');
      requestAnimationFrame(() => requestAnimationFrame(() => {
        $('resTrack').querySelector('.fill').style.width = `${Math.min(100, res.score / max * 100)}%`;
      }));

      // con dấu sao đóng lần lượt
      $('resStars').innerHTML = '<span class="seal">★</span><span class="seal">★</span><span class="seal">★</span>';
      const seals = $('resStars').querySelectorAll('.seal');
      for (let i = 0; i < res.stars; i++) {
        setTimeout(() => { seals[i].classList.add('on'); marks[i].classList.add('on'); Audio.play('star'); bump(receipt, 'thump'); }, 650 + i * 430);
      }

      // điểm đếm lên
      const num = $('resNum'), t0 = performance.now(), D = 900 + Math.min(700, res.score * 2);
      const rec = $('resRecord');
      rec.classList.remove('on');
      (function step(now) {
        const k = Math.min(1, (now - t0) / D);
        num.textContent = Math.round(res.score * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(step);
        else if (isRecord && res.score > 0) rec.classList.add('on');
      })(t0);

      const s = res.stats;
      const rows = [
        ['🍜', 'Món đã phục vụ', s.served], ['😡', 'Khách bỏ về', s.failed],
        ['💥', 'Cú va chạm', s.bumps], ['🫗', 'Lần đổ đồ', s.spills],
        ['🤯', 'Cú va ngoạn mục', s.spectacular], ['🧤', 'Bắt đồ bay', s.catches],
        ['🔗', 'Dây chuyền dài nhất', `×${s.maxCombo}`],
      ];
      $('resStats').innerHTML = rows.map(([e, l, v]) => `<div><span>${e} ${l}</span><i></i><b>${v}</b></div>`).join('');
      if (res.mode === 'versus') {
        const [a, b] = res.caused;
        $('resVersus').textContent = a === b ? `🤝 Hòa ${a}–${b}: đúng là bạn thân!`
          : a < b ? `🔴 Bếp Hà thắng! (Sơn húc ${b} lần, Hà chỉ ${a})` : `🔵 Bếp Sơn thắng! (Hà húc ${a} lần, Sơn chỉ ${b})`;
      } else $('resVersus').textContent = '';
      setTimeout(() => $('btnNext').focus({ preventScroll: true }), 80);
    }, 900);
  };
})();
