import * as THREE from 'three';
import { INGREDIENTS } from './data.js';

// ===== Dựng mô hình 3D bằng hình khối cơ bản (stylized / chibi) =====
export const Models = (() => {
  const matCache = new Map();
  function M(color, opts = {}) {
    const key = color + JSON.stringify(opts);
    if (matCache.has(key)) return matCache.get(key);
    const m = new THREE.MeshLambertMaterial(Object.assign({ color }, opts));
    matCache.set(key, m);
    return m;
  }
  function mesh(geo, mat, x = 0, y = 0, z = 0, shadow = true) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = shadow; m.receiveShadow = true;
    return m;
  }
  const box = (w, h, d, c, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), typeof c === 'number' ? M(c) : c, x, y, z);
  const cyl = (rt, rb, h, c, x, y, z, seg = 16) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof c === 'number' ? M(c) : c, x, y, z);
  const sph = (r, c, x, y, z, seg = 14) => mesh(new THREE.SphereGeometry(r, seg, seg), typeof c === 'number' ? M(c) : c, x, y, z);
  const torus = (r, t, c, x, y, z, arc = Math.PI * 2) => mesh(new THREE.TorusGeometry(r, t, 8, 16, arc), typeof c === 'number' ? M(c) : c, x, y, z);
  const rx = (m) => { m.rotation.x = Math.PI / 2; return m; };

  // ---- Texture vải khăn rằn (ca rô đen trắng) ----
  let checkerTex = null;
  function checker() {
    if (checkerTex) return checkerTex;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      g.fillStyle = (i + j) % 2 ? '#111' : '#f5f5f5';
      g.fillRect(i * 8, j * 8, 8, 8);
    }
    checkerTex = new THREE.CanvasTexture(c);
    checkerTex.wrapS = checkerTex.wrapT = THREE.RepeatWrapping;
    checkerTex.repeat.set(3, 1);
    return checkerTex;
  }

  // ---- Sprite nhãn (emoji + chữ) ----
  function labelSprite(emoji, text, bg = 'rgba(255,255,255,0.92)') {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = bg;
    g.beginPath(); g.arc(128, 100, 92, 0, Math.PI * 2); g.fill();
    g.lineWidth = 8; g.strokeStyle = '#3e2723'; g.stroke();
    g.font = '110px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(emoji, 128, 106);
    if (text) {
      g.font = 'bold 38px "Segoe UI",Arial,sans-serif';
      g.lineWidth = 8; g.strokeStyle = '#3e2723';
      g.strokeText(text, 128, 222); g.fillStyle = '#fff'; g.fillText(text, 128, 222);
    }
    const tex = new THREE.CanvasTexture(c);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
    sp.scale.set(0.75, 0.75, 0.75);
    return sp;
  }

  function textPlane(text, w, h, bg, fg, font = 'bold 72px "Segoe UI",Arial') {
    const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
    const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
    let size = Math.round(c.height * 0.62);
    do { g.font = font.replace(/\d+px/, size + 'px'); size -= 4; } while (g.measureText(text).width > c.width * 0.9 && size > 10);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = fg; g.shadowBlur = 18; g.fillStyle = fg;
    g.fillText(text, c.width / 2, c.height / 2);
    const tex = new THREE.CanvasTexture(c);
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  }

  // ================= ĐẦU BẾP =================
  function makeChef(opt) {
    const g = new THREE.Group();
    const skin = 0xffd7b0;
    const body = new THREE.Group(); g.add(body);
    body.add(cyl(0.07, 0.07, 0.24, 0x37474f, -0.11, 0.12, 0));
    body.add(cyl(0.07, 0.07, 0.24, 0x37474f, 0.11, 0.12, 0));
    body.add(cyl(0.24, 0.3, 0.48, opt.shirt, 0, 0.47, 0));
    const apron = box(0.36, 0.34, 0.04, 0xfafafa, 0, 0.42, 0.27); body.add(apron);
    body.add(box(0.12, 0.08, 0.01, opt.shirt, 0, 0.45, 0.295)); // logo quán phở
    const head = new THREE.Group(); head.position.y = 0.97; body.add(head);
    head.add(sph(0.29, skin, 0, 0, 0));
    head.add(sph(0.04, 0x212121, -0.1, 0.03, 0.26, 8));
    head.add(sph(0.04, 0x212121, 0.1, 0.03, 0.26, 8));
    head.add(sph(0.045, 0xff8a80, -0.17, -0.06, 0.22, 8));
    head.add(sph(0.045, 0xff8a80, 0.17, -0.06, 0.22, 8));
    const mouth = box(0.08, 0.025, 0.02, 0x6d2b2b, 0, -0.1, 0.27); head.add(mouth);
    head.add(sph(0.3, 0x2b1b12, 0, 0.06, -0.04)); head.children[head.children.length - 1].scale.set(1, 0.85, 1);
    if (opt.hat === 'nonla') {
      const hat = mesh(new THREE.ConeGeometry(0.52, 0.32, 24), M(0xe9d38f), 0, 0.33, 0);
      head.add(hat);
      head.add(rx(torus(0.3, 0.015, 0xb8a060, 0, 0.2, 0)));
    } else {
      const band = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 20, 1, true), new THREE.MeshLambertMaterial({ map: checker(), side: THREE.DoubleSide }), 0, 0.12, 0);
      head.add(band);
      const knot = sph(0.07, new THREE.MeshLambertMaterial({ map: checker() }), 0, 0.12, -0.3); head.add(knot);
      const scarf = mesh(new THREE.TorusGeometry(0.2, 0.06, 8, 18), new THREE.MeshLambertMaterial({ map: checker() }), 0, 0.72, 0);
      scarf.rotation.x = Math.PI / 2; body.add(scarf);
    }
    const handL = sph(0.09, skin, -0.32, 0.5, 0.05), handR = sph(0.09, skin, 0.32, 0.5, 0.05);
    body.add(handL, handR);
    const hold = new THREE.Object3D(); hold.position.set(0, 0.62, 0.48); body.add(hold);
    // vòng tròn dưới chân (màu người chơi)
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.46, 32), new THREE.MeshBasicMaterial({ color: opt.ring, transparent: true, opacity: 0.85 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(ring);
    // sao chóng mặt
    const stars = new THREE.Group(); stars.position.y = 1.45; stars.visible = false;
    for (let i = 0; i < 3; i++) {
      const s = mesh(new THREE.OctahedronGeometry(0.07), M(0xffeb3b, { emissive: 0x887700 }), Math.cos(i * 2.1) * 0.3, 0, Math.sin(i * 2.1) * 0.3, false);
      stars.add(s);
    }
    body.add(stars);
    // đèn pin cá nhân (khi mất điện)
    const lamp = new THREE.PointLight(0xffe0a0, 0, 4.5);
    lamp.position.set(0, 1.6, 0.3); g.add(lamp);
    g.userData = { body, head, handL, handR, hold, stars, ring, mouth, lamp };
    return g;
  }

  function makeCustomer(def) {
    const g = new THREE.Group();
    const s = def.small ? 0.7 : 1;
    const inner = new THREE.Group(); inner.scale.setScalar(s); g.add(inner);
    inner.add(cyl(0.22, 0.27, 0.42, def.shirt, 0, 0.55, 0));
    const head = new THREE.Group(); head.position.y = 1.0; inner.add(head);
    head.add(sph(0.26, 0xf3c9a0, 0, 0, 0));
    head.add(sph(0.035, 0x212121, -0.09, 0.03, 0.23, 8));
    head.add(sph(0.035, 0x212121, 0.09, 0.03, 0.23, 8));
    if (def.hat === 'helmet') { const h = sph(0.29, 0x388e3c, 0, 0.08, 0); h.scale.y = 0.75; head.add(h); }
    else if (def.hat === 'nonla') head.add(mesh(new THREE.ConeGeometry(0.48, 0.3, 20), M(0xe9d38f), 0, 0.3, 0));
    else if (def.hat === 'cap') { head.add(sph(0.27, 0xd32f2f, 0, 0.1, 0)); head.add(box(0.3, 0.03, 0.2, 0xd32f2f, 0, 0.12, 0.22)); }
    else { const h = sph(0.27, 0x3e2723, 0, 0.08, -0.03); h.scale.y = 0.8; head.add(h); }
    g.userData = { head, inner };
    return g;
  }

  function makePolice() {
    const g = new THREE.Group();
    g.add(cyl(0.08, 0.08, 0.3, 0x33402a, -0.12, 0.15, 0), cyl(0.08, 0.08, 0.3, 0x33402a, 0.12, 0.15, 0));
    g.add(cyl(0.27, 0.32, 0.55, 0x6b7d3a, 0, 0.57, 0));
    g.add(box(0.5, 0.05, 0.1, 0xc62828, 0, 0.75, 0.25));
    const head = sph(0.27, 0xf3c9a0, 0, 1.08, 0); g.add(head);
    g.add(cyl(0.3, 0.27, 0.12, 0x4e5d2a, 0, 1.33, 0), box(0.6, 0.04, 0.6, 0x4e5d2a, 0, 1.27, 0));
    g.add(rx(torus(0.29, 0.025, 0xd32f2f, 0, 1.33, 0)));
    g.add(sph(0.04, 0x212121, -0.09, 1.1, 0.24, 8), sph(0.04, 0x212121, 0.09, 1.1, 0.24, 8));
    g.add(rx(cyl(0.03, 0.03, 0.12, 0xffeb3b, 0.05, 1.0, 0.3)));
    return g;
  }

  function makeMoto() {
    const g = new THREE.Group();
    const w1 = torus(0.22, 0.08, 0x212121, 0, 0.3, 0.55); w1.rotation.y = Math.PI / 2;
    const w2 = torus(0.22, 0.08, 0x212121, 0, 0.3, -0.55); w2.rotation.y = Math.PI / 2;
    g.add(w1, w2);
    g.add(box(0.35, 0.3, 1.1, 0xe53935, 0, 0.5, 0));
    g.add(box(0.32, 0.12, 0.6, 0x212121, 0, 0.72, -0.15));
    g.add(box(0.5, 0.06, 0.06, 0x9e9e9e, 0, 0.95, 0.5));
    g.add(cyl(0.22, 0.27, 0.45, 0x1565c0, 0, 1.0, -0.1));
    g.add(sph(0.28, 0xffffff, 0, 1.45, -0.1));
    const light = sph(0.08, M(0xffffcc, { emissive: 0xffff88 }), 0, 0.7, 0.6, 8); g.add(light);
    g.rotation.y = Math.PI / 2; // chạy theo trục X
    const wrap = new THREE.Group(); wrap.add(g);
    return wrap;
  }

  // ================= NGUYÊN LIỆU =================
  function makeIngredient(kind, state) {
    const g = new THREE.Group();
    const col = (INGREDIENTS[kind] || {}).color || 0xffffff;
    if (state === 'burnt') {
      const b = sph(0.17, 0x1b1b1b, 0, 0.12, 0); b.scale.y = 0.6; g.add(b);
      g.add(sph(0.08, 0x333333, 0.1, 0.18, 0.05, 8));
      return g;
    }
    switch (kind) {
      case 'bo':
      case 'thit': {
        let c = col;
        if (state === 'grilled') c = 0x8d4b22;
        if (state === 'chopped') {
          for (let i = 0; i < 4; i++) { const s = box(0.2, 0.04, 0.12, c, -0.12 + i * 0.08, 0.05 + i * 0.015, (i % 2) * 0.05 - 0.02); s.rotation.y = 0.3; g.add(s); }
        } else {
          g.add(box(0.36, 0.14, 0.24, c, 0, 0.08, 0));
          if (state === 'grilled') for (let i = 0; i < 3; i++) g.add(box(0.04, 0.01, 0.25, 0x3e1d0b, -0.1 + i * 0.1, 0.155, 0));
          else g.add(box(0.36, 0.03, 0.05, 0xfff3e0, 0, 0.13, -0.08));
        }
        break;
      }
      case 'hanh':
      case 'rau': {
        if (state === 'chopped') {
          for (let i = 0; i < 9; i++) g.add(sph(0.045, i % 3 ? col : 0x81c784, (Math.random() - 0.5) * 0.3, 0.04, (Math.random() - 0.5) * 0.25, 6));
        } else if (kind === 'hanh') {
          for (let i = 0; i < 4; i++) { const s = cyl(0.025, 0.025, 0.45, col, -0.06 + i * 0.04, 0.05, 0, 6); s.rotation.z = Math.PI / 2; g.add(s); }
          for (let i = 0; i < 4; i++) g.add(sph(0.035, 0xffffff, -0.25, 0.05, -0.06 + i * 0.04, 6));
        } else {
          for (let i = 0; i < 4; i++) { const l = sph(0.13, i % 2 ? col : 0x66bb6a, Math.cos(i * 1.6) * 0.1, 0.07, Math.sin(i * 1.6) * 0.1, 8); l.scale.y = 0.45; g.add(l); }
        }
        break;
      }
      case 'tom': {
        const n = state === 'chopped' ? 3 : 1, r = state === 'chopped' ? 0.07 : 0.13;
        for (let i = 0; i < n; i++) { const t = torus(r, r * 0.45, col, (i - (n - 1) / 2) * 0.15, 0.06, 0, Math.PI * 1.3); t.rotation.x = -Math.PI / 2; g.add(t); }
        break;
      }
      case 'bot': {
        if (state === 'grilled') {
          const p = mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.06, 20, 1, false, 0, Math.PI), M(0xffc107), 0, 0.05, 0);
          g.add(p); g.add(sph(0.05, 0xff8a50, 0.05, 0.09, 0.08, 6), sph(0.05, 0x66bb6a, -0.06, 0.09, 0.1, 6));
        } else {
          g.add(cyl(0.2, 0.14, 0.14, 0x8d6e63, 0, 0.07, 0));
          g.add(cyl(0.18, 0.18, 0.02, col, 0, 0.14, 0));
        }
        break;
      }
      case 'trung': {
        if (state === 'chopped') {
          g.add(cyl(0.14, 0.11, 0.16, 0xeceff1, 0, 0.08, 0));
          const f = sph(0.14, 0xffe082, 0, 0.17, 0, 10); f.scale.y = 0.6; g.add(f);
        } else {
          const e = sph(0.1, col, -0.06, 0.12, 0); e.scale.y = 1.3; g.add(e);
          const e2 = sph(0.1, col, 0.08, 0.11, 0.03); e2.scale.y = 1.3; g.add(e2);
        }
        break;
      }
      case 'banhpho':
      case 'bun': {
        if (state === 'cooked') {
          for (let i = 0; i < 5; i++) { const t = torus(0.09, 0.025, 0xffffff, (Math.random() - 0.5) * 0.15, 0.05 + i * 0.02, (Math.random() - 0.5) * 0.15); t.rotation.x = Math.PI / 2 + Math.random(); g.add(t); }
        } else if (kind === 'banhpho') {
          for (let i = 0; i < 3; i++) g.add(box(0.32, 0.04, 0.22, i % 2 ? 0xfaf6ea : col, 0, 0.03 + i * 0.045, 0));
        } else {
          const b = sph(0.15, col, 0, 0.1, 0); b.scale.y = 0.6; g.add(b);
          g.add(rx(torus(0.12, 0.02, 0xeeeeee, 0, 0.12, 0)));
        }
        break;
      }
      case 'nep': {
        if (state === 'cooked') { const m = sph(0.17, 0xfffdf5, 0, 0.06, 0); m.scale.y = 0.6; g.add(m); }
        else { g.add(box(0.26, 0.28, 0.2, 0xd7ccc8, 0, 0.14, 0)); g.add(cyl(0.05, 0.08, 0.08, 0xbcaaa4, 0, 0.32, 0)); }
        break;
      }
      case 'banhmi': {
        const b = cyl(0.09, 0.09, 0.34, col, 0, 0.1, 0); b.rotation.z = Math.PI / 2; g.add(b);
        g.add(sph(0.09, col, -0.17, 0.1, 0, 10), sph(0.09, col, 0.17, 0.1, 0, 10));
        for (let i = 0; i < 3; i++) g.add(box(0.03, 0.01, 0.12, 0xb07a2a, -0.1 + i * 0.1, 0.185, 0));
        break;
      }
      case 'banhtrang': g.add(cyl(0.22, 0.22, 0.03, col, 0, 0.03, 0, 24)); g.add(cyl(0.2, 0.2, 0.03, 0xe8e0d0, 0, 0.06, 0, 24)); break;
      case 'caphe': g.add(cyl(0.1, 0.08, 0.2, 0xfafafa, 0, 0.1, 0)); g.add(cyl(0.09, 0.09, 0.02, col, 0, 0.2, 0)); break;
      case 'ladong': for (let i = 0; i < 3; i++) { const l = box(0.34, 0.015, 0.16, i % 2 ? col : 0x388e3c, 0, 0.02 + i * 0.02, 0); l.rotation.y = i * 0.5; g.add(l); } break;
      default: g.add(sph(0.14, col, 0, 0.14, 0));
    }
    return g;
  }

  function makePlate(contents) {
    const g = new THREE.Group();
    g.add(cyl(0.34, 0.24, 0.12, 0xffffff, 0, 0.06, 0, 24));
    g.add(rx(torus(0.32, 0.025, 0x1e88e5, 0, 0.12, 0)));
    const hasBroth = contents.some(k => k === 'banhpho:cooked' || k === 'bun:cooked');
    if (hasBroth) g.add(cyl(0.29, 0.29, 0.02, 0xd8a25e, 0, 0.11, 0, 20));
    contents.forEach((k, i) => {
      const [kind, st] = k.split(':');
      const m = makeIngredient(kind, st);
      const a = (i / Math.max(1, contents.length)) * Math.PI * 2;
      const r = contents.length > 1 ? 0.12 : 0;
      m.position.set(Math.cos(a) * r, 0.1, Math.sin(a) * r);
      m.scale.setScalar(0.7);
      g.add(m);
    });
    return g;
  }

  function makePot(content) {
    const g = new THREE.Group();
    g.add(cyl(0.3, 0.27, 0.32, 0x90a4ae, 0, 0.16, 0, 20));
    g.add(rx(torus(0.3, 0.025, 0x78909c, 0, 0.32, 0)));
    g.add(box(0.12, 0.04, 0.06, 0x37474f, 0.36, 0.26, 0), box(0.12, 0.04, 0.06, 0x37474f, -0.36, 0.26, 0));
    if (content) {
      const burnt = content.state === 'burnt';
      g.add(cyl(0.27, 0.27, 0.02, burnt ? 0x2b2b2b : 0xc89048, 0, 0.29, 0, 20));
      const m = makeIngredient(content.kind, content.state);
      m.scale.setScalar(0.7); m.position.y = 0.26; g.add(m);
    }
    return g;
  }

  // ================= Ô BẾP =================
  function counterBase(theme, top) {
    const g = new THREE.Group();
    g.add(box(0.98, 0.8, 0.98, theme.counterBase || 0x5d4037, 0, 0.4, 0));
    g.add(box(1.0, 0.12, 1.0, top !== undefined ? top : theme.counter, 0, 0.86, 0));
    return g;
  }

  function makeTile(type, theme, crateKind) {
    let g;
    switch (type) {
      case '#': g = counterBase(theme); break;
      case 'C': {
        g = counterBase(theme);
        g.add(box(0.7, 0.05, 0.55, 0xc8a165, 0, 0.945, 0));
        const k = box(0.3, 0.015, 0.07, 0xcfd8dc, 0.32, 0.98, 0.3); k.rotation.y = 0.4; g.add(k);
        g.add(box(0.12, 0.03, 0.05, 0x3e2723, 0.48, 0.98, 0.38));
        break;
      }
      case 'S': {
        g = counterBase(theme, 0x37474f);
        const ring = torus(0.26, 0.04, M(0x424242), 0, 0.93, 0); ring.rotation.x = Math.PI / 2; g.add(ring);
        const flame = torus(0.18, 0.04, M(0xff5722, { emissive: 0xff3d00 }), 0, 0.93, 0); flame.rotation.x = Math.PI / 2;
        g.add(flame); g.userData.flame = flame;
        for (const [x, z] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]]) g.add(box(0.06, 0.06, 0.06, 0xbdbdbd, x, 0.88, z));
        break;
      }
      case 'G': {
        g = counterBase(theme, 0x4e342e);
        const coal = box(0.8, 0.06, 0.8, M(0xff6f00, { emissive: 0xbf360c }), 0, 0.93, 0);
        g.add(coal); g.userData.flame = coal;
        for (let i = 0; i < 6; i++) g.add(box(0.85, 0.02, 0.03, 0x212121, 0, 0.98, -0.37 + i * 0.15));
        break;
      }
      case 'P': {
        g = counterBase(theme);
        for (let i = 0; i < 5; i++) g.add(cyl(0.3, 0.22, 0.05, 0xffffff, 0, 0.95 + i * 0.055, 0, 20));
        g.add(rx(torus(0.29, 0.02, 0x1e88e5, 0, 0.95 + 4 * 0.055 + 0.03, 0)));
        break;
      }
      case 'W': {
        g = new THREE.Group();
        g.add(box(0.98, 0.8, 0.98, 0x1565c0, 0, 0.4, 0));
        g.add(box(1.0, 0.12, 1.0, 0x64b5f6, 0, 0.86, 0));
        g.add(box(0.9, 0.02, 0.15, M(0xffeb3b, { emissive: 0x665500 }), 0, 0.93, 0.42));
        const bell = sph(0.1, 0xffd54f, 0.35, 0.98, -0.3, 10); bell.scale.y = 0.7; g.add(bell);
        break;
      }
      case 'T': {
        g = new THREE.Group();
        g.add(cyl(0.38, 0.32, 0.85, 0x546e7a, 0, 0.425, 0));
        g.add(cyl(0.3, 0.3, 0.02, 0x111111, 0, 0.86, 0));
        g.add(rx(torus(0.38, 0.04, 0x37474f, 0, 0.86, 0)));
        break;
      }
      default: { // thùng nguyên liệu
        g = new THREE.Group();
        g.add(box(0.98, 0.8, 0.98, 0x8d6e63, 0, 0.4, 0));
        g.add(box(1.0, 0.12, 1.0, 0xa1887f, 0, 0.86, 0));
        for (let i = 0; i < 3; i++) g.add(box(1.0, 0.05, 0.02, 0x6d4c41, 0, 0.2 + i * 0.25, 0.5));
        if (crateKind) {
          const ing = makeIngredient(crateKind, 'raw'); ing.position.set(-0.15, 0.92, 0.1); ing.scale.setScalar(0.85); g.add(ing);
          const ing2 = makeIngredient(crateKind, 'raw'); ing2.position.set(0.18, 0.92, -0.12); ing2.scale.setScalar(0.7); ing2.rotation.y = 1; g.add(ing2);
          const info = INGREDIENTS[crateKind];
          const lab = labelSprite(info.emoji, info.name); lab.position.set(0, 1.55, 0); lab.scale.setScalar(0.62); g.add(lab);
        }
      }
    }
    return g;
  }

  // ================= TRANG TRÍ =================
  function makeStool(color) {
    const g = new THREE.Group();
    g.add(cyl(0.2, 0.22, 0.04, color, 0, 0.4, 0));
    for (const [x, z] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) g.add(cyl(0.025, 0.035, 0.4, color, x, 0.2, z, 6));
    return g;
  }
  function makeLowTable(color = 0x1565c0) {
    const g = new THREE.Group();
    g.add(box(0.9, 0.04, 0.6, color, 0, 0.55, 0));
    for (const [x, z] of [[-0.4, -0.25], [0.4, -0.25], [-0.4, 0.25], [0.4, 0.25]]) g.add(cyl(0.025, 0.025, 0.55, color, x, 0.27, z, 6));
    return g;
  }
  function makeTree(color = 0x388e3c, blossom = false) {
    const g = new THREE.Group();
    g.add(cyl(0.1, 0.14, 1.2, 0x5d4037, 0, 0.6, 0, 8));
    const c = blossom ? 0xf48fb1 : color;
    g.add(sph(0.7, c, 0, 1.5, 0, 10), sph(0.5, blossom ? 0xf8bbd0 : c, 0.4, 1.3, 0.2, 10), sph(0.5, c, -0.35, 1.35, -0.2, 10));
    return g;
  }
  function makePine() {
    const g = new THREE.Group();
    g.add(cyl(0.08, 0.1, 0.5, 0x5d4037, 0, 0.25, 0, 6));
    for (let i = 0; i < 3; i++) g.add(mesh(new THREE.ConeGeometry(0.6 - i * 0.15, 0.7, 8), M(0x2e5d3a), 0, 0.7 + i * 0.4, 0));
    return g;
  }
  function makeLantern(color = 0xe53935) {
    const g = new THREE.Group();
    const l = sph(0.22, M(color, { emissive: color, emissiveIntensity: 0.6 }), 0, 0, 0, 12); l.scale.y = 1.2; g.add(l);
    g.add(cyl(0.12, 0.12, 0.05, 0xffd54f, 0, 0.27, 0, 8), cyl(0.12, 0.12, 0.05, 0xffd54f, 0, -0.27, 0, 8));
    g.add(cyl(0.01, 0.01, 0.6, 0x3e2723, 0, 0.55, 0, 4));
    return g;
  }
  function makeBanana() {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const p = torus(0.13, 0.04, 0xffeb3b, 0, 0.04, 0, Math.PI * 0.9);
      p.rotation.x = -Math.PI / 2; p.rotation.z = i * 2.1; g.add(p);
    }
    g.add(sph(0.05, 0x6d4c41, 0, 0.05, 0, 6));
    return g;
  }
  function makePuddle(color, r) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 20), new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.7 }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.025; m.receiveShadow = true;
    return m;
  }
  function makeMotoParked(color) {
    const m = makeMoto();
    m.children[0].children.forEach((c, i) => { if (i === 2 && c.material) c.material = M(color); });
    return m;
  }

  return {
    M, box, cyl, sph, torus, mesh, labelSprite, textPlane,
    makeChef, makeCustomer, makePolice, makeMoto, makeMotoParked, makeIngredient, makePlate, makePot, makeTile,
    makeStool, makeLowTable, makeTree, makePine, makeLantern, makeBanana, makePuddle,
  };
})();
