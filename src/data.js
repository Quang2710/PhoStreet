// ===== Dữ liệu game: nguyên liệu, món ăn, màn chơi, câu thoại =====

// proc: các cách sơ chế hợp lệ. chop = thớt, boil = nồi trên bếp, grill = vỉ nướng
export const INGREDIENTS = {
  banhpho:   { name: 'Bánh phở',   emoji: '🍝', proc: ['boil'],  color: 0xf5f0e0 },
  bun:       { name: 'Bún',        emoji: '🍥', proc: ['boil'],  color: 0xffffff },
  nep:       { name: 'Gạo nếp',    emoji: '🍚', proc: ['boil'],  color: 0xf0ead0 },
  bo:        { name: 'Thịt bò',    emoji: '🥩', proc: ['chop'],  color: 0xb03030 },
  hanh:      { name: 'Hành lá',    emoji: '🌿', proc: ['chop'],  color: 0x4caf50 },
  rau:       { name: 'Rau thơm',   emoji: '🥬', proc: ['chop'],  color: 0x3d9a3d },
  tom:       { name: 'Tôm',        emoji: '🦐', proc: ['chop'],  color: 0xff8a50 },
  thit:      { name: 'Thịt heo',   emoji: '🥓', proc: ['grill', 'chop'], color: 0xe89a9a },
  bot:       { name: 'Bột bánh',   emoji: '🥣', proc: ['grill'], color: 0xffe082 },
  trung:     { name: 'Trứng',      emoji: '🥚', proc: ['chop'],  color: 0xfff8e1 },
  banhmi:    { name: 'Bánh mì',    emoji: '🥖', proc: [],        color: 0xd9a24a },
  banhtrang: { name: 'Bánh tráng', emoji: '🫓', proc: [],        color: 0xf3eee4 },
  caphe:     { name: 'Cà phê',     emoji: '☕', proc: [],        color: 0x5d3a1a },
  ladong:    { name: 'Lá dong',    emoji: '🍃', proc: [],        color: 0x2e7d32 },
};

export const STATE_ICON = { raw: '', chopped: '🔪', cooked: '♨️', grilled: '🔥', burnt: '💀' };
export const PROC_STATE = { chop: 'chopped', boil: 'cooked', grill: 'grilled' };

export const RECIPES = {
  pho:       { name: 'Phở bò',       emoji: '🍜', parts: ['banhpho:cooked', 'bo:chopped', 'hanh:chopped'], price: 30, time: 75 },
  banhmi:    { name: 'Bánh mì',      emoji: '🥖', parts: ['banhmi:raw', 'thit:grilled', 'rau:chopped'],   price: 28, time: 70 },
  goicuon:   { name: 'Gỏi cuốn',     emoji: '🌯', parts: ['banhtrang:raw', 'tom:chopped', 'rau:chopped'], price: 25, time: 65 },
  buncha:    { name: 'Bún chả',      emoji: '🍢', parts: ['bun:cooked', 'thit:grilled', 'rau:chopped'],   price: 32, time: 80 },
  caphe:     { name: 'Cà phê trứng', emoji: '☕', parts: ['caphe:raw', 'trung:chopped'],                  price: 18, time: 50 },
  banhxeo:   { name: 'Bánh xèo',     emoji: '🥞', parts: ['bot:grilled', 'tom:chopped', 'rau:chopped'],   price: 30, time: 75 },
  banhchung: { name: 'Bánh chưng',   emoji: '🟩', parts: ['ladong:raw', 'nep:cooked', 'thit:chopped'],    price: 36, time: 85 },
};

