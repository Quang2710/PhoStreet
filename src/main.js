import './style.css';
import { INGREDIENTS, RECIPES, LEVELS, STATE_ICON } from './data.js';
import { Audio } from './audio.js';
import { Game } from './game.js';

// tiện debug trong console khi chạy npm run dev
if (import.meta.env.DEV) window.Game = Game;

// ===== Giao diện: menu, HUD, kết quả =====
(() => {
  const $ = id => document.getElementById(id);
  let mode = 'coop', current = 0;
  const BEST_KEY = 'phoLoanPho.best';

  function loadBest() { try { return JSON.parse(localStorage.getItem(BEST_KEY)) || {}; } catch (e) { return {}; } }
  function saveBest(b) { try { localStorage.setItem(BEST_KEY, JSON.stringify(b)); } catch (e) { /* bỏ qua */ } }

  Game.init($('game'), $('overlay'));
  Game.preview(0);

  // ---------- MENU ----------
  function renderLevels() {
    const best = loadBest();
    $('levels').innerHTML = LEVELS.map((lv, i) => {
      const b = best[lv.id] || { stars: 0, score: 0 };
      const stars = '★'.repeat(b.stars) + '☆'.repeat(3 - b.stars);
      return `<div class="lvcard" data-i="${i}">
        <div class="lvemoji">${lv.emoji}</div>
        <div class="lvname">${i + 1}. ${lv.name}</div>
        <div class="lvdesc">${lv.desc}</div>
        <div class="lvrec" title="${lv.recipes.map(r => RECIPES[r].name).join(', ')}">${lv.recipes.map(r => RECIPES[r].emoji).join(' ')}</div>
        <div class="lvstars">${stars} <small style="color:#555;letter-spacing:0">${b.score ? 'Kỷ lục ' + b.score : ''}</small></div>
        <div class="lvplay">▶ Vào bếp</div>
      </div>`;
    }).join('');
    $('levels').querySelectorAll('.lvcard').forEach(el => {
      el.addEventListener('mouseenter', () => { if (Game.state === 'preview') Game.preview(+el.dataset.i); });
      el.addEventListener('click', () => startLevel(+el.dataset.i));
    });
  }
  renderLevels();

  $('modes').querySelectorAll('.mode').forEach(b => b.addEventListener('click', () => {
    Audio.init(); Audio.play('pick');
    mode = b.dataset.mode;
    $('modes').querySelectorAll('.mode').forEach(x => x.classList.toggle('active', x === b));
  }));
  $('optMusic').addEventListener('change', e => { Audio.init(); Audio.setMusic(e.target.checked); });
  $('optTTS').addEventListener('change', e => Audio.setTTS(e.target.checked));

  function show(id) { ['menu', 'pause', 'result'].forEach(s => $(s).classList.toggle('hidden', s !== id)); }

  function startLevel(i) {
    Audio.init(); Audio.startMusic();
    current = i;
    show(null);
    $('hud').classList.remove('hidden');
    lastOrderKey = ''; lastScore = -1;
    $('orders').innerHTML = ''; orderEls = new Map();
    Game.start(i, mode);
    const lv = LEVELS[i];
    $('levelname').textContent = `${lv.emoji} ${lv.name}`;
    $('versus').classList.toggle('hidden', mode !== 'versus');
    $('hint').innerHTML = mode === 'solo'
      ? '<kbd>WASD</kbd> đi · <kbd>E</kbd> nhặt/đặt · <kbd>F</kbd> thái · <kbd>Q</kbd> ném · <kbd>Shift</kbd> lao · <kbd>Tab</kbd> đổi đầu bếp · <kbd>Esc</kbd> dừng'
      : '🔴 <kbd>WASD</kbd> <kbd>E</kbd> <kbd>F</kbd> <kbd>Q</kbd> <kbd>Shift</kbd> &nbsp;|&nbsp; 🔵 <kbd>↑↓←→</kbd> <kbd>.</kbd> <kbd>/</kbd> <kbd>,</kbd> <kbd>Shift phải</kbd> &nbsp;|&nbsp; <kbd>Esc</kbd> dừng';
    $('timer').classList.remove('low');
  }

  function toMenu() {
    Game.setPaused(false);
    show('menu');
    $('hud').classList.add('hidden');
    renderLevels();
    Game.preview(current);
  }

  // ---------- PAUSE ----------
  window.addEventListener('keydown', e => {
    if ((e.code === 'Escape' || e.code === 'KeyP') && (Game.state === 'play' || Game.state === 'countdown')) {
      const p = !Game.paused;
      Game.setPaused(p);
      show(p ? 'pause' : null);
    }
  });
  $('btnResume').onclick = () => { Game.setPaused(false); show(null); };
  $('btnRestart').onclick = () => { Game.setPaused(false); startLevel(current); };
  $('btnMenu').onclick = toMenu;
  $('btnMenu2').onclick = toMenu;
  $('btnAgain').onclick = () => startLevel(current);
  $('btnNext').onclick = () => startLevel((current + 1) % LEVELS.length);

  // ---------- HUD ----------
  let lastOrderKey = '', lastScore = -1, orderEls = new Map();
  Game.onHud = G => {
    if (G.state !== 'play' && G.state !== 'countdown') return;
    const key = G.orders.map(o => o.id).join(',');
    if (key !== lastOrderKey) {
      lastOrderKey = key;
      const box = $('orders');
      const keep = new Map();
      G.orders.forEach(o => {
        let el = orderEls.get(o.id);
        if (!el) {
          const rc = RECIPES[o.recipe];
          el = document.createElement('div');
          el.className = 'order';
          el.innerHTML = `<div class="otime"><i></i></div>
            <div class="otop"><span class="oemoji">${rc.emoji}</span><span class="oname">${rc.name}</span></div>
            <div class="oparts">${rc.parts.map(p => {
              const [k, s] = p.split(':');
              return `<span class="part" title="${INGREDIENTS[k].name}">${INGREDIENTS[k].emoji}<sub>${STATE_ICON[s]}</sub></span>`;
            }).join('')}</div>`;
        }
        keep.set(o.id, el);
        box.appendChild(el);
      });
      for (const [id, el] of orderEls) if (!keep.has(id)) el.remove();
      orderEls = keep;
    }
    for (const o of G.orders) {
      const el = orderEls.get(o.id);
      if (!el) continue;
      const f = Math.max(0, o.t / o.max);
      const bar = el.firstElementChild.firstElementChild;
      bar.style.width = (f * 100) + '%';
      bar.style.background = f > 0.5 ? '#43a047' : f > 0.25 ? '#ffa000' : '#e53935';
      el.classList.toggle('urgent', f < 0.2);
    }
    if (G.score !== lastScore) { lastScore = G.score; $('score').textContent = G.score; }
    $('tipmult').textContent = `Tip x${G.tipMult}`;
    const t = Math.max(0, Math.ceil(G.timeLeft));
    $('timer').textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    $('timer').classList.toggle('low', t <= 20);
    $('timerbar').style.width = (G.timeLeft / G.lv.duration * 100) + '%';
    if (G.mode === 'versus') $('versus').innerHTML = `💥 Gây va chạm — 🔴 Bếp Hà: <b>${G.chefs[0].caused}</b> &nbsp;|&nbsp; 🔵 Bếp Sơn: <b>${G.chefs[1].caused}</b>`;
  };

  let bannerTimer = null;
  Game.onBanner = (text, dur) => {
    const b = $('banner');
    b.textContent = text; b.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.classList.remove('show'), dur * 1000);
  };

  let comboTimer = null;
  Game.onCombo = n => {
    const c = $('combo');
    c.textContent = `PHẢN ỨNG DÂY CHUYỀN x${n}!`;
    c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
    clearTimeout(comboTimer);
    comboTimer = setTimeout(() => c.classList.remove('show'), 1600);
  };

  Game.onCountdown = v => {
    const c = $('countdown');
    c.textContent = v;
    c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
  };

  // ---------- RESULT ----------
  Game.onEnd = res => {
    const lv = LEVELS[res.level];
    const best = loadBest();
    const prev = best[lv.id] || { stars: 0, score: 0 };
    const isRecord = res.score > prev.score;
    best[lv.id] = { stars: Math.max(prev.stars, res.stars), score: Math.max(prev.score, res.score) };
    saveBest(best);

    setTimeout(() => {
      show('result');
      $('resTitle').textContent = res.stars === 3 ? '🏆 Quán đắt khách!' : res.stars >= 1 ? '⏰ Hết giờ!' : '😵 Quán vỡ trận!';
      $('resStars').innerHTML = '<span>⭐</span><span>⭐</span><span>⭐</span>';
      const spans = $('resStars').querySelectorAll('span');
      for (let i = 0; i < res.stars; i++) setTimeout(() => { spans[i].classList.add('on'); Audio.play('star'); }, 400 + i * 450);
      $('resScore').innerHTML = `${res.score} điểm ${isRecord ? '<span style="color:#e53935">· Kỷ lục mới!</span>' : ''}<br><small style="font-size:14px;opacity:.7">Mốc sao: ${lv.stars.join(' / ')}</small>`;
      const s = res.stats;
      $('resStats').innerHTML = `
        <div>🍜 Món đã phục vụ <b>${s.served}</b></div>
        <div>😡 Khách bỏ về <b>${s.failed}</b></div>
        <div>💥 Cú va chạm <b>${s.bumps}</b></div>
        <div>🫗 Lần đổ đồ <b>${s.spills}</b></div>
        <div>🤯 Cú va ngoạn mục <b>${s.spectacular}</b></div>
        <div>🧤 Bắt đồ bay <b>${s.catches}</b></div>
        <div>🔗 Dây chuyền dài nhất <b>x${s.maxCombo}</b></div>`;
      if (res.mode === 'versus') {
        const [a, b] = res.caused;
        $('resVersus').textContent = a === b ? `🤝 Hòa ${a}–${b}: đúng là bạn thân!`
          : a < b ? `🔴 Bếp Hà thắng! (Sơn húc ${b} lần, Hà chỉ ${a})` : `🔵 Bếp Sơn thắng! (Hà húc ${a} lần, Sơn chỉ ${b})`;
      } else $('resVersus').textContent = '';
    }, 900);
  };
})();
