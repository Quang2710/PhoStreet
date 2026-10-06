import * as THREE from 'three';
import { INGREDIENTS } from './data.js';

// ===== Dựng mô hình 3D bằng hình khối cơ bản (stylized / chibi) =====
export const Models = (() => {
  const matCache = new Map();
  // bảng 3 nấc sáng cho kiểu tô hoạt hình (toon shading)
  const toonGrad = (() => {
    const d = new Uint8Array([110, 110, 110, 255, 185, 185, 185, 255, 255, 255, 255, 255]);
    const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
    t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
    return t;
  })();
  function M(color, opts = {}) {
    const key = color + JSON.stringify(opts);
    if (matCache.has(key)) return matCache.get(key);
    const m = new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: toonGrad }, opts));
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

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  // chữ to nhất vừa khung
  function fitFont(g, text, weight, family, size, maxW) {
    do { g.font = `${weight} ${size}px ${family}`; size -= 2; } while (g.measureText(text).width > maxW && size > 10);
  }
  const SIGN_FONT = 'Phudu, "Be Vietnam Pro", "Arial Black", sans-serif';
  const TEXT_FONT = '"Be Vietnam Pro", "Segoe UI", Arial, sans-serif';

  // ---- Sprite nhãn thùng: đĩa men lam + dải tên đỏ ----
  function labelSprite(emoji, text) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    g.beginPath(); g.arc(128, 100, 90, 0, Math.PI * 2);
    g.fillStyle = '#fbf6ea'; g.fill();
    g.lineWidth = 9; g.strokeStyle = '#2a1810'; g.stroke();
    g.beginPath(); g.arc(128, 100, 76, 0, Math.PI * 2);
    g.lineWidth = 6; g.strokeStyle = '#2457a0'; g.stroke();
    g.beginPath(); g.arc(128, 100, 68, 0, Math.PI * 2);
    g.lineWidth = 2; g.strokeStyle = 'rgba(36,87,160,.45)'; g.stroke();
    g.font = '96px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(emoji, 128, 106);
    if (text) {
      fitFont(g, text, 800, TEXT_FONT, 36, 210);
      const w = Math.min(248, g.measureText(text).width + 34);
      roundRect(g, 128 - w / 2, 192, w, 54, 27);
      g.fillStyle = '#c62f22'; g.fill();
      g.lineWidth = 6; g.strokeStyle = '#2a1810'; g.stroke();
      g.fillStyle = '#ffe9a8'; g.fillText(text, 128, 221);
    }
    const tex = new THREE.CanvasTexture(c);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
    sp.scale.set(0.75, 0.75, 0.75);
    return sp;
  }

  // ---- Biển hiệu kẻ tay: nền sơn, viền kép, đinh tán, chữ lớn + dòng phụ ----
  function signBoard({ title, sub, bg, fg, edge }, w, h) {
    const W = 1024, H = Math.round(1024 * h / w);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, bg[0]); grad.addColorStop(1, bg[1]);
    roundRect(g, 5, 5, W - 10, H - 10, 20);
    g.fillStyle = grad; g.fill();
    g.lineWidth = 10; g.strokeStyle = edge; g.stroke();
    roundRect(g, 22, 22, W - 44, H - 44, 10);
    g.lineWidth = 3; g.globalAlpha = 0.6; g.stroke(); g.globalAlpha = 1;
    g.fillStyle = edge;
    for (const [x, y] of [[36, 36], [W - 36, 36], [36, H - 36], [W - 36, H - 36]]) { g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const ty = H * (sub ? 0.43 : 0.52);
    fitFont(g, title, 900, SIGN_FONT, Math.round(H * (sub ? 0.5 : 0.62)), W * 0.84);
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillText(title, W / 2 + 3, ty + 6);
    g.fillStyle = fg; g.fillText(title, W / 2, ty);
    if (sub) {
      if ('letterSpacing' in g) g.letterSpacing = '5px';
      fitFont(g, sub, 700, SIGN_FONT, Math.round(H * 0.16), W * 0.8);
      g.globalAlpha = 0.9; g.fillText(sub, W / 2, H * 0.79); g.globalAlpha = 1;
    }
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  }

  // ---- Gạch bông: hoa 4 cánh giữa viên, 1/4 vòng tròn ở góc (4 viên ghép thành hoa tròn), lưới thoi mảnh ----
  const gachCache = new Map();
  function gachBong([base, a, b]) {
    const key = base + a + b;
    if (gachCache.has(key)) return gachCache.get(key);
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = a; g.lineWidth = 5;
    g.beginPath(); g.moveTo(128, 0); g.lineTo(256, 128); g.lineTo(128, 256); g.lineTo(0, 128); g.closePath(); g.stroke();
    for (const [x, y] of [[0, 0], [256, 0], [0, 256], [256, 256]]) {
      g.fillStyle = a; g.beginPath(); g.arc(x, y, 62, 0, Math.PI * 2); g.fill();
      g.fillStyle = base; g.beginPath(); g.arc(x, y, 46, 0, Math.PI * 2); g.fill();
      g.fillStyle = b; g.beginPath(); g.arc(x, y, 26, 0, Math.PI * 2); g.fill();
    }
    g.save(); g.translate(128, 128);
    for (let i = 0; i < 4; i++) {
      g.rotate(Math.PI / 2);
      g.fillStyle = b; g.beginPath(); g.ellipse(0, -36, 17, 32, 0, 0, Math.PI * 2); g.fill();
      g.save(); g.rotate(Math.PI / 4); g.fillStyle = a; g.beginPath(); g.ellipse(0, -52, 9, 20, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
    g.fillStyle = base; g.beginPath(); g.arc(0, 0, 13, 0, Math.PI * 2); g.fill();
    g.fillStyle = a; g.beginPath(); g.arc(0, 0, 7, 0, Math.PI * 2); g.fill();
    g.restore();
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 4; g.strokeRect(0, 0, 256, 256); // mạch vữa
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    const mat = new THREE.MeshToonMaterial({ map: tex, gradientMap: toonGrad });
    gachCache.set(key, mat);
    return mat;
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
        flame.userData.keep = true; g.add(flame); g.userData.flame = flame;
        for (const [x, z] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]]) g.add(box(0.06, 0.06, 0.06, 0xbdbdbd, x, 0.88, z));
        break;
      }
      case 'G': {
        g = counterBase(theme, 0x4e342e);
        const coal = box(0.8, 0.06, 0.8, M(0xff6f00, { emissive: 0xbf360c }), 0, 0.93, 0);
        coal.userData.keep = true; g.add(coal); g.userData.flame = coal;
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
  return {
    M, box, cyl, sph, torus, mesh, rx, checker, labelSprite, signBoard, gachBong,
    toon: (o) => new THREE.MeshToonMaterial(Object.assign({ gradientMap: toonGrad }, o)),
    makeIngredient, makePlate, makePot, makeTile,
    makeStool, makeLowTable, makeTree, makePine, makeLantern, makeBanana, makePuddle,
  };
})();