// Ký hiệu bản đồ:
// '.' sàn, '#' quầy, 'C' thớt, 'S' bếp + nồi, 'G' vỉ nướng, 'P' chồng bát/đĩa,
// 'W' cửa ra món, 'T' thùng rác, '1'..'9' thùng nguyên liệu (theo mảng crates)
export const LEVELS = [
  {
    id: 'hanoi', name: 'Vỉa hè Hà Nội', emoji: '🏮', region: 'north',
    desc: 'Bếp bé xíu, ghế nhựa thấp. Công an thổi còi dẹp hàng, khách vứt vỏ chuối bừa bãi.',
    recipes: ['pho', 'caphe'], crates: ['banhpho', 'bo', 'hanh', 'caphe', 'trung'],
    events: ['police', 'banana', 'inspector'], modifiers: [], duration: 180, stars: [90, 200, 320],
    theme: { floor: 0x9e9e9e, floor2: 0x8a8a8a, counter: 0xd9a066, ground: 0x6d6d6d, sky: 0xffe0b2, tiles: ['#a19c93', '#928c81', '#a07a6c'] },
    map: [
      '##1#2#3##WW###',
      '#............#',
      'C....#..#....S',
      '#....#..#....S',
      'C....#..#....#',
      '#............#',
      '#............P',
      '#4#5####T#####',
    ],
  },
  {
    id: 'mientay', name: 'Chợ nổi miền Tây', emoji: '🛶', region: 'south',
    desc: 'Bếp trên ghe! Sóng nhấp nhô làm đầu bếp lắc lư, thỉnh thoảng sóng lớn đánh dạt cả người.',
    recipes: ['goicuon', 'banhxeo'], crates: ['banhtrang', 'tom', 'rau', 'bot'],
    events: ['bigwave', 'banana', 'rain'], modifiers: ['waves'], duration: 180, stars: [80, 180, 290],
    theme: { floor: 0x8d6e63, floor2: 0x7b5e52, counter: 0xa1887f, ground: 0x2f8fb3, sky: 0xb3e5fc, water: true },
    map: [
      '##1#2#WW#3#4##',
      '#............#',
      'C..##....##..G',
      '#............G',
      'C..##....##..#',
      '#............#',
      '###P##T#######',
    ],
  },
  {
    id: 'benthanh', name: 'Chợ Bến Thành giờ cao điểm', emoji: '🛵', region: 'south',
    desc: 'Xe máy phóng ngang qua bếp, thanh tra vệ sinh ghé thăm. Bánh mì với bún chả bán chạy như tôm tươi.',
    recipes: ['banhmi', 'buncha'], crates: ['banhmi', 'thit', 'rau', 'bun'],
    events: ['moto', 'moto', 'inspector', 'banana'], modifiers: [], duration: 180, stars: [90, 210, 330],
    theme: { floor: 0xbdbdbd, floor2: 0xa8a8a8, counter: 0xffb74d, ground: 0x555555, sky: 0xfff3e0, tiles: ['#b0ada4', '#a19d92', '#7c9a91'] },
    map: [
      '###1#2##WW#3##',
      '#............#',
      'C...#....#...G',
      '#...#....#...G',
      'C............#',
      '#...#....#...S',
      '#............S',
      '#4##P##T######',
    ],
  },
  {
    id: 'tet', name: 'Đêm Tết sum vầy', emoji: '🧧', region: 'north',
    desc: 'Gói bánh chưng, nồi nước sôi cả đêm. Pháo nổ đì đùng làm giật mình rơi đồ, lâu lâu mất điện.',
    recipes: ['banhchung', 'pho'], crates: ['ladong', 'nep', 'thit', 'banhpho', 'bo', 'hanh'],
    events: ['firecracker', 'firecracker', 'power'], modifiers: [], duration: 200, stars: [100, 230, 360],
    theme: { floor: 0xa1887f, floor2: 0x8d6e63, counter: 0xc62828, ground: 0x4e342e, sky: 0x311b2b, night: true, tiles: ['#ad9182', '#987a6a', '#a6594d'] },
    map: [
      '##1#2#3#WW#####',
      '#.............#',
      'C....##.##....S',
      '#.............S',
      'C....##.##....S',
      '#.............#',
      '#4#5#6##P##T###',
    ],
  },
  {
    id: 'sapa', name: 'Sương mù Sapa', emoji: '🏔️', region: 'north',
    desc: 'Nền đất dốc trơn trượt, sương mù dày đặc, mưa rào bất chợt. Ba món cùng lúc!',
    recipes: ['pho', 'buncha', 'caphe'], crates: ['banhpho', 'bo', 'hanh', 'bun', 'thit', 'rau', 'caphe', 'trung'],
    events: ['rain', 'fogthick', 'power'], modifiers: ['slope', 'fog'], duration: 210, stars: [110, 250, 380],
    theme: { floor: 0x8d8061, floor2: 0x7a6e52, counter: 0x8d6e63, ground: 0x4c6b3c, sky: 0xcfd8dc, fog: true },
    map: [
      '#1#2#3##WW##4#',
      '#............#',
      'C...#....#...S',
      '#...#....#...S',
      'C...#....#...G',
      '#............G',
      '#5#6#7#8#P#T##',
    ],
  },
];

export const LINES = {
  north: ['Trời ơi, làm cái gì đấy!', 'Ối giời ơi!', 'Đi đứng kiểu gì thế!', 'Khổ quá cơ!', 'Nhìn đường đi chứ!', 'Ôi dồi ôi!', 'Vỡ hết rồi!'],
  south: ['Má ơi!', 'Trời đất quỷ thần ơi!', 'Làm gì dữ vậy trời!', 'Ủa alo?', 'Chời đất ơi!', 'Quá trời luôn!', 'Hết hồn chưa!'],
  slip: ['Á á á!', 'Trơn quá!', 'Ai vứt vỏ chuối đấy!', 'Cứu tôi với!'],
  startle: ['Giật cả mình!', 'Pháo à?!', 'Hú hồn!'],
  catch: ['Bắt dính!', 'Ngon lành!', 'Chuẩn!'],
  hit: ['Ui da!', 'Đau quá!'],
};

