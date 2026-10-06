// ===== Hoạ tiết Việt dạng SVG: trống đồng, đèn lồng, nón lá, khăn rằn, đồng xu, bát phở =====
// Tạo một "sprite" <symbol> chèn vào trang, dùng lại bằng <svg><use href="#id"/></svg>.

const f = n => +n.toFixed(2);
const polar = (r, a) => [f(Math.cos(a) * r), f(Math.sin(a) * r)];

// Mặt trống đồng Đông Sơn: ngôi sao 14 cánh, vòng tròn tiếp tuyến, vạch răng lược, chim Lạc bay, răng cưa
function drum() {
  const P = [];
  const ring = (r, w = 1.6) => P.push(`<circle r="${r}" fill="none" stroke="currentColor" stroke-width="${w}"/>`);
  // ngôi sao 14 cánh
  let d = '';
  for (let i = 0; i < 28; i++) {
    const [x, y] = polar(i % 2 ? 10.5 : 30, (i / 28) * Math.PI * 2 - Math.PI / 2);
    d += `${i ? 'L' : 'M'}${x} ${y}`;
  }
  P.push(`<path d="${d}Z" fill="currentColor"/>`);
  // hoạ tiết lông công giữa các cánh sao
  for (let i = 0; i < 14; i++) {
    const a = ((i + 0.5) / 14) * Math.PI * 2 - Math.PI / 2;
    const [x, y] = polar(22, a);
    P.push(`<circle cx="${x}" cy="${y}" r="1.6" fill="currentColor"/>`);
  }
  ring(34.5);
  // vòng tròn tiếp tuyến có chấm giữa
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const [x, y] = polar(41.5, a);
    P.push(`<circle cx="${x}" cy="${y}" r="3.5" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="${x}" cy="${y}" r="1.1" fill="currentColor"/>`);
    const [x1, y1] = polar(41.5, a + 0.2), [x2, y2] = polar(41.5, a + (Math.PI * 2) / n - 0.2);
    P.push(`<path d="M${x1} ${y1}L${x2} ${y2}" stroke="currentColor" stroke-width="1"/>`);
  }
  ring(48.5);
  // vạch răng lược
  P.push(`<circle r="53" fill="none" stroke="currentColor" stroke-width="6" stroke-dasharray="1.1 2.4"/>`);
  ring(57.5);
  // chim Lạc bay ngược chiều kim đồng hồ
  const bird = '<path d="M-7 -1.2C-3 -3.4 3 -3.2 6.5 -1.2L13 -3.2L12 -0.6L13 1.8L6.5 0.6C3 2.4 -3 2.4 -7 0.6Z" fill="currentColor"/>'
    + '<circle cx="-7.6" cy="-0.4" r="1.9" fill="currentColor"/>'
    + '<path d="M-9 -0.6L-17 1.4M-7 -2L-5 -7.5M-1 -2.4L3 -9.5L4.5 -2.2" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
  for (let i = 0; i < 8; i++) P.push(`<g transform="rotate(${i * 45}) translate(0 -67.5)">${bird}</g>`);
  ring(77);
  P.push(`<circle r="82" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-dasharray="0 7.15"/>`);
  ring(86.5);
  // răng cưa
  let z = '';
  const m = 64;
  for (let i = 0; i <= m * 2; i++) {
    const [x, y] = polar(i % 2 ? 95 : 89, (i / (m * 2)) * Math.PI * 2);
    z += `${i ? 'L' : 'M'}${x} ${y}`;
  }
  P.push(`<path d="${z}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>`);
  ring(98, 2.2);
  return `<symbol id="i-drum" viewBox="-100 -100 200 200">${P.join('')}</symbol>`;
}

// Đèn lồng Hội An (đổi màu bằng biến CSS --lc thân, --lc2 chóp, --lct tua)
const LANTERN = `<symbol id="i-lantern" viewBox="0 0 60 124">
  <path d="M30 0V15" stroke="#2b1a12" stroke-width="1.6"/>
  <rect x="20" y="13" width="20" height="8" rx="2.5" fill="var(--lc2,#e2b04a)" stroke="#5a3a12" stroke-width="1"/>
  <ellipse cx="30" cy="51" rx="27" ry="31" fill="var(--lc,#d23a2a)"/>
  <ellipse cx="30" cy="51" rx="27" ry="31" fill="url(#g-lantern)"/>
  <g fill="none" stroke="var(--lc3,#6e140f)" stroke-width="1.3" opacity=".5">
    <ellipse cx="30" cy="51" rx="18" ry="31"/><ellipse cx="30" cy="51" rx="8" ry="31"/>
  </g>
  <path d="M5 44Q30 40 55 44M5 58Q30 62 55 58" stroke="var(--lc2,#e2b04a)" stroke-width="1.6" fill="none" opacity=".75"/>
  <rect x="19" y="80" width="22" height="8" rx="2.5" fill="var(--lc2,#e2b04a)" stroke="#5a3a12" stroke-width="1"/>
  <circle cx="30" cy="92" r="3.2" fill="var(--lc2,#e2b04a)"/>
  <path d="M28 94L25 120M30 94V122M32 94L35 120" stroke="var(--lct,#b3261e)" stroke-width="2.2" stroke-linecap="round"/>
</symbol>`;

