import * as THREE from 'three';
import { INGREDIENTS, RECIPES, LEVELS, LINES, CUSTOMERS, EVENT_INFO } from './data.js';
import { Audio } from './audio.js';
import { Models } from './models.js';

// ===== Lõi game: Phở Loạn Phố =====
export const Game = (() => {
  const R = 0.32, WALK = 4.3, DASH_V = 10.5, GRAV = 20, TOP = 0.92;
  const BUMP_SPEED = 6.8; // tốc độ áp sát tối thiểu để thành "cú húc"
  let renderer, scene, camera, world, hemi, sun, overlay;
  let G = null, paused = false, lastT = 0;
  const camBase = new THREE.Vector3(), camLook = new THREE.Vector3();
  const tv = new THREE.Vector3();
  const api = { onEnd: null, onHud: null };

  // ---------------- INPUT ----------------
  const Input = { down: new Set(), pressed: new Set(), padPrev: [[], [], [], []] };
  const BIND = [
    { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], pick: ['KeyE', 'Space'], act: ['KeyF'], thr: ['KeyQ'], dash: ['ShiftLeft'] },
    { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], pick: ['Period', 'Numpad1', 'Enter', 'NumpadEnter'], act: ['Slash', 'Numpad2'], thr: ['Comma', 'Numpad3'], dash: ['ShiftRight', 'Numpad0'] },
  ];
  const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Slash', 'Period', 'Comma']);
  window.addEventListener('keydown', e => {
    if (!e.repeat) Input.pressed.add(e.code);
    Input.down.add(e.code);
    if (G && G.state === 'play' && PREVENT.has(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', e => Input.down.delete(e.code));
  window.addEventListener('blur', () => Input.down.clear());

  function readPlayer(i) {
    const b = BIND[i];
    const any = a => a.some(c => Input.down.has(c)), edge = a => a.some(c => Input.pressed.has(c));
    let x = (any(b.right) ? 1 : 0) - (any(b.left) ? 1 : 0);
    let z = (any(b.down) ? 1 : 0) - (any(b.up) ? 1 : 0);
    let pick = edge(b.pick), act = any(b.act), thr = edge(b.thr), dash = edge(b.dash), swap = false;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && pads[i];
    if (p) {
      const ax = p.axes[0] || 0, az = p.axes[1] || 0;
      if (Math.hypot(ax, az) > 0.25) { x = ax; z = az; }
      const bt = k => p.buttons[k] && p.buttons[k].pressed, prev = Input.padPrev[i];
      const ed = k => bt(k) && !prev[k];
      if (bt(12)) z = -1; if (bt(13)) z = 1; if (bt(14)) x = -1; if (bt(15)) x = 1;
      pick = pick || ed(0); act = act || bt(2); thr = thr || ed(1); dash = dash || ed(5) || ed(7); swap = ed(3);
      Input.padPrev[i] = p.buttons.map(bb => bb.pressed);
    }
    const l = Math.hypot(x, z); if (l > 1) { x /= l; z /= l; }
    return { x, z, pick, act, thr, dash, swap };
  }

  // ---------------- INIT ----------------
  function init(container, overlayEl) {
    overlay = overlayEl;
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    window.addEventListener('resize', resize);
    resize();
    requestAnimationFrame(loop);
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (G) placeCamera();
  }

  function placeCamera() {
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const d = Math.max((G.W + 2.5) / (2 * tanV * camera.aspect), (G.H + 6) * 0.78 / (2 * tanV)) * 1.04;
    const dir = new THREE.Vector3(0, 0.83, 0.56).normalize();
    camLook.set(0, 0, -0.2);
    camBase.copy(camLook).addScaledVector(dir, d);
    camera.position.copy(camBase);
    camera.lookAt(camLook);
    G.camDist = d;
    if (scene.fog) setFog(G.fogThick || 0);
  }

  function setFog(k) {
    if (!scene.fog) return;
    const d = G.camDist;
    scene.fog.near = d - 1 - k * 5;
    scene.fog.far = d + 10 - k * 6.5;
  }

  // ---------------- LEVEL BUILD ----------------
  function clearScene() {
    while (scene.children.length) scene.remove(scene.children[0]);
    overlay.innerHTML = '';
    scene.fog = null;
  }

  function build(levelIndex, mode) {
    clearScene();
    const lv = LEVELS[levelIndex];
    const th = lv.theme;
    const H = lv.map.length, W = Math.max(...lv.map.map(r => r.length));
    G = {
      lv, levelIndex, mode, W, H, ox: -W / 2 + 0.5, oz: -H / 2 + 0.5,
      tiles: [], floorTiles: [], lanes: [], chefs: [], floor: [], proj: [], puddles: [], bananas: [],
      npcs: [], particles: [], labels: [], bars: new Map(), customers: [], orders: [], pendingPots: [],
      state: 'preview', time: 0, timeLeft: lv.duration, score: 0, tipMult: 1,
      orderTimer: 1.5, nextEvent: 16 + Math.random() * 8, ev: {}, force: { x: 0, z: 0 },
      accel: lv.modifiers.includes('waves') ? 8 : lv.modifiers.includes('slope') ? 7 : 16,
      shake: 0, combo: 0, lastChaos: -10, active: 0, countdown: 3.5, fogThick: 0, ordersDirty: true,
      stats: { served: 0, failed: 0, bumps: 0, spills: 0, spectacular: 0, maxCombo: 0, catches: 0 },
      recipes: lv.recipes,
    };
    world = new THREE.Group(); scene.add(world);

    // Ánh sáng
    const night = !!th.night;
    scene.background = new THREE.Color(th.sky);
    hemi = new THREE.HemisphereLight(night ? 0x8899ff : 0xffffff, th.ground, night ? 0.4 : 0.7);
    scene.add(hemi);
    sun = new THREE.DirectionalLight(night ? 0x9fb0ff : 0xfff2dd, night ? 0.45 : 0.85);
    sun.position.set(5, 14, 7); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 40 });
    sun.shadow.bias = -0.0008;
    scene.add(sun);
    G.baseLight = { hemi: hemi.intensity, sun: sun.intensity };
    if (th.fog) scene.fog = new THREE.Fog(th.sky, 10, 30);

    // Nền ngoài
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshLambertMaterial({ color: th.ground }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = th.water ? -0.45 : -0.01; ground.receiveShadow = true;
    scene.add(ground);
    G.ground = ground;

    // Ô bếp
    for (let r = 0; r < H; r++) {
      G.tiles[r] = [];
      for (let c = 0; c < W; c++) {
        const ch = lv.map[r][c] || '#';
        const x = c + G.ox, z = r + G.oz;
        let type = 'counter', crate = null;
        if (ch === '.') type = 'floor';
        else if (ch === 'C') type = 'board';
        else if (ch === 'S') type = 'stove';
        else if (ch === 'G') type = 'grill';
        else if (ch === 'P') type = 'plates';
        else if (ch === 'W') type = 'window';
        else if (ch === 'T') type = 'trash';
        else if (ch >= '1' && ch <= '9') { type = 'crate'; crate = lv.crates[+ch - 1]; }
        const t = { c, r, x, z, type, crate, item: null, mesh: null };
        G.tiles[r][c] = t;
        // sàn
        const fl = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), Models.M((c + r) % 2 ? th.floor : th.floor2));
        fl.rotation.x = -Math.PI / 2; fl.position.set(x, 0.001, z); fl.receiveShadow = true; world.add(fl);
        if (type === 'floor') { G.floorTiles.push(t); continue; }
        t.mesh = Models.makeTile(ch === '#' ? '#' : ch, th, crate);
        t.mesh.position.set(x, 0, z);
        world.add(t.mesh);
        if (type === 'stove') { const pot = newItem('pot'); place(t, pot); }
      }
    }
    // làn đường cho công an / xe máy: hàng toàn sàn
    for (let r = 1; r < H - 1; r++) {
      let n = 0; for (let c = 1; c < W - 1; c++) if (G.tiles[r][c].type === 'floor') n++;
      if (n >= W - 2) G.lanes.push(r);
    }
    if (!G.lanes.length) G.lanes.push(Math.floor(H / 2));

    // Highlight mục tiêu cho từng đầu bếp
    // Đầu bếp
    const defs = [
      { shirt: 0xd84315, hat: 'nonla', ring: 0xff3d00, region: 'north', name: 'Bếp Hà' },
      { shirt: 0x1565c0, hat: 'khanran', ring: 0x2979ff, region: 'south', name: 'Bếp Sơn' },
    ];
    const spawns = G.floorTiles.length ? [G.floorTiles[Math.floor(G.floorTiles.length * 0.3)], G.floorTiles[Math.floor(G.floorTiles.length * 0.7)]] : [];
    defs.forEach((d, i) => {
      const mesh = Models.makeChef(d);
      world.add(mesh);
      const hl = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.06, 1.04), new THREE.MeshBasicMaterial({ color: d.ring, transparent: true, opacity: 0.35, depthWrite: false }));
      hl.visible = false; world.add(hl);
      const sp = spawns[i] || { x: i, z: 0 };
      mesh.position.set(sp.x, 0, sp.z);
      G.chefs.push({
        id: i, def: d, mesh, hl, x: sp.x, z: sp.z, y: 0, vx: 0, vz: 0, vy: 0, face: 0, faceTarget: 0,
        holding: null, stun: 0, spinT: 0, dashCd: 0, dashT: 0, bumpCd: 0, npcCd: 0, anim: 0, chopping: false, chopSfx: 0, caused: 0,
      });
    });

    decorate(lv);
    placeCamera();
    G.ordersDirty = true;
    if (api.onHud) api.onHud(G);
  }

  // ---------------- TRANG TRÍ THEO MÀN ----------------
  function decorate(lv) {
    const th = lv.theme, W = G.W, H = G.H, ox = G.ox, oz = G.oz;
    const add = (m, x, y, z, ry = 0) => { m.position.set(x, y, z); m.rotation.y = ry; world.add(m); return m; };
    const topZ = oz - 0.5; // mép trên bếp
    // Biển hiệu neon
    const signText = { hanoi: 'PHỞ LOẠN PHỐ', mientay: 'GHE BÁN ĐỦ MÓN', benthanh: 'BÁNH MÌ - BÚN CHẢ', tet: 'CHÚC MỪNG NĂM MỚI', sapa: 'PHỞ SAPA' }[lv.id];
    const sign = Models.textPlane(signText, 5, 0.9, 'rgba(20,10,30,0.92)', lv.id === 'tet' ? '#ffd54f' : '#4dd0ff');
    sign.position.set(-W / 2 + 3.2, 2.6, topZ - 0.3); world.add(sign);
    const post = Models.box(0.12, 2.6, 0.12, 0x333333, -W / 2 + 3.2, 1.3, topZ - 0.35); world.add(post);

    // Khách hàng ngồi ghế nhựa phía trên quầy ra món
    const stoolColors = [0xe53935, 0x1e88e5, 0x43a047, 0xfdd835];
    const rows = [topZ - 1.4, topZ - 2.8];
    let k = 0;
    rows.forEach((zz, ri) => {
      for (let x = -W / 2 + 1.2 + ri * 1.1; x < W / 2 - 0.8; x += 2.3) {
        if (lv.id === 'mientay') {
          // ghe nhỏ của khách
          add(Models.box(1.8, 0.35, 0.9, 0x6d4c41), x, -0.25, zz);
        } else add(Models.makeLowTable(lv.id === 'tet' ? 0xc62828 : 0x1565c0), x, 0, zz);
        const def = CUSTOMERS[(k + ri) % CUSTOMERS.length];
        const cx = x + (k % 2 ? 0.75 : -0.75);
        if (lv.id !== 'mientay') add(Models.makeStool(stoolColors[k % 4]), cx, 0, zz + 0.35);
        const cm = Models.makeCustomer(def);
        add(cm, cx, lv.id === 'mientay' ? -0.1 : 0, zz + 0.35);
        cm.lookAt(cx * 0.3, 0, oz + 2);
        G.customers.push({ mesh: cm, def, x: cx, z: zz + 0.35, jumpT: 0, cd: 0, baseY: cm.position.y });
        k++;
      }
    });

    const sideL = -W / 2 - 1.3, sideR = W / 2 + 1.3, botZ = -oz + 1.5;
    if (lv.id === 'mientay') {
      // thân ghe
      const hull = 0x5d4037;
      add(Models.box(W + 1.2, 0.6, 0.5, hull), 0, -0.2, -oz + 0.75);
      add(Models.box(W + 1.2, 0.6, 0.5, hull), 0, -0.2, oz - 0.75);
      add(Models.box(0.5, 0.6, H + 1.0, hull), -W / 2 - 0.35, -0.2, 0);
      add(Models.box(0.5, 0.6, H + 1.0, hull), W / 2 + 0.35, -0.2, 0);
      for (let i = 0; i < 5; i++) {
        const b = add(Models.box(2.2, 0.4, 1, 0x795548), sideR + 1.5 + (i % 2), -0.25, -4 + i * 2.2);
        const colors = [0xff7043, 0xffee58, 0x66bb6a, 0xab47bc];
        for (let j = 0; j < 4; j++) b.add(Models.sph(0.18, colors[(i + j) % 4], -0.6 + j * 0.4, 0.3, 0));
      }
      G.water = true;
    } else if (lv.id === 'sapa') {
      for (let i = 0; i < 10; i++) add(Models.makePine(), (i % 2 ? sideL - 0.6 : sideR + 0.6) + Math.random() - 0.5, 0, -5 + i * 1.3);
      for (let i = 0; i < 5; i++) {
        const m = Models.mesh(new THREE.ConeGeometry(4 + Math.random() * 2, 6 + Math.random() * 3, 7), Models.M(0x5d7a5a));
        m.position.set(-14 + i * 7, 0, -14 - Math.random() * 4); world.add(m);
      }
    } else if (lv.id === 'tet') {
      add(Models.makeTree(0, true), sideL, 0, -1.5); add(Models.makeTree(0, true), sideR, 0, 1.5);
      const kq = add(Models.makeTree(0x2e7d32), sideL - 0.3, 0, 2.5);
      for (let i = 0; i < 8; i++) kq.add(Models.sph(0.08, 0xff9800, Math.cos(i) * 0.6, 1.3 + Math.sin(i * 2) * 0.4, Math.sin(i) * 0.6, 6));
      for (let i = 0; i < 6; i++) {
        const l = add(Models.makeLantern(i % 2 ? 0xe53935 : 0xffb300), -W / 2 + 1 + i * (W - 2) / 5, 2.4, topZ - 0.2);
        if (i % 2 === 0) { const pl = new THREE.PointLight(0xff7043, 0.7, 6); pl.position.copy(l.position); world.add(pl); }
      }
      add(Models.makeStool(0xe53935), sideR, 0, -2);
    } else {
      // phố: cây, xe máy dựng, đèn lồng
      add(Models.makeTree(0x43a047, lv.id === 'hanoi'), sideL, 0, -1);
      add(Models.makeTree(0x2e7d32), sideR, 0, 1.8);
      for (let i = 0; i < 3; i++) add(Models.makeMotoParked([0xe53935, 0x1e88e5, 0x212121][i]), sideL - 0.2, 0, 0.6 + i * 1.3, Math.PI / 2 + 0.25);
      for (let i = 0; i < 4; i++) add(Models.makeLantern(0xffb300), W / 2 - 1 - i * 1.4, 2.3, topZ - 0.2);
      if (lv.id === 'hanoi') for (let i = 0; i < 4; i++) add(Models.makeStool(stoolColors[i]), sideR + (i % 2) * 0.5, 0, -2.5 + i * 0.6);
    }

    // Mưa
    const N = 700, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 26; pos[i * 3 + 1] = Math.random() * 12; pos[i * 3 + 2] = (Math.random() - 0.5) * 20; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    G.rain = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xaad4ff, size: 0.07, transparent: true, opacity: 0.7 }));
    G.rain.visible = false; scene.add(G.rain);
  }

  // ---------------- ITEM ----------------
  function newItem(kind, state = 'raw') {
    const it = { kind, state, progress: 0, cook: 0, burn: 0, contents: [], content: null, mesh: null, warn: 0 };
    rebuild(it);
    return it;
  }
  const keyOf = it => `${it.kind}:${it.state}`;
  const isIng = it => it.kind !== 'plate' && it.kind !== 'pot';

  function rebuild(it) {
    let parent = null, p = null, rot = 0, sc = 1;
    if (it.mesh) { parent = it.mesh.parent; p = it.mesh.position.clone(); rot = it.mesh.rotation.y; sc = it.mesh.scale.x; if (parent) parent.remove(it.mesh); }
    if (it.kind === 'plate') it.mesh = Models.makePlate(it.contents);
    else if (it.kind === 'pot') it.mesh = Models.makePot(it.content);
    else it.mesh = Models.makeIngredient(it.kind, it.state);
    if (parent) { parent.add(it.mesh); it.mesh.position.copy(p); it.mesh.rotation.y = rot; it.mesh.scale.setScalar(sc); }
  }

  function detach(it) { if (it.mesh && it.mesh.parent) it.mesh.parent.remove(it.mesh); }

  function place(t, it) {
    detach(it);
    world.add(it.mesh);
    it.mesh.position.set(t.x, TOP, t.z);
    it.mesh.rotation.set(0, 0, 0); it.mesh.scale.setScalar(1);
    t.item = it;
  }

  function give(ch, it) {
    detach(it);
    ch.mesh.userData.hold.add(it.mesh);
    it.mesh.position.set(0, -0.08, 0);
    it.mesh.rotation.set(0, 0, 0); it.mesh.scale.setScalar(1);
    ch.holding = it;
    Audio.play('pick');
  }

  function addFloor(it, x, z) {
    detach(it);
    world.add(it.mesh);
    it.mesh.position.set(x, 0.02, z);
    it.mesh.rotation.set(0, Math.random() * 6, 0);
    G.floor.push({ it, x, z });
  }

  // ---------------- TILE HELPERS ----------------
  function tileAt(x, z) {
    const c = Math.floor(x - G.ox + 0.5), r = Math.floor(z - G.oz + 0.5);
    return (G.tiles[r] && G.tiles[r][c]) || null;
  }
  const solid = t => !t || t.type !== 'floor';

  function getTarget(ch) {
    const fx = Math.sin(ch.face), fz = Math.cos(ch.face);
    // ưu tiên đồ rơi trên sàn ngay trước mặt
    let best = null, bd = 0.7;
    for (const f of G.floor) {
      const d = Math.hypot(f.x - (ch.x + fx * 0.45), f.z - (ch.z + fz * 0.45));
      if (d < bd) { bd = d; best = f; }
    }
    if (best) return { floor: best };
    const c0 = Math.floor(ch.x - G.ox + 0.5), r0 = Math.floor(ch.z - G.oz + 0.5);
    let bt = null, bs = -1;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const t = G.tiles[r0 + dr] && G.tiles[r0 + dr][c0 + dc];
      if (!t || t.type === 'floor') continue;
      const dx = t.x - ch.x, dz = t.z - ch.z, d = Math.hypot(dx, dz);
      if (d > 1.35) continue;
      const dot = (dx * fx + dz * fz) / d;
      const s = dot - d * 0.35;
      if (dot > 0.45 && s > bs) { bs = s; bt = t; }
    }
    return bt ? { tile: bt } : null;
  }

  // ---------------- TƯƠNG TÁC ----------------
  function canPlace(t, it) {
    switch (t.type) {
      case 'counter': case 'board': return true;
      case 'stove': return it.kind === 'pot';
      case 'grill': return isIng(it) && INGREDIENTS[it.kind].proc.includes('grill') && (it.state === 'raw' || it.state === 'grilled' || it.state === 'burnt');
      default: return false;
    }
  }

  function plateAccepts(plate, key) {
    if (key.endsWith(':burnt')) return 'Cháy đen rồi! Vứt đi!';
    if (plate.contents.includes(key)) return 'Có rồi mà!';
    if (plate.contents.length >= 4) return 'Đầy bát rồi!';
    const next = [...plate.contents, key];
    if (G.recipes.some(r => next.every(k => RECIPES[r].parts.includes(k)))) return null;
    const kind = key.split(':')[0];
    if (G.recipes.some(r => RECIPES[r].parts.some(p => p.startsWith(kind + ':')))) return 'Cần sơ chế trước!';
    return 'Không hợp món nào!';
  }

  function tryAddToPlate(plate, key, x, z) {
    const err = plateAccepts(plate, key);
    if (err) { popup(err, x, 1.6, z, 'warn'); Audio.play('wrong'); return false; }
    plate.contents.push(key);
    rebuild(plate);
    Audio.play('pick');
    return true;
  }

  function interact(ch) {
    const tg = getTarget(ch), h = ch.holding;
    if (!h) {
      if (!tg) return;
      if (tg.floor) { G.floor.splice(G.floor.indexOf(tg.floor), 1); give(ch, tg.floor.it); return; }
      const t = tg.tile;
      if (t.type === 'crate') { give(ch, newItem(t.crate)); return; }
      if (t.type === 'plates') { give(ch, newItem('plate')); return; }
      if (t.item) { const it = t.item; t.item = null; give(ch, it); }
      return;
    }
    if (!tg || tg.floor) {
      // đặt xuống sàn trước mặt
      let x = ch.x + Math.sin(ch.face) * 0.5, z = ch.z + Math.cos(ch.face) * 0.5;
      if (solid(tileAt(x, z))) { x = ch.x; z = ch.z; }
      ch.holding = null; addFloor(h, x, z); Audio.play('drop');
      return;
    }
    const t = tg.tile;
    if (t.type === 'trash') { trashHeld(ch); return; }
    if (t.type === 'window') {
      if (h.kind === 'plate') { if (serve(h, t, false)) { ch.holding = null; detach(h); } }
      else popup('Bày ra bát đã!', t.x, 1.6, t.z, 'warn');
      return;
    }
    if (t.type === 'crate') {
      if (h.kind === 'plate') tryAddToPlate(h, `${t.crate}:raw`, t.x, t.z);
      return;
    }
    if (t.type === 'plates') return;
    if (!t.item) {
      if (canPlace(t, h)) { ch.holding = null; place(t, h); Audio.play('drop'); }
      else if (t.type === 'grill') popup('Chỉ nướng thịt / bột!', t.x, 1.6, t.z, 'warn');
      else if (t.type === 'stove') popup('Đặt nồi lên bếp!', t.x, 1.6, t.z, 'warn');
      return;
    }
    const o = t.item;
    if (h.kind === 'plate') {
      if (o.kind === 'pot') {
        if (o.content && o.content.state !== 'raw' && tryAddToPlate(h, `${o.content.kind}:${o.content.state}`, t.x, t.z)) { o.content = null; rebuild(o); }
        else if (o.content && o.content.state === 'raw') popup('Chưa chín!', t.x, 1.6, t.z, 'warn');
      } else if (isIng(o)) {
        if (tryAddToPlate(h, keyOf(o), t.x, t.z)) { t.item = null; detach(o); }
      }
      return;
    }
    if (h.kind === 'pot') {
      if (o.kind === 'plate' && h.content && h.content.state !== 'raw') {
        if (tryAddToPlate(o, `${h.content.kind}:${h.content.state}`, t.x, t.z)) { h.content = null; rebuild(h); }
      } else if (isIng(o) && !h.content && o.state === 'raw' && INGREDIENTS[o.kind].proc.includes('boil')) {
        h.content = { kind: o.kind, state: 'raw', cook: 0, burn: 0 }; t.item = null; detach(o); rebuild(h);
      }
      return;
    }
    // đang cầm nguyên liệu
    if (o.kind === 'plate') {
      if (tryAddToPlate(o, keyOf(h), t.x, t.z)) { ch.holding = null; detach(h); }
    } else if (o.kind === 'pot') {
      if (!o.content && h.state === 'raw' && INGREDIENTS[h.kind].proc.includes('boil')) {
        o.content = { kind: h.kind, state: 'raw', cook: 0, burn: 0 }; ch.holding = null; detach(h); rebuild(o); Audio.play('drop');
      } else popup(o.content ? 'Nồi đang có đồ!' : 'Không luộc được món này!', t.x, 1.6, t.z, 'warn');
    } else popup('Chỗ này có đồ rồi!', t.x, 1.6, t.z, 'warn');
  }

  function trashHeld(ch) {
    const h = ch.holding;
    if (h.kind === 'plate') { h.contents = []; rebuild(h); }
    else if (h.kind === 'pot') { h.content = null; rebuild(h); }
    else { ch.holding = null; detach(h); }
    Audio.play('drop');
  }

  function doAction(ch, dt) {
    const tg = getTarget(ch);
    if (!tg || !tg.tile || tg.tile.type !== 'board') return false;
    const it = tg.tile.item;
    if (!it || !isIng(it) || it.state !== 'raw' || !INGREDIENTS[it.kind].proc.includes('chop')) return false;
    it.progress += dt / 1.4;
    ch.chopSfx -= dt;
    if (ch.chopSfx <= 0) { Audio.play('chop'); ch.chopSfx = 0.17; spark(tg.tile.x, 1.0, tg.tile.z, 0xffffff, 2, 1.5); }
    if (it.progress >= 1) { it.state = 'chopped'; it.progress = 0; rebuild(it); Audio.play('done'); }
    return true;
  }

  function throwHeld(ch) {
    const h = ch.holding;
    if (!h || !isIng(h)) { if (h) popup('Không ném được cái này!', ch.x, 1.9, ch.z, 'warn'); return; }
    ch.holding = null;
    const fx = Math.sin(ch.face), fz = Math.cos(ch.face);
    launch(h, ch.x + fx * 0.5, 0.75 + ch.y, ch.z + fz * 0.5, fx * 7.5 + ch.vx * 0.4, 4.2, fz * 7.5 + ch.vz * 0.4, ch, false);
    Audio.play('throw');
  }

  // ---------------- PHỤC VỤ ----------------
  function serve(plate, t, spectacular) {
    const set = plate.contents.slice().sort().join('|');
    const idx = G.orders.findIndex(o => RECIPES[o.recipe].parts.slice().sort().join('|') === set);
    if (idx < 0) {
      popup(plate.contents.length ? 'Sai món rồi!' : 'Bát trống trơn!', t.x, 1.7, t.z, 'warn');
      Audio.play('wrong');
      return false;
    }
    const o = G.orders[idx];
    const rc = RECIPES[o.recipe];
    const tip = Math.ceil(rc.price * 0.5 * (o.t / o.max)) * G.tipMult;
    let gain = rc.price + tip;
    if (spectacular) { gain += 20; G.stats.spectacular++; banner('🤯 CÚ VA NGOẠN MỤC! Món bay thẳng vào cửa! +20', 2.5); }
    addScore(gain, t.x, t.z, `+${gain}`);
    G.orders.splice(idx, 1); G.ordersDirty = true;
    G.stats.served++;
    G.tipMult = Math.min(4, G.tipMult + 1);
    Audio.play('serve');
    for (let i = 0; i < 18; i++) spark(t.x, 1.2, t.z, [0xffeb3b, 0xff5252, 0x69f0ae, 0x40c4ff][i % 4], 1, 4);
    customerReact('happy', t.x, t.z);
    return true;
  }

  function addScore(n, x, z, text) {
    G.score = Math.max(0, G.score + n);
    if (text) popup(text, x, 1.8, z, n >= 0 ? 'gain' : 'loss');
  }

  // ---------------- PHYSICS: PROJECTILES ----------------
  function launch(it, x, y, z, vx, vy, vz, owner, fromBump) {
    detach(it); world.add(it.mesh);
    it.mesh.position.set(x, y, z); it.mesh.scale.setScalar(1);
    G.proj.push({ it, x, y, z, vx, vy, vz, owner, fromBump, t: 0, bounces: 0, spin: (Math.random() - 0.5) * 16 });
  }

  function updateProjectiles(dt) {
    for (let i = G.proj.length - 1; i >= 0; i--) {
      const p = G.proj[i];
      p.t += dt;
      const px = p.x, pz = p.z, py = p.y;
      p.vy -= GRAV * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.it.mesh.position.set(p.x, p.y, p.z);
      p.it.mesh.rotation.x += p.spin * dt; p.it.mesh.rotation.z += p.spin * 0.6 * dt;
      let done = false;
      // bắt / trúng đầu bếp
      for (const ch of G.chefs) {
        if (ch === p.owner && p.t < 0.35) continue;
        if (Math.hypot(ch.x - p.x, ch.z - p.z) < 0.5 && p.y > 0.3 + ch.y && p.y < 1.7 + ch.y) {
          if (!ch.holding && ch.stun <= 0) {
            G.proj.splice(i, 1); resetRot(p.it); give(ch, p.it);
            Audio.play('catch'); say(ch, pick(LINES.catch));
            G.stats.catches++;
            if (p.fromBump) { addScore(8, ch.x, ch.z, 'Cứu bóng! +8'); }
            done = true;
          } else if (p.owner !== ch) {
            ch.stun = Math.max(ch.stun, 0.35); say(ch, pick(LINES.hit)); Audio.play('boing');
            p.vx *= -0.3; p.vz *= -0.3; p.x = px; p.z = pz;
          }
          break;
        }
      }
      if (done) continue;
      const t = tileAt(p.x, p.z);
      if (!t) {
        if (p.y < (G.water ? -0.4 : 0)) { G.proj.splice(i, 1); lostItem(p); }
        continue;
      }
      if (t.type !== 'floor') {
        if (py >= TOP && p.y < TOP) { G.proj.splice(i, 1); landOnTile(p, t); }
        else if (p.y < TOP) { p.x = px; p.z = pz; p.vx *= -0.4; p.vz *= -0.4; }
        continue;
      }
      if (p.y <= 0.03) { G.proj.splice(i, 1); landFloor(p); }
    }
  }

  function resetRot(it) { it.mesh.rotation.set(0, 0, 0); }

  function bounceBack(p) {
    p.bounces++;
    if (p.bounces > 3) {
      // rơi xuống ô sàn gần nhất
      let best = null, bd = 1e9;
      for (const f of G.floorTiles) { const d = Math.hypot(f.x - p.x, f.z - p.z); if (d < bd) { bd = d; best = f; } }
      landFloor(Object.assign(p, { x: best.x + (Math.random() - 0.5) * 0.4, z: best.z + (Math.random() - 0.5) * 0.4 }));
      return;
    }
    p.y = TOP + 0.05; p.vy = 3.5;
    p.vx = -p.vx * 0.5 + (Math.random() - 0.5); p.vz = -p.vz * 0.5 + (Math.random() - 0.5);
    G.proj.push(p);
  }

  function landOnTile(p, t) {
    const it = p.it; resetRot(it);
    if (t.type === 'trash') {
      if (it.kind === 'pot') { it.content = null; rebuild(it); return bounceBack(p); }
      detach(it); Audio.play('drop'); return;
    }
    if (t.type === 'window') {
      if (it.kind === 'plate' && it.contents.length && serve(it, t, p.fromBump || !!p.owner)) { detach(it); return; }
      return bounceBack(p);
    }
    if (t.type === 'crate' || t.type === 'plates') return bounceBack(p);
    if (!t.item && canPlace(t, it)) { place(t, it); Audio.play('drop'); if (p.owner && !p.fromBump) popup('Chuẩn!', t.x, 1.5, t.z, 'gain'); return; }
    if (t.item && t.item.kind === 'plate' && isIng(it) && !plateAccepts(t.item, keyOf(it))) {
      t.item.contents.push(keyOf(it)); rebuild(t.item); detach(it);
      addScore(3, t.x, t.z, 'Chuẩn không cần chỉnh! +3'); Audio.play('catch'); return;
    }
    if (t.item && t.item.kind === 'pot' && isIng(it) && !t.item.content && it.state === 'raw' && INGREDIENTS[it.kind].proc.includes('boil')) {
      t.item.content = { kind: it.kind, state: 'raw', cook: 0, burn: 0 }; rebuild(t.item); detach(it);
      addScore(3, t.x, t.z, 'Vào nồi! +3'); Audio.play('splash'); return;
    }
    bounceBack(p);
  }

  function landFloor(p) {
    const it = p.it; resetRot(it);
    if (it.kind === 'plate' && it.contents.length) {
      spill(p.x, p.z, it.contents.some(k => k.includes('cooked')) ? 0xc89048 : null);
      it.contents = []; rebuild(it);
      addScore(-5, p.x, p.z, 'Đổ hết rồi! -5');
    } else if (it.kind === 'pot' && it.content) {
      spill(p.x, p.z, 0xc89048);
      it.content = null; rebuild(it);
      addScore(-5, p.x, p.z, 'Đổ nồi nước lèo! -5');
    } else Audio.play('drop');
    addFloor(it, p.x, p.z);
  }

  function spill(x, z, color) {
    G.stats.spills++;
    Audio.play('splash');
    if (color) addPuddle(x, z, color, 0.75, 30);
    for (let i = 0; i < 10; i++) spark(x, 0.2, z, color || 0xffffff, 1, 3);
    registerChaos();
  }

  function lostItem(p) {
    detach(p.it);
    if (p.it.kind === 'pot') G.pendingPots.push(6);
    const food = p.it.kind === 'plate' ? p.it.contents.length > 0 : p.it.kind !== 'pot';
    if (food) { addScore(-5, p.x, p.z, 'Bay ra đường! -5'); G.stats.spills++; }
    Audio.play('boing');
    customerReact(Math.random() < 0.5 ? 'angry' : 'laugh', p.x, p.z);
  }

  // ---------------- PUDDLES / BANANA ----------------
  function addPuddle(x, z, color, r, life) {
    const m = Models.makePuddle(color, r);
    m.position.x = x; m.position.z = z; world.add(m);
    G.puddles.push({ x, z, r, mesh: m, life, max: life });
  }

  function addBanana(x, z) {
    const m = Models.makeBanana(); m.position.set(x, 0.02, z); m.rotation.y = Math.random() * 6; world.add(m);
    G.bananas.push({ x, z, mesh: m });
  }

  // ---------------- CHEF ----------------
  function updateChef(ch, inp, dt) {
    const u = ch.mesh.userData;
    ch.dashCd -= dt; ch.dashT -= dt; ch.stun -= dt; ch.bumpCd -= dt; ch.npcCd -= dt;
    let mx = 0, mz = 0;
    const ctrl = ch.stun <= 0 && inp;
    if (ctrl) { mx = inp.x; mz = inp.z; }
    if (Math.hypot(mx, mz) > 0.15) ch.faceTarget = Math.atan2(mx, mz);
    let acc = G.accel;
    let onWet = false;
    for (const p of G.puddles) if ((p.x - ch.x) ** 2 + (p.z - ch.z) ** 2 < p.r * p.r) { onWet = true; break; }
    if (onWet) acc = 2.2;
    if (ch.stun > 0) acc = Math.min(acc, 2.5);
    if (ch.dashT > 0) acc = Math.min(acc, 5);
    const k = Math.min(1, acc * dt);
    ch.vx += (mx * WALK - ch.vx) * k;
    ch.vz += (mz * WALK - ch.vz) * k;
    ch.vx += G.force.x * dt; ch.vz += G.force.z * dt;
    if (ctrl && inp.dash && ch.dashCd <= 0) {
      ch.vx += Math.sin(ch.face) * DASH_V; ch.vz += Math.cos(ch.face) * DASH_V;
      ch.dashCd = 0.6; ch.dashT = 0.28; Audio.play('dash');
      for (let i = 0; i < 5; i++) spark(ch.x, 0.15, ch.z, 0xffffff, 1, 1.5);
    }
    const sp = Math.hypot(ch.vx, ch.vz);
    if (sp > 16) { ch.vx *= 16 / sp; ch.vz *= 16 / sp; }
    ch.x += ch.vx * dt; ch.z += ch.vz * dt;
    collideTiles(ch);

    // vỏ chuối
    for (let i = G.bananas.length - 1; i >= 0; i--) {
      const b = G.bananas[i];
      if (Math.hypot(b.x - ch.x, b.z - ch.z) < 0.38 && sp > 1.2) {
        world.remove(b.mesh); G.bananas.splice(i, 1);
        slip(ch);
      }
    }

    ch.vy -= GRAV * dt; ch.y += ch.vy * dt; if (ch.y < 0) { ch.y = 0; ch.vy = 0; }
    if (ch.spinT > 0) { ch.spinT -= dt; ch.face += dt * 16; }
    else ch.face = lerpAngle(ch.face, ch.faceTarget, Math.min(1, dt * 14));
    ch.mesh.position.set(ch.x, ch.y, ch.z);
    ch.mesh.rotation.y = ch.face;

    // hành động
    ch.chopping = false;
    if (ctrl) {
      if (inp.pick) interact(ch);
      if (inp.thr) throwHeld(ch);
      if (inp.act && !ch.holding) ch.chopping = doAction(ch, dt);
    }

    // hoạt cảnh
    const spd = Math.hypot(ch.vx, ch.vz);
    ch.anim += dt * spd * 3;
    u.body.position.y = spd > 0.6 ? Math.abs(Math.sin(ch.anim)) * 0.08 : 0;
    u.body.rotation.z = spd > 0.6 ? Math.sin(ch.anim) * 0.07 : 0;
    u.body.rotation.x = ch.stun > 0 ? -0.3 : 0;
    if (ch.holding) { u.handL.position.set(-0.2, 0.6, 0.38); u.handR.position.set(0.2, 0.6, 0.38); }
    else if (ch.chopping) {
      const s = Math.sin(G.time * 30) * 0.15;
      u.handR.position.set(0.2, 0.7 + s, 0.4); u.handL.position.set(-0.22, 0.55, 0.35);
    } else {
      const s = spd > 0.6 ? Math.sin(ch.anim) * 0.12 : 0;
      u.handL.position.set(-0.32, 0.5, 0.05 + s); u.handR.position.set(0.32, 0.5, 0.05 - s);
    }
    u.stars.visible = ch.stun > 0;
    u.stars.rotation.y += dt * 8;
    u.mouth.scale.set(ch.stun > 0 ? 0.8 : 1, ch.stun > 0 ? 4 : 1, 1);
    const inactive = G.mode === 'solo' && G.active !== ch.id;
    u.ring.material.opacity = inactive ? 0.25 : 0.85;

    // highlight mục tiêu
    const tg = inactive ? null : getTarget(ch);
    if (tg && tg.tile) { ch.hl.visible = true; ch.hl.position.set(tg.tile.x, TOP + 0.02, tg.tile.z); ch.hl.scale.set(1, 1, 1); }
    else if (tg && tg.floor) { ch.hl.visible = true; ch.hl.position.set(tg.floor.x, 0.03, tg.floor.z); ch.hl.scale.set(0.5, 1, 0.5); }
    else ch.hl.visible = false;
  }

  function collideTiles(ch) {
    const c0 = Math.floor(ch.x - G.ox + 0.5), r0 = Math.floor(ch.z - G.oz + 0.5);
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const r = r0 + dr, c = c0 + dc;
      const t = G.tiles[r] && G.tiles[r][c];
      if (t && t.type === 'floor') continue;
      const cx = c + G.ox, cz = r + G.oz;
      const qx = Math.max(cx - 0.5, Math.min(ch.x, cx + 0.5)), qz = Math.max(cz - 0.5, Math.min(ch.z, cz + 0.5));
      let dx = ch.x - qx, dz = ch.z - qz, d = Math.hypot(dx, dz);
      if (d >= R) continue;
      if (d < 1e-5) { dx = ch.x - cx; dz = ch.z - cz; d = Math.hypot(dx, dz) || 1; }
      const nx = dx / d, nz = dz / d;
      const pen = R - (d < 1e-5 ? 0 : d);
      ch.x += nx * pen; ch.z += nz * pen;
      const vn = ch.vx * nx + ch.vz * nz;
      if (vn < 0) {
        const bounce = ch.stun > 0 ? 1.6 : 1;
        ch.vx -= bounce * vn * nx; ch.vz -= bounce * vn * nz;
        if (ch.stun > 0 && vn < -4 && ch.holding) dropHeld(ch, -nx, -nz);
      }
    }
  }

  function slip(ch) {
    const sp = Math.max(4.5, Math.hypot(ch.vx, ch.vz));
    const fx = Math.sin(ch.face), fz = Math.cos(ch.face);
    ch.vx = fx * sp * 1.3; ch.vz = fz * sp * 1.3;
    ch.stun = 1.1; ch.spinT = 1.0; ch.vy = 3;
    Audio.play('slip');
    say(ch, pick(LINES.slip));
    dropHeld(ch, fx, fz);
    G.shake = Math.max(G.shake, 0.25);
    registerChaos();
    if (Math.random() < 0.6) customerReact('laugh');
  }

  function dropHeld(ch, dx, dz) {
    if (!ch.holding) return;
    const it = ch.holding; ch.holding = null;
    launch(it, ch.x + dx * 0.3, 0.9 + ch.y, ch.z + dz * 0.3,
      ch.vx * 0.55 + dx * 2 + (Math.random() - 0.5) * 1.5, 6 + Math.random() * 1.5, ch.vz * 0.55 + dz * 2 + (Math.random() - 0.5) * 1.5, null, true);
  }

  function chefCollide(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
    if (d >= 2 * R || d < 1e-4) return;
    const nx = dx / d, nz = dz / d;
    const rel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
    const ov = 2 * R - d;
    a.x -= nx * ov / 2; a.z -= nz * ov / 2; b.x += nx * ov / 2; b.z += nz * ov / 2;
    const dashing = a.dashT > 0 || b.dashT > 0;
    if (rel > 0 && (rel > BUMP_SPEED || (dashing && rel > 3)) && a.bumpCd <= 0 && b.bumpCd <= 0) bigBump(a, b, nx, nz, rel);
    else if (rel > 0) {
      const j = rel * 0.5;
      a.vx -= nx * j; a.vz -= nz * j; b.vx += nx * j; b.vz += nz * j;
    }
  }

  function bigBump(a, b, nx, nz, rel) {
    const ca = a.vx * nx + a.vz * nz, cb = -(b.vx * nx + b.vz * nz);
    const causer = ca >= cb ? a : b;
    const pa = { vx: a.vx, vz: a.vz }, pb = { vx: b.vx, vz: b.vz };
    const imp = 4 + rel * 0.55;
    a.vx = -nx * imp; a.vz = -nz * imp; b.vx = nx * imp; b.vz = nz * imp;
    a.stun = b.stun = 0.75; a.bumpCd = b.bumpCd = 0.6; a.spinT = b.spinT = 0.35;
    a.vy = b.vy = 3;
    // đồ trên tay văng theo quán tính trước va chạm
    for (const [ch, pv, sgn] of [[a, pa, 1], [b, pb, -1]]) {
      if (!ch.holding) continue;
      const it = ch.holding; ch.holding = null;
      launch(it, ch.x, 1.0, ch.z, pv.vx * 0.75 + sgn * nx * 1.2 + (Math.random() - 0.5), 6.5 + Math.random() * 2, pv.vz * 0.75 + sgn * nz * 1.2 + (Math.random() - 0.5), null, true);
    }
    G.stats.bumps++;
    causer.caused++;
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    popup(pick(['BỐP!', 'BỊCH!', 'RẦM!', 'UỲNH!']), mx, 1.9, mz, 'pow');
    for (let i = 0; i < 14; i++) spark(mx, 0.9, mz, i % 2 ? 0xffeb3b : 0xffffff, 1, 5);
    Audio.play('bigbump');
    G.shake = Math.max(G.shake, 0.45);
    say(a, pick(LINES[a.def.region]));
    setTimeout(() => G && b && say(b, pick(LINES[b.def.region])), 450);
    registerChaos();
    if (Math.random() < 0.7) customerReact(Math.random() < 0.6 ? 'laugh' : 'angry');
  }

  function hitChef(ch, nx, nz, power, line) {
    if (ch.npcCd > 0) return;
    ch.npcCd = 1;
    ch.vx = nx * power; ch.vz = nz * power; ch.vy = 4;
    ch.stun = 1.0; ch.spinT = 0.6;
    dropHeld(ch, nx, nz);
    say(ch, line || pick(LINES[ch.def.region]));
    Audio.play('bigbump');
    G.shake = Math.max(G.shake, 0.5);
    G.stats.bumps++;
    registerChaos();
  }

  function registerChaos() {
    if (G.time - G.lastChaos < 2.2) G.combo++; else G.combo = 1;
    G.lastChaos = G.time;
    G.stats.maxCombo = Math.max(G.stats.maxCombo, G.combo);
    if (G.combo >= 2 && api.onCombo) api.onCombo(G.combo);
  }

  // ---------------- CUSTOMERS ----------------
  function customerReact(kind, x, z) {
    if (!G.customers.length) return;
    let c;
    if (x !== undefined) {
      let bd = 1e9;
      for (const cu of G.customers) { const d = Math.hypot(cu.x - x, cu.z - z); if (d < bd && cu.cd <= 0) { bd = d; c = cu; } }
    }
    if (!c) { const free = G.customers.filter(cu => cu.cd <= 0); if (!free.length) return; c = pick(free); }
    c.cd = 2.5; c.jumpT = 0.6;
    const text = pick(c.def[kind] || c.def.angry);
    label(text, () => tv.set(c.x, c.baseY + 1.8, c.z), 'bubble cust ' + kind, 2.2);
    if (kind === 'laugh') Audio.play('laugh');
    else if (kind === 'angry') Audio.play('grumble');
  }

  function updateCustomers(dt) {
    for (const c of G.customers) {
      c.cd -= dt;
      c.jumpT -= dt;
      const j = c.jumpT > 0 ? Math.abs(Math.sin(c.jumpT * 15)) * 0.25 : 0;
      c.mesh.position.y = c.baseY + j + (G.water ? Math.sin(G.time * 1.3 + c.x) * 0.05 : 0);
      c.mesh.userData.head.rotation.z = Math.sin(G.time * 2 + c.x) * 0.08;
    }
  }

  // ---------------- ORDERS ----------------
  function spawnOrder() {
    const recipe = pick(G.recipes);
    const max = RECIPES[recipe].time + (G.mode === 'solo' ? 25 : 0);
    G.orders.push({ recipe, t: max, max, id: Math.random() });
    G.ordersDirty = true;
    Audio.play('pop');
  }

  function updateOrders(dt) {
    G.orderTimer -= dt;
    if (G.orderTimer <= 0 && G.orders.length < 5) {
      spawnOrder();
      G.orderTimer = G.orders.length < 2 ? 3 : 15 + Math.random() * 7;
    }
    for (let i = G.orders.length - 1; i >= 0; i--) {
      const o = G.orders[i];
      o.t -= dt;
      if (o.t <= 0) {
        G.orders.splice(i, 1); G.ordersDirty = true;
        G.stats.failed++;
        G.tipMult = 1;
        const w = G.tiles.flat().find(t => t.type === 'window');
        addScore(-10, w ? w.x : 0, w ? w.z : 0, 'Khách bỏ về! -10');
        Audio.play('expire');
        customerReact('angry');
      }
    }
  }

  // ---------------- COOKING ----------------
  function updateCooking(dt) {
    const powerOut = !!G.ev.power;
    for (const row of G.tiles) for (const t of row) {
      if (t.type === 'stove' || t.type === 'grill') {
        if (t.mesh.userData.flame) t.mesh.userData.flame.visible = !powerOut;
      }
      if (powerOut || !t.item) continue;
      let c = null;
      if (t.type === 'stove' && t.item.kind === 'pot' && t.item.content) c = t.item.content;
      else if (t.type === 'grill' && isIng(t.item)) c = t.item;
      if (!c || c.state === 'burnt') continue;
      const holder = t.type === 'stove' ? t.item : t.item;
      if (c.state === 'raw') {
        c.cook = (c.cook || 0) + dt / (t.type === 'stove' ? 7 : 6);
        if (Math.random() < dt * 4) steam(t.x, t.z);
        if (c.cook >= 1) { c.state = t.type === 'stove' ? 'cooked' : 'grilled'; c.burn = 0; rebuild(holder); Audio.play('done'); }
      } else {
        c.burn = (c.burn || 0) + dt / 11;
        if (c.burn > 0.55) {
          c.warn = (c.warn || 0) - dt;
          if (c.warn <= 0) { Audio.play('burnWarn'); c.warn = 0.5; }
          if (Math.random() < dt * 6) smoke(t.x, t.z, 0x666666);
        }
        if (c.burn >= 1) { c.state = 'burnt'; rebuild(holder); Audio.play('burnt'); popup('Cháy rồi!!', t.x, 1.7, t.z, 'loss'); registerChaos(); }
      }
      if (t.type === 'grill' && Math.random() < dt * 2) Audio.play('sizzle');
    }
    // nồi bị mất -> trả lại sau ít giây
    for (let i = G.pendingPots.length - 1; i >= 0; i--) {
      G.pendingPots[i] -= dt;
      if (G.pendingPots[i] <= 0) {
        const st = G.tiles.flat().find(t => t.type === 'stove' && !t.item);
        if (st) { place(st, newItem('pot')); popup('Nồi mới!', st.x, 1.6, st.z, 'gain'); }
        G.pendingPots.splice(i, 1);
      }
    }
  }

  // ---------------- EVENTS ----------------
  function banner(text, dur) { if (api.onBanner) api.onBanner(text, dur || 2.5); }

  function startEvent(name) {
    const info = EVENT_INFO[name];
    if (info) { banner(info.banner); Audio.play(info.sfx); }
    const W = G.W;
    switch (name) {
      case 'police': case 'moto': {
        const r = pick(G.lanes);
        const z = r + G.oz, dir = Math.random() < 0.5 ? 1 : -1;
        const mesh = name === 'police' ? Models.makePolice() : Models.makeMoto();
        mesh.position.set(-dir * (W / 2 + 2), 0, z); mesh.rotation.y = name === 'police' ? dir * Math.PI / 2 : (dir > 0 ? 0 : Math.PI);
        mesh.visible = false; world.add(mesh);
        const warn = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.9), new THREE.MeshBasicMaterial({ color: 0xff1744, transparent: true, opacity: 0.3, depthWrite: false }));
        warn.rotation.x = -Math.PI / 2; warn.position.set(0, 0.04, z); world.add(warn);
        G.npcs.push({ type: name, mesh, warn, x: -dir * (W / 2 + 2), z, dir, delay: name === 'moto' ? 1.6 : 2.2, speed: name === 'moto' ? 13 : 3.2, t: 0 });
        break;
      }
      case 'inspector': G.ev.inspector = 9; break;
      case 'banana': {
        const n = 1 + (Math.random() < 0.5 ? 1 : 0);
        for (let i = 0; i < n; i++) { const t = pick(G.floorTiles); addBanana(t.x + (Math.random() - 0.5) * 0.4, t.z + (Math.random() - 0.5) * 0.4); }
        customerReact('angry');
        break;
      }
      case 'rain': G.ev.rain = 13; G.rainSpawn = 0; break;
      case 'power': G.ev.power = 9; break;
      case 'bigwave': G.ev.bigwave = 2.2; G.waveDir = Math.random() < 0.5 ? 1 : -1; break;
      case 'fogthick': G.ev.fogthick = 11; break;
      case 'firecracker': G.ev.firecracker = 2.4; G.fcNext = 0; break;
    }
  }

  function updateEvents(dt) {
    G.nextEvent -= dt;
    if (G.nextEvent <= 0 && G.timeLeft > 12) {
      startEvent(pick(G.lv.events));
      G.nextEvent = 18 + Math.random() * 12;
    }
    const ev = G.ev;
    // lực môi trường
    let fx = 0, fz = 0;
    if (G.lv.modifiers.includes('waves')) fx += Math.sin(G.time * 0.9) * 3.2;
    if (G.lv.modifiers.includes('slope')) fz += 2.6;
    if (ev.bigwave) fx += G.waveDir * 22;
    G.force.x = fx; G.force.z = fz;

    // NPC
    for (let i = G.npcs.length - 1; i >= 0; i--) {
      const n = G.npcs[i];
      n.t += dt;
      if (n.t < n.delay) { n.warn.material.opacity = 0.15 + Math.abs(Math.sin(n.t * 10)) * 0.35; continue; }
      if (!n.mesh.visible) { n.mesh.visible = true; if (n.type === 'moto') Audio.play('engine'); else Audio.play('whistle'); }
      n.warn.visible = false;
      n.x += n.dir * n.speed * dt;
      n.mesh.position.x = n.x;
      if (n.type === 'police') n.mesh.position.y = Math.abs(Math.sin(n.t * 8)) * 0.08;
      for (const ch of G.chefs) {
        if (Math.abs(ch.x - n.x) < 0.65 && Math.abs(ch.z - n.z) < 0.7) {
          const side = ch.z >= n.z ? 1 : -1;
          if (n.type === 'moto') hitChef(ch, n.dir * 0.6, side * 0.8, 13, pick(['Xe máy kìa!!', 'Ối giời ơi!', 'Má ơi xe!']));
          else hitChef(ch, n.dir * 0.8, side * 0.6, 7, 'Dạ em dẹp ngay ạ!');
        }
      }
      // cuốn theo đồ dưới sàn
      for (let j = G.floor.length - 1; j >= 0; j--) {
        const f = G.floor[j];
        if (Math.abs(f.x - n.x) < 0.6 && Math.abs(f.z - n.z) < 0.6) {
          G.floor.splice(j, 1);
          launch(f.it, f.x, 0.3, f.z, n.dir * 5, 5, (Math.random() - 0.5) * 3, null, true);
        }
      }
      if (Math.abs(n.x) > G.W / 2 + 2.5) { world.remove(n.mesh); world.remove(n.warn); G.npcs.splice(i, 1); }
    }

    // Thanh tra
    if (ev.inspector !== undefined) {
      const prev = Math.ceil(ev.inspector);
      ev.inspector -= dt;
      if (Math.ceil(ev.inspector) !== prev && ev.inspector > 0 && prev <= 4) Audio.play('countdown');
      if (ev.inspector <= 0) {
        delete ev.inspector;
        const dirt = G.floor.length + G.puddles.length + G.bananas.length;
        if (dirt === 0) { banner('🧐 Thanh tra: "Sạch bong! Khen!" +15'); addScore(15); Audio.play('serve'); }
        else { banner(`🧐 Thanh tra: "Bẩn quá!" ${dirt} vết bẩn → -${dirt * 5}`); addScore(-dirt * 5); Audio.play('wrong'); }
      }
    }
    // Mưa
    G.rain.visible = !!ev.rain;
    if (ev.rain) {
      ev.rain -= dt;
      G.rainSpawn -= dt;
      if (G.rainSpawn <= 0) { const t = pick(G.floorTiles); addPuddle(t.x, t.z, 0x64b5f6, 0.55, 22); G.rainSpawn = 1.3; }
      const a = G.rain.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) { let y = a.getY(i) - 16 * dt; if (y < 0) y += 12; a.setY(i, y); }
      a.needsUpdate = true;
      if (ev.rain <= 0) delete ev.rain;
    }
    // Mất điện
    if (ev.power) {
      ev.power -= dt;
      if (ev.power <= 0) { delete ev.power; Audio.play('powerup'); banner('💡 Có điện lại rồi!', 1.5); }
    }
    const dark = ev.power ? 0.18 : ev.rain ? 0.7 : 1;
    hemi.intensity += (G.baseLight.hemi * dark - hemi.intensity) * Math.min(1, dt * 4);
    sun.intensity += (G.baseLight.sun * dark - sun.intensity) * Math.min(1, dt * 4);
    for (const ch of G.chefs) ch.mesh.userData.lamp.intensity = ev.power ? 1.8 : (G.lv.theme.night ? 0.5 : 0);
    // Sóng lớn
    if (ev.bigwave) { ev.bigwave -= dt; G.shake = Math.max(G.shake, 0.15); if (ev.bigwave <= 0) delete ev.bigwave; }
    // Sương mù dày
    if (scene.fog) {
      const target = ev.fogthick ? 1 : 0;
      G.fogThick += (target - G.fogThick) * Math.min(1, dt * 1.2);
      setFog(G.fogThick);
      if (ev.fogthick) { ev.fogthick -= dt; if (ev.fogthick <= 0) delete ev.fogthick; }
    }
    // Pháo
    if (ev.firecracker) {
      ev.firecracker -= dt; G.fcNext -= dt;
      if (G.fcNext <= 0) {
        G.fcNext = 0.45 + Math.random() * 0.4;
        const t = pick(G.floorTiles);
        Audio.play('firecracker');
        for (let i = 0; i < 16; i++) spark(t.x, 0.3, t.z, i % 2 ? 0xff1744 : 0xffd600, 1, 6);
        popup('ĐÙNG!', t.x, 1.2, t.z, 'pow');
        G.shake = Math.max(G.shake, 0.2);
        for (const ch of G.chefs) {
          if (Math.hypot(ch.x - t.x, ch.z - t.z) < 3 && ch.y === 0) {
            ch.vy = 5.5; say(ch, pick(LINES.startle));
            if (ch.holding && Math.random() < 0.55) dropHeld(ch, Math.sin(ch.face) * 0.5, Math.cos(ch.face) * 0.5);
          }
        }
      }
      if (ev.firecracker <= 0) delete ev.firecracker;
    }
    // Vũng nước khô dần
    for (let i = G.puddles.length - 1; i >= 0; i--) {
      const p = G.puddles[i];
      p.life -= dt;
      p.mesh.material.opacity = 0.7 * Math.min(1, p.life / 4);
      if (p.life <= 0) { world.remove(p.mesh); G.puddles.splice(i, 1); }
    }
    // Thuyền / dốc
    if (G.water) {
      world.rotation.z = Math.sin(G.time * 0.9) * 0.03 + (ev.bigwave ? G.waveDir * 0.04 : 0);
      world.rotation.x = Math.sin(G.time * 0.7) * 0.012;
      world.position.y = Math.sin(G.time * 1.3) * 0.05;
    } else if (G.lv.modifiers.includes('slope')) world.rotation.x = 0.035;
  }

  // ---------------- PARTICLES ----------------
  const pGeo = new THREE.SphereGeometry(1, 6, 6);
  function particle(x, y, z, color, size, vx, vy, vz, life, grav) {
    if (G.particles.length > 220) return;
    const m = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
    m.position.set(x, y, z); m.scale.setScalar(size); world.add(m);
    G.particles.push({ m, vx, vy, vz, life, max: life, grav, size });
  }
  function spark(x, y, z, color, n, sp) {
    for (let i = 0; i < n; i++) particle(x, y, z, color, 0.05 + Math.random() * 0.04, (Math.random() - 0.5) * sp, Math.random() * sp * 0.8 + 1, (Math.random() - 0.5) * sp, 0.5 + Math.random() * 0.3, 12);
  }
  function steam(x, z) { particle(x + (Math.random() - 0.5) * 0.3, 1.2, z + (Math.random() - 0.5) * 0.3, 0xffffff, 0.08, 0, 0.8, 0, 1.2, -0.3); }
  function smoke(x, z, c) { particle(x + (Math.random() - 0.5) * 0.3, 1.2, z, c, 0.12, (Math.random() - 0.5) * 0.3, 1.0, 0, 1.6, -0.2); }
  function updateParticles(dt) {
    for (let i = G.particles.length - 1; i >= 0; i--) {
      const p = G.particles[i];
      p.life -= dt;
      p.vy -= p.grav * dt;
      p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
      const k = p.life / p.max;
      p.m.material.opacity = k * 0.9;
      if (p.grav < 0) p.m.scale.setScalar(p.size * (1 + (1 - k) * 2));
      if (p.life <= 0 || p.m.position.y < 0) { world.remove(p.m); p.m.material.dispose(); G.particles.splice(i, 1); }
    }
  }

  // ---------------- DOM LABELS ----------------
  function label(text, getPos, cls, life, rise = 0) {
    const el = document.createElement('div');
    el.className = 'wl ' + cls; el.textContent = text;
    overlay.appendChild(el);
    G.labels.push({ el, getPos, life, max: life, rise });
    return el;
  }
  function popup(text, x, y, z, cls) { label(text, () => tv.set(x, y, z), 'pop ' + (cls || ''), 1.3, 1.2); }
  function say(ch, text) {
    if (ch.bubble) { ch.bubble.life = 0; }
    const lb = label(text, () => tv.set(ch.x, ch.y + 2.0, ch.z), 'bubble p' + ch.id, 1.8);
    ch.bubble = G.labels[G.labels.length - 1];
    Audio.speak(text);
    return lb;
  }

  function project(v) {
    world.localToWorld(v);
    v.project(camera);
    return { x: (v.x + 1) / 2 * window.innerWidth, y: (1 - v.y) / 2 * window.innerHeight, vis: v.z < 1 };
  }

  function updateLabels(dt) {
    for (let i = G.labels.length - 1; i >= 0; i--) {
      const l = G.labels[i];
      l.life -= dt;
      if (l.life <= 0) { l.el.remove(); G.labels.splice(i, 1); continue; }
      const v = l.getPos();
      v.y += (l.max - l.life) * l.rise;
      const s = project(v);
      l.el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
      l.el.style.opacity = Math.min(1, l.life / 0.3);
    }
    // thanh tiến trình
    const used = new Set();
    const bar = (obj, x, z, frac, cls, icon) => {
      used.add(obj);
      let el = G.bars.get(obj);
      if (!el) {
        el = document.createElement('div'); el.className = 'pbar';
        el.innerHTML = '<i></i><b></b>'; overlay.appendChild(el); G.bars.set(obj, el);
      }
      el.className = 'pbar ' + cls;
      el.firstChild.style.width = (Math.min(1, frac) * 100) + '%';
      el.lastChild.textContent = icon || '';
      const s = project(tv.set(x, 1.55, z));
      el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%)`;
    };
    for (const row of G.tiles) for (const t of row) {
      const it = t.item;
      if (!it) continue;
      if (t.type === 'board' && isIng(it) && it.progress > 0 && it.state === 'raw') bar(it, t.x, t.z, it.progress, 'chop');
      const c = t.type === 'stove' && it.kind === 'pot' ? it.content : t.type === 'grill' && isIng(it) ? it : null;
      if (c && c.state === 'raw' && c.cook > 0) bar(c, t.x, t.z, c.cook, 'cook');
      else if (c && c.state !== 'raw' && c.state !== 'burnt' && c.burn > 0.55) bar(c, t.x, t.z, c.burn, 'burn', '⚠️');
      else if (c && c.state !== 'raw' && c.state !== 'burnt') bar(c, t.x, t.z, 1, 'ready', '✔');
    }
    for (const [obj, el] of G.bars) if (!used.has(obj)) { el.remove(); G.bars.delete(obj); }
  }

  // ---------------- MAIN LOOP ----------------
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - lastT) / 1000 || 0);
    lastT = now;
    if (G && !paused) update(dt);
    Input.pressed.clear();
    if (G) {
      G.shake = Math.max(0, G.shake - dt * 1.5);
      camera.position.set(camBase.x + (Math.random() - 0.5) * G.shake * 0.6, camBase.y + (Math.random() - 0.5) * G.shake * 0.4, camBase.z);
      renderer.render(scene, camera);
    }
  }

  function update(dt) {
    if (G.state === 'preview') {
      G.time += dt;
      updateCustomers(dt);
      for (const ch of G.chefs) {
        const a = G.time * 0.8 + ch.id * Math.PI;
        ch.mesh.rotation.y = a;
        ch.mesh.userData.body.position.y = Math.abs(Math.sin(G.time * 5 + ch.id)) * 0.1;
        ch.mesh.position.set(ch.x, 0, ch.z);
      }
      if (G.water) world.rotation.z = Math.sin(G.time * 0.9) * 0.03;
      return;
    }
    if (G.state === 'countdown') {
      const prev = Math.ceil(G.countdown);
      G.countdown -= dt;
      const cur = Math.ceil(G.countdown);
      if (cur !== prev) { if (api.onCountdown) api.onCountdown(cur > 0 ? cur : 'Bắt đầu!'); Audio.play(cur > 0 ? 'countdown' : 'go'); }
      if (G.countdown <= 0) { G.state = 'play'; }
      updateLabels(dt);
      return;
    }
    if (G.state !== 'play') { updateLabels(dt); updateParticles(dt); return; }

    G.time += dt;
    G.timeLeft -= dt;

    // input
    if (G.mode === 'solo') {
      const inp = readPlayer(0);
      if (Input.pressed.has('Tab') || inp.swap) { G.active = 1 - G.active; Audio.play('pop'); }
      G.chefs.forEach(ch => updateChef(ch, ch.id === G.active ? inp : null, dt));
    } else {
      const inps = [readPlayer(0), readPlayer(1)];
      G.chefs.forEach((ch, i) => updateChef(ch, inps[i], dt));
    }
    chefCollide(G.chefs[0], G.chefs[1]);

    updateProjectiles(dt);
    updateCooking(dt);
    updateOrders(dt);
    updateEvents(dt);
    updateCustomers(dt);
    updateParticles(dt);
    updateLabels(dt);
    if (api.onHud) api.onHud(G);

    if (G.timeLeft <= 0) finish();
  }

  function finish() {
    G.state = 'end';
    G.timeLeft = 0;
    Audio.play('go');
    const lv = G.lv;
    const stars = lv.stars.filter(s => G.score >= s).length;
    const res = { level: G.levelIndex, name: lv.name, score: G.score, stars, stats: G.stats, mode: G.mode, caused: G.chefs.map(c => c.caused) };
    if (api.onEnd) api.onEnd(res);
  }

  // ---------------- UTILS ----------------
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function lerpAngle(a, b, t) {
    let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    return a + d * t;
  }

  // ---------------- PUBLIC ----------------
  Object.assign(api, {
    init,
    preview(levelIndex) { build(levelIndex, 'coop'); G.state = 'preview'; },
    start(levelIndex, mode) { build(levelIndex, mode); G.state = 'countdown'; G.countdown = 3.5; paused = false; },
    setPaused(p) { paused = p; },
    debug: { startEvent, interact, spawnOrder },
  });
  Object.defineProperties(api, {
    paused: { get: () => paused },
    state: { get: () => (G ? G.state : null) },
    G: { get: () => G },
  });
  return api;
})();
