import * as THREE from 'three';
import { mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Models } from './models.js';

// ===== Nhân vật chibi kiểu Việt: đầu bếp, khách, công an, xe máy, thanh tra =====
export const Chars = (() => {
  const { M, box, cyl, sph, torus, mesh, rx, checker } = Models;
  const SKIN = 0xffd2a8, INK = 0x2a1810;
  const OUT = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  const nz = m => { m.userData.noOutline = true; m.castShadow = false; return m; };

  // Viền đen hoạt hình (inverted hull): nhân bản mặt sau, phóng to nhẹ
  function outline(root, th = 0.022, minR = 0.045) {
    const list = [];
    root.traverse(o => { if (o.isMesh && !o.userData.noOutline && !o.userData.hasOutline) list.push(o); });
    for (const m of list) {
      m.geometry.computeBoundingSphere();
      const r = m.geometry.boundingSphere.radius;
      if (r < minR) continue;
      const o = new THREE.Mesh(m.geometry, OUT);
      o.scale.setScalar(1 + th / r);
      o.userData.noOutline = true; o.userData.isOutline = true;
      m.add(o);
      m.userData.hasOutline = true;
    }
    return root;
  }

  // Gộp các mesh tĩnh cùng vật liệu trong từng nhóm để giảm số lệnh vẽ.
  // Không đụng tới: mesh có userData.keep, con trực tiếp của nhóm có userData.keepChildren.
  function optimize(obj) {
    for (const c of [...obj.children]) {
      if (!c.isMesh || c.children.some(k => !k.userData.isOutline)) optimize(c);
    }
    if (obj.userData.keepChildren) return;
    const buckets = new Map(), done = [];
    const push = (mat, geo, matrix, shadow) => {
      let b = buckets.get(mat);
      if (!b) buckets.set(mat, b = { geos: [], shadow: false });
      let g = geo.index ? geo.toNonIndexed() : geo.clone();
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
      if (!g.attributes.uv) return false;
      g.applyMatrix4(matrix);
      b.geos.push(g); b.shadow = b.shadow || shadow;
      return true;
    };
    for (const m of obj.children) {
      if (!m.isMesh || m.userData.keep || m.userData.isOutline || m.isSkinnedMesh) continue;
      if (Array.isArray(m.material) || m.children.some(k => !k.userData.isOutline)) continue;
      if (!m.visible) continue;
      m.updateMatrix();
      if (!push(m.material, m.geometry, m.matrix, m.castShadow)) continue;
      for (const o of m.children) { o.updateMatrix(); push(o.material, o.geometry, m.matrix.clone().multiply(o.matrix), false); }
      done.push(m);
    }
    if (done.length < 2) {
      // không đáng gộp: hoàn tác
      return;
    }
    for (const m of done) obj.remove(m);
    for (const [mat, b] of buckets) {
      const merged = new THREE.Mesh(mergeBufferGeometries(b.geos, false), mat);
      merged.castShadow = b.shadow; merged.receiveShadow = true;
      if (mat === OUT) merged.userData.isOutline = true;
      obj.add(merged);
    }
  }

  // Gắn các mesh của nhóm con (đã đứng yên) thẳng vào nhóm cha để gộp được
  function flatten(group) {
    const parent = group.parent;
    group.updateMatrix();
    for (const c of [...group.children]) {
      c.updateMatrix();
      c.matrix.premultiply(group.matrix);
      c.matrix.decompose(c.position, c.quaternion, c.scale);
      parent.add(c);
    }
    parent.remove(group);
  }

  let khanMat = null;
  const khan = () => khanMat || (khanMat = Models.toon({ map: checker(), side: THREE.DoubleSide }));

  // ---------------- KHUÔN MẶT ----------------
  const lidGeo = new THREE.SphereGeometry(0.093, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  function makeFace(skinMat) {
    const f = new THREE.Group();
    const P = { eyesN: new THREE.Group(), eyesH: new THREE.Group(), eyesX: new THREE.Group(), lids: new THREE.Group(), tears: new THREE.Group(), brows: [], mouths: {}, mode: null, keepChildren: true };
    const cheeks = new THREE.Group();
    f.add(P.eyesN, P.eyesH, P.eyesX, P.lids, P.tears, cheeks);
    // mặt đỏ bừng khi giận: tô màu phát sáng đỏ lên vật liệu da riêng của nhân vật
    P.skinMat = skinMat; P.red = 0;
    for (const sx of [-1, 1]) {
      const x = sx * 0.13;
      const w = sph(0.085, 0xffffff, x, 0.03, 0.31, 12); w.scale.set(1, 1.18, 0.5); P.eyesN.add(w);
      const p = nz(sph(0.056, 0x1a1a1a, x + sx * 0.006, 0.02, 0.345, 10)); p.scale.set(1, 1.15, 0.5); P.eyesN.add(p);
      P.eyesN.add(nz(sph(0.022, 0xffffff, x + 0.025, 0.06, 0.372, 6)));
      P.eyesH.add(nz(torus(0.055, 0.017, INK, x, 0.02, 0.345, Math.PI)));
      for (const r of [0.8, -0.8]) { const b = nz(box(0.13, 0.03, 0.02, INK, x, 0.03, 0.35)); b.rotation.z = r; P.eyesX.add(b); }
      const brow = nz(box(0.11, 0.03, 0.02, INK, x, 0.17, 0.318)); f.add(brow); P.brows.push(brow);
      const ck = nz(sph(0.055, 0xff8a80, sx * 0.21, -0.07, 0.282, 8)); ck.scale.set(1, 0.6, 0.35); cheeks.add(ck);
      // mí mắt sụp (lườm, cọc cằn)
      const lid = nz(mesh(lidGeo, skinMat, x, 0.03, 0.315)); lid.scale.set(1.05, 1.15, 0.8); P.lids.add(lid);
      P.lids.add(nz(box(0.17, 0.022, 0.02, INK, x, 0.032, 0.375)));
      // nước mắt
      const tr = nz(sph(0.032, 0x4fc3f7, x + sx * 0.03, -0.06, 0.33, 8)); tr.scale.set(1, 1.5, 0.6); P.tears.add(tr);
    }
    const lip = 0x5a1e1e;
    const smile = nz(torus(0.062, 0.018, lip, 0, -0.085, 0.343, Math.PI)); smile.rotation.z = Math.PI;
    const open = new THREE.Group();
    const o1 = nz(sph(0.06, lip, 0, -0.13, 0.335, 10)); o1.scale.set(1, 1.25, 0.45);
    open.add(o1, nz(sph(0.033, 0xff8a80, 0, -0.16, 0.352, 8)));
    const grin = new THREE.Group();
    const g1 = nz(sph(0.085, lip, 0, -0.12, 0.33, 12)); g1.scale.set(1.25, 0.75, 0.4);
    grin.add(g1, nz(box(0.15, 0.035, 0.02, 0xffffff, 0, -0.085, 0.36)));
    const flat = nz(box(0.11, 0.026, 0.02, lip, 0, -0.12, 0.345));
    const frown = nz(torus(0.06, 0.018, lip, 0, -0.165, 0.335, Math.PI));
    const pout = nz(torus(0.042, 0.017, lip, 0.045, -0.15, 0.338, Math.PI)); pout.rotation.z = 0.35;
    const teeth = new THREE.Group();
    const t1 = nz(sph(0.09, lip, 0, -0.13, 0.325, 12)); t1.scale.set(1.35, 0.62, 0.4);
    teeth.add(t1, nz(box(0.19, 0.06, 0.02, 0xffffff, 0, -0.13, 0.352)));
    for (const tx of [-0.05, 0, 0.05]) teeth.add(nz(box(0.008, 0.062, 0.024, INK, tx, -0.13, 0.354)));
    teeth.add(nz(box(0.19, 0.008, 0.024, INK, 0, -0.13, 0.354)));
    Object.assign(P.mouths, { smile, open, grin, flat, frown, pout, teeth });
    f.add(smile, open, grin, flat, frown, pout, teeth);
    f.userData = P;
    setFace(f, 'normal');
    return f;
  }

  // mắt: N thường, H nhắm cong, X choáng, L mí sụp
  const FACES = {
    normal:  { e: 'N', m: 'smile' },
    happy:   { e: 'H', m: 'grin' },
    laugh:   { e: 'H', m: 'grin' },
    stun:    { e: 'X', m: 'open' },
    shock:   { e: 'N', m: 'open', brow: -0.3, by: 0.2 },
    focus:   { e: 'N', m: 'flat', brow: 0.45 },
    angry:   { e: 'N', m: 'frown', brow: 0.5, by: 0.16, red: 0.22 },
    furious: { e: 'N', m: 'teeth', brow: 0.7, by: 0.15, red: 0.5 },
    grumpy:  { e: 'L', m: 'pout', brow: 0.2, by: 0.145 },
    sad:     { e: 'N', m: 'frown', brow: -0.45, by: 0.19, tears: true },
    cry:     { e: 'H', m: 'open', brow: -0.5, by: 0.19, tears: true },
  };
  function setFace(f, mode) {
    const P = f.userData;
    if (P.mode === mode) return;
    P.mode = mode;
    const F = FACES[mode] || FACES.normal;
    P.eyesN.visible = F.e === 'N' || F.e === 'L'; P.eyesH.visible = F.e === 'H'; P.eyesX.visible = F.e === 'X';
    P.lids.visible = F.e === 'L';
    P.tears.visible = !!F.tears;
    for (const k in P.mouths) P.mouths[k].visible = k === F.m;
    const a = F.brow || 0;
    P.brows[0].rotation.z = -a; P.brows[1].rotation.z = a;
    P.brows[0].position.y = P.brows[1].position.y = F.by ?? 0.17;
    P.red = F.red || 0;
    P.skinMat.emissive.setRGB(P.red * 1.4, 0, 0);
  }

  // ---------------- NGƯỜI (dùng chung) ----------------
  function makePerson(o = {}) {
    const skin = o.skin ?? SKIN, shirt = o.shirt ?? 0xd84315, st = o.style ?? 'baba';
    const hc = o.hairColor ?? 0x1e1410;
    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body);

    // chân + dép lào
    const legs = [];
    for (const sx of [-1, 1]) {
      const p = new THREE.Group(); p.position.set(sx * 0.1, 0.3, 0);
      p.add(cyl(0.08, 0.075, 0.26, o.pants ?? 0x263238, 0, -0.13, 0, 10));
      if (o.shoes === 'boot') p.add(box(0.15, 0.09, 0.25, o.shoeColor ?? 0x111111, 0, -0.255, 0.04));
      else {
        p.add(box(0.13, 0.035, 0.25, o.shoeColor ?? 0x43a047, 0, -0.278, 0.04));
        p.add(sph(0.062, skin, 0, -0.245, 0.06, 8));
        p.add(nz(box(0.1, 0.02, 0.025, 0xffffff, 0, -0.245, 0.1)));
      }
      body.add(p); legs.push(p);
    }

    // thân áo
    const rt = st === 'aodai' ? 0.19 : 0.22, rb = st === 'jacket' ? 0.31 : 0.28;
    body.add(cyl(rt, rb, 0.44, shirt, 0, 0.52, 0, 16));
    if (st === 'baba') {
      for (let i = 0; i < 3; i++) body.add(nz(sph(0.024, 0xfafafa, 0, 0.66 - i * 0.1, 0.245, 6)));
      for (const sx of [-1, 1]) body.add(box(0.1, 0.08, 0.03, shirt, sx * 0.13, 0.38, 0.27));
      body.add(rx(torus(0.13, 0.028, shirt, 0, 0.74, 0)));
    } else if (st === 'uniform') {
      body.add(cyl(0.285, 0.285, 0.05, 0x4e342e, 0, 0.34, 0));
      body.add(box(0.08, 0.06, 0.03, 0xffd600, 0, 0.34, 0.285));
      for (const sx of [-1, 1]) {
        body.add(box(0.1, 0.06, 0.03, shirt, sx * 0.1, 0.63, 0.235));
        body.add(box(0.12, 0.03, 0.18, 0x2f4a2b, sx * 0.21, 0.74, 0));
      }
      body.add(nz(sph(0.035, 0xffd600, -0.1, 0.68, 0.245, 8)));
      body.add(rx(torus(0.13, 0.028, shirt, 0, 0.74, 0)));
    } else if (st === 'aodai') {
      body.add(box(0.3, 0.46, 0.03, shirt, 0, 0.14, 0.17));
      body.add(box(0.3, 0.46, 0.03, shirt, 0, 0.14, -0.17));
      body.add(cyl(0.1, 0.12, 0.09, shirt, 0, 0.77, 0));
    } else if (st === 'jacket') {
      body.add(nz(box(0.025, 0.42, 0.02, 0xbdbdbd, 0, 0.52, 0.29)));
      body.add(sph(0.2, shirt, 0, 0.74, -0.2));
    } else if (st === 'tshirt') {
      const pr = nz(sph(0.075, o.print ?? 0xffeb3b, 0, 0.56, 0.255, 10)); pr.scale.z = 0.3; body.add(pr);
    } else if (st === 'shirt') {
      body.add(box(0.07, 0.3, 0.025, o.tie ?? 0x1565c0, 0, 0.57, 0.25));
      body.add(box(0.09, 0.06, 0.03, o.tie ?? 0x1565c0, 0, 0.72, 0.235));
      body.add(rx(torus(0.13, 0.03, shirt, 0, 0.74, 0)));
    }
    if (o.towel) {
      body.add(box(0.13, 0.04, 0.42, 0xffffff, -0.2, 0.77, 0));
      body.add(box(0.13, 0.24, 0.03, 0xffffff, -0.21, 0.64, 0.2));
      body.add(nz(box(0.13, 0.03, 0.032, 0xe53935, -0.21, 0.58, 0.205)));
    }
    if (o.backpack) {
      body.add(box(0.38, 0.44, 0.22, o.backpackColor ?? 0x1565c0, 0, 0.55, -0.34));
      body.add(box(0.3, 0.12, 0.05, 0xff7043, 0, 0.45, -0.46));
    }
    body.add(cyl(0.08, 0.08, 0.1, skin, 0, 0.79, 0, 10));

    // tay
    const arms = [];
    for (const sx of [-1, 1]) {
      const a = new THREE.Group(); a.position.set(sx * 0.27, 0.7, 0);
      a.add(cyl(0.07, 0.062, 0.28, st === 'tank' ? skin : shirt, 0, -0.13, 0, 10));
      a.add(sph(0.078, skin, 0, -0.31, 0, 10));
      body.add(a); arms.push(a);
    }
    if (o.scarf === 'khanran') {
      const sc = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.065, 8, 18), khan());
      sc.rotation.x = Math.PI / 2; sc.position.y = 0.8; body.add(sc);
      for (const sx of [-1, 1]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.03), khan()); t.position.set(sx * 0.05, 0.66, 0.22); t.rotation.z = sx * 0.25; body.add(t); }
    } else if (o.scarf === 'red') {
      body.add(rx(torus(0.15, 0.045, 0xe53935, 0, 0.79, 0)));
      body.add(sph(0.05, 0xe53935, 0, 0.75, 0.17, 8));
      for (const sx of [-1, 1]) { const t = box(0.06, 0.18, 0.02, 0xe53935, sx * 0.045, 0.64, 0.2); t.rotation.z = sx * 0.3; body.add(t); }
    }

    // đầu
    const head = new THREE.Group(); head.position.y = 1.08; body.add(head);
    const skinMat = M(skin).clone();
    const skull = sph(0.36, skinMat, 0, 0, 0, 20); skull.scale.y = 0.95; head.add(skull);
    head.add(sph(0.075, skinMat, -0.35, -0.02, 0, 8), sph(0.075, skinMat, 0.35, -0.02, 0, 8));
    const face = makeFace(skinMat); head.add(face);
    head.add(nz(sph(0.035, 0xf0a882, 0, -0.035, 0.355, 8)));

    // tóc
    const hair = o.hair ?? 'short';
    if (hair === 'tuft') {
      const t = sph(0.11, hc, 0, 0.33, 0.1, 10); t.scale.set(1, 0.7, 1.3); head.add(t);
      head.add(nz(torus(0.05, 0.02, hc, 0.02, 0.38, 0.2, Math.PI * 1.5)));
    } else if (hair === 'bald') {
      for (const sx of [-1, 1]) head.add(sph(0.13, 0xe0e0e0, sx * 0.29, 0.02, -0.1, 10));
    } else {
      const cap = sph(0.375, hc, 0, 0.07, -0.05, 18); cap.scale.set(1, 0.9, 0.95); head.add(cap);
      const fr = box(0.5, 0.1, 0.16, hc, 0, 0.25, 0.22); fr.rotation.x = -0.5; head.add(fr);
      if (hair === 'bun') {
        head.add(sph(0.14, hc, 0, 0.2, -0.34, 12));
        const pin = nz(cyl(0.012, 0.012, 0.4, 0xd7a86e, 0, 0.22, -0.36, 6)); pin.rotation.z = 1.2; head.add(pin);
      } else if (hair === 'long') {
        head.add(box(0.58, 0.6, 0.16, hc, 0, -0.24, -0.25));
        for (const sx of [-1, 1]) head.add(box(0.1, 0.42, 0.22, hc, sx * 0.31, -0.14, -0.06));
      } else if (hair === 'spiky') {
        for (let i = 0; i < 5; i++) { const c = mesh(new THREE.ConeGeometry(0.08, 0.2, 6), M(hc), -0.2 + i * 0.1, 0.36, -0.05); c.rotation.z = (i - 2) * -0.25; head.add(c); }
      }
    }

    // mũ / nón
    const hat = o.hat;
    if (hat === 'nonla') {
      const h = new THREE.Group(); h.position.set(0, 0.3, -0.08); h.rotation.x = o.hatTilt ?? -0.32;
      h.add(mesh(new THREE.ConeGeometry(0.66, 0.42, 32), M(0xeed58f), 0, 0.12, 0));
      h.add(nz(rx(torus(0.52, 0.009, 0xc9a85a, 0, 0, 0))), nz(rx(torus(0.3, 0.009, 0xc9a85a, 0, 0.14, 0))));
      head.add(h);
      head.add(nz(torus(0.375, 0.013, 0xe53935, 0, -0.05, 0))); // quai nón
    } else if (hat === 'khanran') {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.375, 0.385, 0.15, 24, 1, true), khan());
      band.position.y = 0.16; head.add(band);
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), khan()); knot.position.set(0, 0.16, -0.39); head.add(knot);
      for (const sx of [-1, 1]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.02), khan()); t.position.set(sx * 0.06, 0.03, -0.4); t.rotation.z = sx * 0.35; head.add(t); }
    } else if (hat === 'helmet') {
      const c = o.hatColor ?? 0x7cb342;
      const h = sph(0.41, c, 0, 0.1, -0.02, 18); h.scale.set(1, 0.78, 1.02); head.add(h);
      const v = box(0.32, 0.03, 0.15, c, 0, 0.14, 0.38); v.rotation.x = 0.2; head.add(v);
      head.add(nz(sph(0.07, 0xffffff, 0.2, 0.3, 0.2, 8)));
    } else if (hat === 'noncoi') {
      const c = 0x6f7d3c;
      const d = sph(0.42, c, 0, 0.14, 0, 18); d.scale.set(1, 0.72, 1.08); head.add(d);
      const b = cyl(0.52, 0.52, 0.03, c, 0, 0.07, 0, 24); b.scale.z = 1.12; head.add(b);
      head.add(sph(0.045, c, 0, 0.45, 0, 8));
      head.add(nz(sph(0.05, 0xffd600, 0, 0.2, 0.44, 8)));
    } else if (hat === 'kepi') {
      head.add(cyl(0.37, 0.35, 0.16, 0x2f4a2b, 0, 0.24, 0, 20));
      const top = cyl(0.47, 0.4, 0.09, o.hatColor ?? 0xe9dc8a, 0, 0.37, 0.03, 22); top.rotation.x = -0.1; head.add(top);
      head.add(nz(rx(torus(0.372, 0.022, 0xd32f2f, 0, 0.2, 0))));
      const vz = box(0.36, 0.03, 0.2, 0x111111, 0, 0.17, 0.39); vz.rotation.x = 0.25; head.add(vz);
      head.add(nz(sph(0.06, 0xffd600, 0, 0.29, 0.39, 10)), nz(sph(0.03, 0xd32f2f, 0, 0.29, 0.44, 6)));
    } else if (hat === 'cap') {
      const c = o.hatColor ?? 0xd32f2f;
      const d = sph(0.385, c, 0, 0.12, 0, 16); d.scale.y = 0.7; head.add(d);
      head.add(box(0.34, 0.03, 0.26, c, 0, 0.13, 0.4));
    }

    // phụ kiện mặt
    if (o.mustache || o.beard) {
      const mc = o.beard ? 0xeeeeee : hc;
      for (const sx of [-1, 1]) { const m = nz(sph(0.07, mc, sx * 0.07, -0.06, 0.34, 8)); m.scale.set(1.35, 0.5, 0.5); m.rotation.z = sx * 0.35; head.add(m); }
    }
    if (o.beard) { const b = mesh(new THREE.ConeGeometry(0.09, 0.26, 10), M(0xeeeeee), 0, -0.4, 0.24); b.rotation.x = Math.PI + 0.3; head.add(b); }
    if (o.glasses) {
      for (const sx of [-1, 1]) head.add(nz(torus(0.08, 0.013, INK, sx * 0.13, 0.03, 0.37)));
      head.add(nz(box(0.08, 0.015, 0.015, INK, 0, 0.05, 0.37)));
    }
    if (o.sunglasses) {
      for (const sx of [-1, 1]) { const l = nz(sph(0.09, 0x111111, sx * 0.13, 0.04, 0.36, 10)); l.scale.set(1.1, 0.75, 0.3); head.add(l); }
      head.add(nz(box(0.1, 0.02, 0.02, 0x111111, 0, 0.07, 0.375)));
    }
    if (o.mask) { const m = sph(0.3, o.maskColor ?? 0x90caf9, 0, -0.15, 0.17, 14); m.scale.set(1, 0.58, 0.68); head.add(m); }

    const hold = new THREE.Object3D(); hold.position.set(0, 0.62, 0.5); body.add(hold);
    root.userData = { body, head, face, armL: arms[0], armR: arms[1], legL: legs[0], legR: legs[1], hold, seed: Math.random() * 10 };
    outline(root);
    return root;
  }

  // Hoạt cảnh tay chân + chớp mắt
  function animPerson(u, s) {
    const t = s.t;
    const sw = s.moving ? Math.sin(s.phase) * 0.75 : 0;
    if (!s.seated) { u.legL.rotation.x = sw; u.legR.rotation.x = -sw; }
    let aL = -sw * 0.9, aR = sw * 0.9, zL = -0.08, zR = 0.08;
    if (!s.moving) { aL = Math.sin(t * 2 + u.seed) * 0.06; aR = -aL; }
    if (s.holding) { aL = aR = -1.35; zL = 0.15; zR = -0.15; }
    if (s.holdLeft) { aL = -1.3; zL = 0.2; }
    if (s.chop) { aR = -1.4 + Math.sin(t * 30) * 0.55; aL = -0.9; }
    if (s.eat) { aR = -1.4 - Math.max(0, Math.sin(t * 2.5 + u.seed)) * 0.9; aL = -0.8; }
    if (s.drive) { aL = aR = -1.25; zL = 0.12; zR = -0.12; }
    if (s.wave) { aR = -2.7; zR = 0.35 + Math.sin(t * 12) * 0.35; }
    if (s.cheer) { aL = aR = -2.9; zL = -0.3 - Math.sin(t * 14) * 0.2; zR = 0.3 + Math.sin(t * 14) * 0.2; }
    if (s.angry) { aL = aR = -1.9 + Math.sin(t * 20) * 0.4; zL = -0.3; zR = 0.3; }
    const md = s.mood;
    let hx = s.laugh ? -0.25 : 0, hz = 0, hy = s.lookY || 0;
    if (md === 'grumpy') {
      // khoanh tay, quay mặt đi, gõ chân, thỉnh thoảng lắc đầu "chậc"
      aL = aR = -1.2; zL = 0.95; zR = -0.95;
      hy = (u.seed % 2 > 1 ? 0.45 : -0.45) + (Math.sin(t * 0.7 + u.seed) > 0.85 ? Math.sin(t * 22) * 0.15 : 0);
      hz = 0.08;
      if (!s.seated && !s.moving) u.legR.rotation.x = -Math.max(0, Math.sin(t * 9)) * 0.3;
    } else if (md === 'sad' || md === 'cry') {
      aL = aR = -0.25; zL = 0.15; zR = -0.15;
      if (md === 'cry') { aL = aR = -2.0; zL = 0.55; zR = -0.55; } // lấy tay dụi mắt
      hx += 0.35; hz = Math.sin(t * (md === 'cry' ? 18 : 2)) * (md === 'cry' ? 0.05 : 0.03);
    } else if (md === 'furious') {
      // đập bàn / giậm chân
      aL = -1.6 + Math.sin(t * 14) * 0.65; aR = -1.6 + Math.sin(t * 14 + 1) * 0.65; zL = 0.1; zR = -0.1;
      hz = Math.sin(t * 30) * 0.06;
      if (!s.seated && !s.moving) { u.legL.rotation.x = -Math.max(0, Math.sin(t * 12)) * 0.4; }
    } else if (md === 'angry') {
      aL = aR = -1.9 + Math.sin(t * 20) * 0.4; zL = -0.3; zR = 0.3;
    }
    if (s.stun) { aL = -2.6 + Math.sin(t * 25) * 0.5; aR = -2.6 + Math.cos(t * 25) * 0.5; zL = -0.6; zR = 0.6; }
    u.armL.rotation.set(aL, 0, zL); u.armR.rotation.set(aR, 0, zR);
    u.head.rotation.set((u.headTilt || 0) + hx, hy, s.stun ? Math.sin(t * 10) * 0.15 : s.laugh ? Math.sin(t * 25) * 0.08 : hz);
    const P = u.face.userData;
    P.eyesN.scale.y = ((t + u.seed) % 3.3) < 0.11 ? 0.12 : 1;
    // nước mắt chảy dần xuống rồi lặp lại
    if (P.tears.visible) { const k = (t * 1.4 + u.seed) % 1; P.tears.position.y = -k * 0.22; P.tears.scale.setScalar(1 - k * 0.4); }
    // mặt đỏ phập phồng khi giận
    if (P.red) P.skinMat.emissive.setRGB(P.red * (1.1 + Math.sin(t * 8) * 0.3), 0, 0);
  }

  // ---------------- ĐẦU BẾP ----------------
  const starShape = (() => {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.045 : 0.1, a = i / 10 * Math.PI * 2 - Math.PI / 2;
      i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    return s;
  })();
  const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.03, bevelEnabled: false });

  const CHEF_LOOK = {
    ha: { hatTilt: -0.6, shirt: 0xd84315, pants: 0x212121, shoeColor: 0xe53935, style: 'baba', hat: 'nonla', hair: 'bun', towel: true },
    son: { shirt: 0x1e5aa8, pants: 0x4e342e, shoeColor: 0x43a047, style: 'baba', hat: 'khanran', hair: 'short', mustache: true, scarf: 'khanran', skin: 0xf0c08f },
  };

  function makeChef(d) {
    const g = makePerson(CHEF_LOOK[d.look] || CHEF_LOOK.ha);
    const u = g.userData;
    u.headTilt = -0.38; // ngửa mặt lên camera nhìn từ trên xuống
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.46, 32), new THREE.MeshBasicMaterial({ color: d.ring, transparent: true, opacity: 0.85 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; ring.userData.keep = true; g.add(ring);
    const stars = new THREE.Group(); stars.position.y = 1.75; stars.visible = false;
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(starGeo, M(0xffeb3b, { emissive: 0x997700 }));
      s.position.set(Math.cos(i * Math.PI / 2) * 0.38, 0, Math.sin(i * Math.PI / 2) * 0.38);
      stars.add(s);
    }
    u.body.add(stars);
    const lamp = new THREE.PointLight(0xffe0a0, 0, 4.5); lamp.position.set(0, 1.8, 0.3); g.add(lamp);
    Object.assign(u, { ring, stars, lamp });
    return g;
  }

  // ---------------- KHÁCH HÀNG ----------------
  const LOOKS = {
    xeom: { style: 'jacket', shirt: 0x2e7d32, pants: 0x37474f, hat: 'helmet', hatColor: 0x9ccc65, mustache: true, skin: 0xe8b483, shoeColor: 0x6d4c41 },
    banhang: { style: 'baba', shirt: 0x8e24aa, pants: 0x212121, hat: 'nonla', hair: 'long', shoeColor: 0xff7043 },
    embe: { style: 'tshirt', shirt: 0xffffff, pants: 0x1565c0, hair: 'tuft', scarf: 'red', scale: 0.72, shoeColor: 0xffca28 },
    cuoi: { style: 'tank', shirt: 0xf5f5f5, pants: 0x795548, hat: 'noncoi', hair: 'bald', beard: true, glasses: true, skin: 0xe0a878, shoeColor: 0x5d4037 },
    nusinh: { style: 'aodai', shirt: 0xffffff, pants: 0xffffff, hair: 'long', shoeColor: 0xf8bbd0 },
    dulich: { style: 'tshirt', shirt: 0xff7043, print: 0x4caf50, pants: 0xd7ccc8, hair: 'short', hairColor: 0xf2c94c, sunglasses: true, backpack: true, skin: 0xffe3d3, hat: 'cap', hatColor: 0x1e88e5, shoes: 'boot', shoeColor: 0x8d6e63 },
  };

  function makeCustomer(def, seated = true) {
    const look = LOOKS[def.id] || LOOKS.xeom;
    const p = makePerson(look);
    const sc = look.scale || 1;
    p.scale.setScalar(sc);
    const u = p.userData;
    u.headTilt = -0.12;
    const g = new THREE.Group(); g.add(p);
    if (seated) {
      u.legL.rotation.x = u.legR.rotation.x = -1.45;
      flatten(u.legL); flatten(u.legR);
      p.position.y = 0.44 - 0.3 * sc;
    }
    if (def.id === 'banhang') {
      // quang gánh để cạnh
      const q = new THREE.Group(); q.position.set(0, 0, -0.75);
      q.add(box(1.4, 0.05, 0.06, 0x8d6e63, 0, 0.8, 0));
      const fruits = [0xff7043, 0xffeb3b, 0x66bb6a, 0xe53935];
      for (const sx of [-1, 1]) {
        q.add(cyl(0.24, 0.18, 0.26, 0xc8a165, sx * 0.6, 0.13, 0, 14));
        for (let i = 0; i < 4; i++) q.add(sph(0.08, fruits[(i + (sx > 0 ? 2 : 0)) % 4], sx * 0.6 + Math.cos(i * 1.6) * 0.1, 0.3, Math.sin(i * 1.6) * 0.1, 8));
        for (const dz of [-0.15, 0.15]) q.add(nz(cyl(0.008, 0.008, 0.55, 0x5d4037, sx * 0.6, 0.53, dz, 4)));
      }
      outline(q); g.add(q);
    }
    g.userData = Object.assign(u, { inner: p, seated });
    return g;
  }

  // ---------------- CẢNH SÁT GIAO THÔNG ----------------
  function makePolice() {
    const p = makePerson({ style: 'uniform', shirt: 0xe3cf5e, pants: 0x2f4a2b, shoes: 'boot', hat: 'kepi', hair: 'short', mustache: true, sunglasses: true, skin: 0xeab98e });
    const u = p.userData;
    u.headTilt = -0.35;
    const baton = new THREE.Group(); baton.position.y = -0.33;
    for (let i = 0; i < 6; i++) baton.add(cyl(0.03, 0.03, 0.08, i % 2 ? 0xffffff : 0x111111, 0, -i * 0.08, 0, 8));
    outline(baton); u.armR.add(baton);
    const wh = nz(cyl(0.026, 0.026, 0.12, 0xffd600, 0.04, -0.13, 0.4, 8)); wh.rotation.x = Math.PI / 2; u.head.add(wh);
    optimize(p);
    return p;
  }

  // ---------------- THANH TRA VỆ SINH ----------------
  function makeInspector() {
    const p = makePerson({ style: 'shirt', shirt: 0xfafafa, tie: 0xc62828, pants: 0x37474f, shoes: 'boot', hair: 'short', hairColor: 0x9e9e9e, glasses: true, mustache: true });
    const u = p.userData;
    u.headTilt = -0.3;
    const cb = new THREE.Group(); cb.position.set(0, -0.36, 0.08); cb.rotation.x = 1.0;
    cb.add(box(0.28, 0.02, 0.36, 0x8d6e63, 0, 0, 0));
    cb.add(nz(box(0.24, 0.01, 0.28, 0xffffff, 0, 0.015, 0.02)));
    cb.add(nz(box(0.1, 0.03, 0.05, 0xffd600, 0, 0.02, -0.16)));
    for (let i = 0; i < 4; i++) cb.add(nz(box(0.16, 0.012, 0.012, 0x90a4ae, 0, 0.022, -0.06 + i * 0.05)));
    outline(cb); u.armL.add(cb);
    const pen = nz(cyl(0.015, 0.015, 0.18, 0x1565c0, 0, -0.36, 0.05, 6)); pen.rotation.x = 1.2; u.armR.add(pen);
    optimize(p);
    return p;
  }

  // ---------------- XE MÁY (kiểu Cub) ----------------
  function makeMoto(o = {}) {
    const color = o.color ?? 0xe53935;
    const bike = new THREE.Group();
    const wheels = [];
    for (const z of [0.55, -0.55]) {
      const w = new THREE.Group(); w.position.set(0, 0.26, z);
      const inner = new THREE.Group(); inner.rotation.y = Math.PI / 2; w.add(inner);
      inner.add(torus(0.22, 0.075, 0x1a1a1a, 0, 0, 0));
      inner.add(rx(cyl(0.07, 0.07, 0.12, 0xbdbdbd, 0, 0, 0, 10)));
      const s1 = nz(box(0.36, 0.025, 0.025, 0xcfd8dc, 0, 0, 0)); inner.add(s1);
      const s2 = nz(box(0.025, 0.36, 0.025, 0xcfd8dc, 0, 0, 0)); inner.add(s2);
      bike.add(w); wheels.push(w);
    }
    bike.add(box(0.24, 0.18, 0.9, 0x37474f, 0, 0.42, 0));
    const shield = box(0.46, 0.52, 0.1, color, 0, 0.64, 0.42); shield.rotation.x = -0.25; bike.add(shield);
    bike.add(box(0.42, 0.3, 0.58, color, 0, 0.58, -0.25));
    bike.add(box(0.36, 0.1, 0.52, 0x212121, 0, 0.78, -0.2));
    bike.add(box(0.2, 0.06, 0.3, color, 0, 0.52, 0.62));
    const hb = cyl(0.025, 0.025, 0.62, 0x9e9e9e, 0, 0.98, 0.5, 8); hb.rotation.z = Math.PI / 2; bike.add(hb);
    for (const sx of [-1, 1]) {
      bike.add(nz(cyl(0.015, 0.015, 0.24, 0x9e9e9e, sx * 0.24, 1.1, 0.5, 6)));
      const mr = sph(0.055, 0x90caf9, sx * 0.25, 1.24, 0.5, 8); mr.scale.z = 0.4; bike.add(mr);
    }
    bike.add(sph(0.09, M(0xffffcc, { emissive: 0xffee88 }), 0, 0.9, 0.62, 10));
    const ex = rx(cyl(0.04, 0.05, 0.5, 0xbdbdbd, 0.22, 0.32, -0.35, 8)); bike.add(ex);
    bike.add(nz(box(0.22, 0.12, 0.02, 0xffffff, 0, 0.55, -0.56)));
    if (o.cargo) {
      bike.add(box(0.42, 0.04, 0.42, 0x424242, 0, 0.84, -0.7));
      for (let i = 0; i < 2; i++) bike.add(box(0.48, 0.3, 0.42, i ? 0xbcaaa4 : 0xa1887f, 0, 1.01 + i * 0.31, -0.72));
      // lồng gà
      for (const sx of [-1, 1]) {
        const c = new THREE.Group(); c.position.set(sx * 0.12, 1.32, -0.72); c.rotation.y = sx * 0.5;
        const b = sph(0.13, 0xfafafa, 0, 0.12, 0, 10); b.scale.set(1, 0.9, 1.2); c.add(b);
        c.add(sph(0.075, 0xfafafa, 0, 0.26, 0.12, 8));
        c.add(nz(box(0.025, 0.07, 0.08, 0xe53935, 0, 0.35, 0.12)));
        const bk = mesh(new THREE.ConeGeometry(0.03, 0.07, 6), M(0xffa000), 0, 0.25, 0.21); bk.rotation.x = Math.PI / 2; c.add(bk);
        c.add(nz(sph(0.015, 0x111111, 0.04, 0.28, 0.18, 6)), nz(sph(0.015, 0x111111, -0.04, 0.28, 0.18, 6)));
        bike.add(c);
      }
    }
    let rider = null;
    if (o.rider) {
      rider = makePerson({ style: 'jacket', shirt: 0xf48fb1, pants: 0x5c6bc0, hat: 'helmet', hatColor: 0xffffff, mask: true, maskColor: 0x81d4fa, hair: 'long', shoeColor: 0xffffff });
      rider.position.set(0, 0.52, -0.12);
      rider.userData.legL.rotation.x = rider.userData.legR.rotation.x = -1.35;
      animPerson(rider.userData, { t: 0, drive: true, seated: true });
      bike.add(rider);
    }
    outline(bike);
    optimize(bike);
    bike.rotation.y = Math.PI / 2;
    const wrap = new THREE.Group(); wrap.add(bike);
    wrap.userData = { wheels, bike, rider };
    return wrap;
  }

  // ---------------- HIỆU ỨNG 2D TRONG KHÔNG GIAN ----------------
  const texCache = new Map();
  function emojiTex(e) {
    if (texCache.has(e)) return texCache.get(e);
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.font = '100px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(e, 64, 70);
    const t = new THREE.CanvasTexture(c); texCache.set(e, t);
    return t;
  }
  function emote(e) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex(e), transparent: true, depthTest: false }));
    s.renderOrder = 20;
    return s;
  }
  function burst(text, fill = '#ffcf4a') {
    const key = 'burst:' + text + fill;
    let t = texCache.get(key);
    if (!t) {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const g = c.getContext('2d');
      g.translate(128, 128);
      g.beginPath();
      for (let i = 0; i < 24; i++) {
        const r = i % 2 ? 72 : 120 - (i % 4) * 8, a = i / 24 * Math.PI * 2;
        i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.closePath();
      g.fillStyle = fill; g.fill();
      g.lineWidth = 10; g.strokeStyle = '#c62f22'; g.stroke();
      g.rotate(-0.12);
      g.font = '900 64px Phudu,"Be Vietnam Pro","Segoe UI",sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 10; g.strokeStyle = '#2a1810'; g.strokeText(text, 0, 6);
      g.fillStyle = '#fff'; g.fillText(text, 0, 6);
      t = new THREE.CanvasTexture(c); texCache.set(key, t);
    }
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
    s.renderOrder = 21;
    return s;
  }

  return { makePerson, makeChef, makeCustomer, makePolice, makeInspector, makeMoto, animPerson, setFace, emote, burst, outline, optimize };
})();