export const CUSTOMERS = [
  { id: 'xeom', emoji: '🛵', name: 'Bác xe ôm', angry: ['Đồ ăn bay vào mặt tôi rồi!', 'Nấu kiểu gì vậy hả!', 'Ơ kìa!'], laugh: ['Hà hà, vui đấy!', 'Xem phim hài à!'], happy: ['Ngon! Thêm tip này!', 'Chuẩn vị!'], grumpy: ['Lâu thế, tôi còn chạy cuốc!', 'Nhanh lên cho tôi nhờ!'], furious: ['Đợi cả buổi rồi đấy!!', 'Thôi tôi đi đây!!'] },
  { id: 'banhang', emoji: '👒', name: 'Cô bán hàng rong', angry: ['Lườm... 😒', 'Hừm!', 'Chậm như rùa!'], laugh: ['Ối giồi, đóng phim à?'], happy: ['Được đấy cháu!', 'Mai cô quay lại!'], grumpy: ['Chậc... lâu quá!', 'Cô còn phải đi bán nữa!'], furious: ['Quán gì mà chậm thế hả!!', 'Không ăn nữa!!'] },
  { id: 'embe', emoji: '👶', name: 'Em bé', small: true, angry: ['Hihihi 😆', 'Lại nữa đi!'], laugh: ['Khanh khách 😆', 'Hahaha!'], happy: ['Ngon quá à!', 'Yeah!'], grumpy: ['Mẹ ơi con đói...', 'Bao giờ có ạ...'], furious: ['Oaaaa! Con đói!!', 'Huhuhu!!'] },
  { id: 'cuoi', emoji: '👴', name: 'Ông cụ nón cối', angry: ['Thời bọn tôi không thế này!', 'Hừ, phí của!'], laugh: ['Khà khà khà!'], happy: ['Ngon như phở ngày xưa!', 'Được, khá lắm!'], grumpy: ['Hừm... thời buổi gì mà chậm thế', 'Tôi đợi mỏi cả lưng rồi'], furious: ['Hỗn láo! Bắt người già chờ!!', 'Gọi chủ quán ra đây!!'] },
  { id: 'nusinh', emoji: '👩‍🎓', name: 'Nữ sinh áo dài', angry: ['Ơ hay!', 'Bẩn áo dài em rồi!'], laugh: ['Hihi, đáng yêu ghê!'], happy: ['Ngon xỉu luôn!', 'Đỉnh nóc kịch trần!'], grumpy: ['Trễ học mất thôi...', 'Ủa sao lâu vậy ta?'], furious: ['Em trễ giờ rồi nè!!', 'Không chờ nổi nữa!!'] },
  { id: 'dulich', emoji: '🧳', name: 'Khách Tây balo', angry: ['Oh no!', 'What?!'], laugh: ['Haha, so fun!', '📸 Click!'], happy: ['Very ngon!', 'Số dzách!'], grumpy: ['Hmm... still waiting?', 'Lâu quá nha!'], furious: ['Too slow!!', 'Oh my god!!'] },
];

export const EVENT_INFO = {
  police:      { banner: '🚨 Công an tới! Dẹp hàng!', sfx: 'whistle' },
  moto:        { banner: '🛵 Xe máy lao qua bếp!', sfx: 'horn' },
  inspector:   { banner: '🧐 Thanh tra vệ sinh sắp tới! Dọn sàn đi!', sfx: 'alert' },
  banana:      { banner: '🍌 Khách vứt vỏ chuối!', sfx: 'pop' },
  rain:        { banner: '🌧️ Mưa rào! Sàn ướt trơn trượt!', sfx: 'thunder' },
  power:       { banner: '💡 Mất điện! Bếp tắt lửa!', sfx: 'powerdown' },
  firecracker: { banner: '🧨 Pháo nổ!', sfx: 'alert' },
  bigwave:     { banner: '🌊 Sóng lớn! Bám chắc vào!', sfx: 'wave' },
  fogthick:    { banner: '🌫️ Sương mù kéo tới!', sfx: 'wave' },
};

// Câu than chung theo tâm trạng (dùng khi khách không có câu riêng)
export const MOOD_LINES = {
  grumpy: ['Lâu thế nhỉ...', 'Đói meo rồi đây!', 'Nhanh lên giùm cái!', 'Chậc chậc...'],
  angry: ['Bao giờ mới có hả?!', 'Chậm như rùa!', 'Quán gì kỳ vậy!'],
  furious: ['Thôi tôi đi quán khác!!', 'Trời ơi là trời!!'],
  sad: ['Huhu đói quá...', 'Thôi về vậy...', 'Buồn ghê...'],
  wrong: ['Tôi gọi món khác cơ!', 'Ơ, không phải món này!'],
  order: ['Cho một bát nhé!', 'Làm cho tôi một phần!', 'Chủ quán ơi!'],
};
export const CHEF_SAD = ['Tiếc quá!', 'Huhu đổ hết rồi...', 'Công cốc rồi!', 'Hỏng bét!'];
export const CHEF_FURIOUS = ['Lại nữa à?!!', 'Tức quá đi mất!!', 'Đứng yên đó!!'];