// Bếp Hà: nón lá, búi tóc
const HA = `<symbol id="i-ha" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="31" fill="var(--av-bg,#f9dccb)"/>
  <circle cx="32" cy="41" r="14.5" fill="#ffd2a8" stroke="#2a1810" stroke-width="2.2"/>
  <path d="M18 38Q17.5 46 22 50M46 38Q46.5 46 42 50" stroke="#2a1810" stroke-width="3.2" fill="none" stroke-linecap="round"/>
  <circle cx="26.6" cy="42" r="2" fill="#2a1810"/><circle cx="37.4" cy="42" r="2" fill="#2a1810"/>
  <ellipse cx="23" cy="47" rx="2.6" ry="1.6" fill="#ff8a80"/><ellipse cx="41" cy="47" rx="2.6" ry="1.6" fill="#ff8a80"/>
  <path d="M29 47.6Q32 50.6 35 47.6" stroke="#5a1e1e" stroke-width="1.9" fill="none" stroke-linecap="round"/>
  <path d="M3 34.5L32 5L61 34.5Q32 41 3 34.5Z" fill="#efcf86" stroke="#2a1810" stroke-width="2.2" stroke-linejoin="round"/>
  <path d="M12.5 25.5Q32 30 51.5 25.5M20.5 17.5Q32 20.6 43.5 17.5" stroke="#c49a45" stroke-width="1.5" fill="none"/>
  <path d="M32 5L32 38" stroke="#d9b264" stroke-width="1" opacity=".7"/>
  <path d="M17 36.5Q19 54 32 57.5Q45 54 47 36.5" stroke="#c62f22" stroke-width="1.6" fill="none"/>
</symbol>`;

// Bếp Sơn: khăn rằn quấn đầu và cổ, ria mép
const SON = `<symbol id="i-son" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="31" fill="var(--av-bg,#d5e2f5)"/>
  <path d="M17.5 47Q32 57 46.5 47L49 56Q32 66 15 56Z" fill="url(#p-khan)" stroke="#2a1810" stroke-width="2"/>
  <circle cx="32" cy="35" r="15" fill="#f0c08f" stroke="#2a1810" stroke-width="2.2"/>
  <path d="M17.2 33Q16.5 17 32 17Q47.5 17 46.8 33Q43 26 32 26Q21 26 17.2 33Z" fill="#2a1810"/>
  <path d="M16.6 27.5Q32 18.5 47.4 27.5L47.6 33Q32 24.5 16.4 33Z" fill="url(#p-khan)" stroke="#2a1810" stroke-width="1.8" stroke-linejoin="round"/>
  <circle cx="26.6" cy="36" r="2" fill="#2a1810"/><circle cx="37.4" cy="36" r="2" fill="#2a1810"/>
  <ellipse cx="22.8" cy="41" rx="2.5" ry="1.5" fill="#ff8a80" opacity=".8"/><ellipse cx="41.2" cy="41" rx="2.5" ry="1.5" fill="#ff8a80" opacity=".8"/>
  <path d="M26.5 42.8Q29.5 41 32 42.6Q34.5 41 37.5 42.8Q35 44.6 32 43.6Q29 44.6 26.5 42.8Z" fill="#2a1810"/>
  <path d="M29.5 46.4Q32 48.4 34.5 46.4" stroke="#5a1e1e" stroke-width="1.8" fill="none" stroke-linecap="round"/>
</symbol>`;

// Đồng xu lỗ vuông
const COIN = `<symbol id="i-coin" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="30" fill="url(#g-gold)" stroke="#7a4d0e" stroke-width="2.4"/>
  <circle cx="32" cy="32" r="24" fill="none" stroke="#a8721a" stroke-width="1.6" opacity=".85"/>
  <rect x="24.5" y="24.5" width="15" height="15" rx="1" fill="var(--coin-hole,#2a1712)" stroke="#7a4d0e" stroke-width="2.4"/>
  <g fill="#9b6814" opacity=".9">
    <rect x="29" y="11" width="6" height="2" rx="1"/><rect x="31" y="9.5" width="2" height="7" rx="1"/>
    <rect x="29" y="47" width="6" height="2" rx="1"/><rect x="28.5" y="51" width="7" height="2" rx="1"/>
    <rect x="11" y="29" width="2" height="6" rx="1"/><rect x="14" y="30" width="3" height="4" rx="1"/>
    <rect x="47" y="30" width="3" height="4" rx="1"/><rect x="51" y="29" width="2" height="6" rx="1"/>
  </g>
  <path d="M12 26A21 21 0 0 1 26 12" stroke="#fff8d8" stroke-width="3" fill="none" stroke-linecap="round" opacity=".75"/>
</symbol>`;

// Bát phở men lam
const BOWL = `<symbol id="i-bowl" viewBox="0 0 120 100">
  <ellipse cx="60" cy="44" rx="50" ry="9" fill="#2a1810"/>
  <ellipse cx="60" cy="45" rx="46" ry="7" fill="#e3a352"/>
  <path d="M26 44q5-3 10 0t10 0t10 0t10 0t10 0t10 0t10 0" stroke="#fff7e0" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  <ellipse cx="44" cy="46" rx="7" ry="2.6" fill="#a3473a"/><ellipse cx="66" cy="47" rx="7" ry="2.6" fill="#a3473a"/>
  <circle cx="54" cy="43" r="2.2" fill="#4f9a3c"/><circle cx="78" cy="44" r="2.2" fill="#4f9a3c"/><circle cx="36" cy="43" r="2" fill="#4f9a3c"/>
  <path d="M80 4L56 50M93 8L64 51" stroke="#8a5528" stroke-width="4.2" stroke-linecap="round"/>
  <path d="M80 4L76 11.5M93 8L88.5 15" stroke="#c62f22" stroke-width="4.4" stroke-linecap="round"/>
  <path d="M9 44Q60 58 111 44Q108 78 78 88H42Q12 78 9 44Z" fill="#fbf6ea" stroke="#2a1810" stroke-width="3" stroke-linejoin="round"/>
  <path d="M12.5 52Q60 64 107.5 52" stroke="#2457a0" stroke-width="3.2" fill="none"/>
  <path d="M22 66q4-5 8 0t8 0t8 0t8 0t8 0t8 0t8 0t8 0t8 0" stroke="#2457a0" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M30 79Q60 86 90 79" stroke="#2457a0" stroke-width="2" fill="none"/>
  <rect x="42" y="87" width="36" height="7" rx="2" fill="#fbf6ea" stroke="#2a1810" stroke-width="3"/>
</symbol>`;

// Tay cầm
const PAD = `<symbol id="i-pad" viewBox="0 0 64 64">
  <path d="M18 18H46Q58 18 60 34L61 44Q62 54 54 54Q49 54 45 46H19Q15 54 10 54Q2 54 3 44L4 34Q6 18 18 18Z" fill="currentColor"/>
  <path d="M17 27V39M11 33H23" stroke="var(--pad-ink,#2a1712)" stroke-width="4" stroke-linecap="round"/>
  <circle cx="45" cy="28" r="3" fill="var(--pad-ink,#2a1712)"/><circle cx="51" cy="34" r="3" fill="var(--pad-ink,#2a1712)"/>
  <circle cx="39" cy="34" r="3" fill="var(--pad-ink,#2a1712)"/><circle cx="45" cy="40" r="3" fill="var(--pad-ink,#2a1712)"/>
</symbol>`;

const DEFS = `<defs>
  <radialGradient id="g-lantern" cx=".42" cy=".42" r=".62">
    <stop offset="0" stop-color="#fff6c8" stop-opacity=".9"/><stop offset=".45" stop-color="#ffd27a" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity=".18"/>
  </radialGradient>
  <linearGradient id="g-gold" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fff2b0"/><stop offset=".45" stop-color="#f3c450"/><stop offset="1" stop-color="#c0821b"/>
  </linearGradient>
  <pattern id="p-khan" width="5" height="5" patternUnits="userSpaceOnUse">
    <rect width="5" height="5" fill="#f7f3ea"/><rect width="2.5" height="2.5" fill="#1d1a18"/><rect x="2.5" y="2.5" width="2.5" height="2.5" fill="#1d1a18"/>
  </pattern>
</defs>`;

export function mountOrnaments() {
  if (document.getElementById('vn-sprite')) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = `<svg id="vn-sprite" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">${DEFS}${drum()}${LANTERN}${HA}${SON}${COIN}${BOWL}${PAD}</svg>`;
  document.body.prepend(wrap.firstChild);
}

// <svg> dùng một symbol trong sprite
export const icon = (id, cls = '') => `<svg class="ico ${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
