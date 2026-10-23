// 席の見取り図の共通処理（seat.html と index.html から読み込む）
// 机の大きさ・椅子の並べ方・保存データの読み取りをまとめている
// 机の大きさなどを変えるときは、このファイルだけ直せば両方のページに反映される

// ===== 見取り図の設定 =====
// 見取り図は 1000 x 600 の論理座標で管理し、画面幅に合わせて拡大縮小する
const FLOOR_W = 1000;
const FLOOR_H = 600;
const GRID = 10;                                          // 机を動かすときのマス目
const CHAIR_SIZE = 20;                                    // seat.html の .chair の width/height と合わせる
const DESK_TYPES = {
  // caps: 辺ごとに置ける椅子の数（top/bottom = 長い辺、left/right = 短い辺）
  long:   { label: '長机',   w: 145, h: 48, caps: { top: 3, bottom: 3, left: 0, right: 0 } },
  medium: { label: '中机',   w: 95,  h: 48, caps: { top: 2, bottom: 2, left: 1, right: 1 } },
  square: { label: '正方形', w: 70,  h: 70, caps: { top: 1, bottom: 1, left: 1, right: 1 } },
  big:    { label: '大机',   w: 145, h: 95, caps: { top: 3, bottom: 3, left: 2, right: 2 } },
};
const DEFAULT_TYPE = 'long';

// 机の用途の候補（ここにない用途は「その他」で自由に入力できる）
// 用途が「プレイエリア」か用途なしの机だけを、使用率・残り席数に数える
const PLAY_PURPOSE = 'プレイエリア';
const PURPOSES = ['受付', 'ボードゲーム置き場', PLAY_PURPOSE, '展示'];
const PURPOSE_MAX_LEN = 16;

// 回転前の机の幅・高さ
function deskSize(desk) {
  const t = DESK_TYPES[desk.type] || DESK_TYPES[DEFAULT_TYPE];
  return { w: t.w, h: t.h };
}

// 角度を 0〜315 の 45° 刻みにそろえる
function normalizeRotation(r) {
  const n = Math.round((Number(r) || 0) / 45) * 45;
  return ((n % 360) + 360) % 360;
}

// 回転後の机を囲む四角（見取り図上の座標）
// desk.x, desk.y は回転前の机の左上。回転は机の中心で行う
function deskBounds(desk) {
  const { w, h } = deskSize(desk);
  const rad = desk.rotation * Math.PI / 180;
  const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
  const bw = w * cos + h * sin;
  const bh = w * sin + h * cos;
  const cx = desk.x + w / 2, cy = desk.y + h / 2;
  return { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh };
}

// 椅子が部屋からはみ出さないよう、机を壁から離す距離
const WALL_PAD = 30;

function clampDesk(desk) {
  const b = deskBounds(desk);
  const bx = Math.max(WALL_PAD, Math.min(FLOOR_W - b.w - WALL_PAD, b.x));
  const by = Math.max(WALL_PAD, Math.min(FLOOR_H - b.h - WALL_PAD, b.y));
  desk.x = Math.round(desk.x + bx - b.x);
  desk.y = Math.round(desk.y + by - b.y);
}

// 他の机（allDesks）と重ならない空き場所を探す（見つからなければ左上）
// 戻り値は回転前の机の左上座標
function findFreeSpot(desk, allDesks) {
  const b0 = deskBounds({ ...desk, x: 0, y: 0 });   // 左上からのずれを求める
  const margin = CHAIR_SIZE + 10;   // 椅子の分だけ間をあける
  for (let y = margin; y + b0.h <= FLOOR_H; y += GRID * 2) {
    for (let x = margin; x + b0.w <= FLOOR_W; x += GRID * 2) {
      const hit = allDesks.some(o => {
        if (o === desk || o.x == null) return false;
        const s = deskBounds(o);
        return x < s.x + s.w + margin && s.x < x + b0.w + margin &&
               y < s.y + s.h + margin && s.y < y + b0.h + margin;
      });
      if (!hit) return { x: Math.round(x - b0.x), y: Math.round(y - b0.y) };
    }
  }
  return { x: margin - b0.x, y: margin - b0.y };
}

// 位置が未設定の机（古いデータなど）を自動で並べる
function placeUnplacedDesks(allDesks) {
  allDesks.forEach(d => {
    if (!Number.isFinite(d.x) || !Number.isFinite(d.y)) {
      d.x = null; d.y = null;
      const spot = findFreeSpot(d, allDesks);
      d.x = spot.x; d.y = spot.y;
    }
    clampDesk(d);
  });
}

// ===== 椅子の並べ方 =====
// 椅子は回転前の机の4辺（top/bottom = 長い辺、left/right = 短い辺）のどれかに置く
// 辺は机と一緒に回転する。同じ辺の椅子は等間隔に並べる
const SIDES = ['top', 'bottom', 'left', 'right'];
const LONG_SIDES = ['top', 'bottom'];
const SHORT_SIDES = ['left', 'right'];

function sideCaps(desk) {
  return (DESK_TYPES[desk.type] || DESK_TYPES[DEFAULT_TYPE]).caps;
}

function deskCapacity(desk) {
  const caps = sideCaps(desk);
  return SIDES.reduce((sum, k) => sum + caps[k], 0);
}

function sideCounts(desk) {
  const counts = { top: 0, bottom: 0, left: 0, right: 0 };
  desk.seats.forEach(s => { if (s.side in counts) counts[s.side]++; });
  return counts;
}

// 椅子の少ない辺を返す（長い辺を優先）。full = true なら満員の辺も含める
function pickSide(desk, full) {
  const caps = sideCaps(desk), counts = sideCounts(desk);
  for (const group of [LONG_SIDES, SHORT_SIDES]) {
    const ok = group.filter(k => caps[k] > 0 && (full || counts[k] < caps[k]));
    if (ok.length) return ok.reduce((a, b) => (counts[b] < counts[a] ? b : a));
  }
  return null;
}

// 空いている辺（満員なら null）
function freeSide(desk) {
  return pickSide(desk, false);
}

// 辺が決まっていない椅子や、上限を超えた辺の椅子に辺を割り当て直す
// 机全体が満員のときは、椅子を減らさずに長い辺へ重ねて置く（定員オーバー表示になる）
function normalizeSides(desk) {
  const caps = sideCaps(desk);
  const counts = { top: 0, bottom: 0, left: 0, right: 0 };
  desk.seats.forEach(s => {
    if (SIDES.includes(s.side) && counts[s.side] < caps[s.side]) counts[s.side]++;
    else delete s.side;
  });
  desk.seats.forEach(s => {
    if (!s.side) s.side = freeSide(desk) || pickSide(desk, true) || 'top';
  });
}

// 辺の上の位置（t = 0〜1、off = 机の端からの距離）。机の左上からの相対座標
function sidePoint(side, t, w, h, off) {
  switch (side) {
    case 'top':    return { x: w * t, y: -off };
    case 'bottom': return { x: w * t, y: h + off };
    case 'left':   return { x: -off, y: h * t };
    default:       return { x: w + off, y: h * t };
  }
}

// 各椅子の位置（机の左上からの相対座標）を、椅子の並び順で返す
function chairLayout(desk) {
  const { w, h } = deskSize(desk);
  const off = CHAIR_SIZE / 2 + 3;
  const groups = { top: [], bottom: [], left: [], right: [] };
  desk.seats.forEach((s, i) => (groups[s.side] || groups.top).push(i));
  const pos = [];
  SIDES.forEach(k => {
    const m = groups[k].length;
    groups[k].forEach((seatIdx, j) => {
      pos[seatIdx] = sidePoint(k, (j + 1) / (m + 1), w, h, off);
    });
  });
  return pos;
}

// ===== 保存データの読み取り =====
// 机の椅子数を seatCount にそろえる
function adjustDeskSeats(desk, desiredCount) {
  desiredCount = Number.isInteger(desiredCount) ? desiredCount : 0;
  desk.seatCount = Math.max(0, Math.min(50, desiredCount));

  // 実際の椅子数をseatCountに合わせる
  if (desk.seats.length > desk.seatCount) {
    desk.seats = desk.seats.slice(0, desk.seatCount);
  }
}

// クラウドから読み込んだ机データを整える（足りない項目を補い、椅子の辺と机の位置を決める）
function parseDesks(rawDesks) {
  const list = rawDesks.map(d => ({
    id: d.id || `${Date.now()}-${Math.random()}`,
    name: d.name || '机',
    seatCount: Number.isInteger(d.seatCount) ? d.seatCount : 0,
    status: d.status === 'occupied' ? 'occupied' : 'free',
    seats: Array.isArray(d.seats)
      ? d.seats.map(s => {
          const seat = { id: s.id || `${d.name}-seat` };
          // 椅子を置く辺
          if (SIDES.includes(s.side)) seat.side = s.side;
          return seat;
        })
      : [],
    type: DESK_TYPES[d.type] ? d.type : DEFAULT_TYPE,
    purpose: typeof d.purpose === 'string' ? d.purpose.trim().slice(0, PURPOSE_MAX_LEN) : '',
    rotation: normalizeRotation(d.rotation),
    x: Number.isFinite(d.x) ? d.x : null,
    y: Number.isFinite(d.y) ? d.y : null,
  }));

  list.forEach(d => {
    adjustDeskSeats(d, d.seatCount);
    normalizeSides(d);
  });
  placeUnplacedDesks(list);
  return list;
}

// ===== スタッフエリア =====
// 見取り図上の四角いエリア。中央に label（初期値 "STAFF"）を表示する
// 机の中心がエリアの中にある机はスタッフ用として、使用率・残り席数の計算から外す
const AREA_DEFAULT_LABEL = 'STAFF';
const AREA_MIN_W = 60;
const AREA_MIN_H = 40;

function clampArea(area) {
  area.w = Math.max(AREA_MIN_W, Math.min(FLOOR_W, area.w));
  area.h = Math.max(AREA_MIN_H, Math.min(FLOOR_H, area.h));
  area.x = Math.max(0, Math.min(FLOOR_W - area.w, area.x));
  area.y = Math.max(0, Math.min(FLOOR_H - area.h, area.y));
}

// クラウドから読み込んだエリアデータを整える
function parseAreas(rawAreas) {
  if (!Array.isArray(rawAreas)) return [];
  return rawAreas.map(a => {
    const area = {
      id: a.id || `${Date.now()}-${Math.random()}`,
      x: Number.isFinite(a.x) ? a.x : 0,
      y: Number.isFinite(a.y) ? a.y : 0,
      w: Number.isFinite(a.w) ? a.w : 200,
      h: Number.isFinite(a.h) ? a.h : 120,
      label: typeof a.label === 'string' && a.label.trim() ? a.label.trim().slice(0, 10) : AREA_DEFAULT_LABEL,
    };
    clampArea(area);
    return area;
  });
}

// 机がスタッフエリアの中にあるか（机の中心で判定）
function isStaffDesk(desk, areas) {
  const { w, h } = deskSize(desk);
  const cx = desk.x + w / 2, cy = desk.y + h / 2;
  return areas.some(a => cx >= a.x && cx <= a.x + a.w && cy >= a.y && cy <= a.y + a.h);
}

// お客さん用の机か（スタッフエリアの外にあり、用途が「プレイエリア」か用途なし）
function isGuestDesk(desk, areas) {
  return !isStaffDesk(desk, areas) && (!desk.purpose || desk.purpose === PLAY_PURPOSE);
}

// 席数の集計（お客さん用の机だけを数える）
// occupiedSeats: 使用中の机の椅子数
// staffSeats: スタッフエリアの机の椅子数、otherSeats: 受付・置き場など用途がプレイ以外の机の椅子数
// excludedSeats: 使用率・残り席数の計算から外す椅子数（staffSeats + otherSeats）
function countSeats(desks, areas) {
  let occupiedSeats = 0, staffSeats = 0, otherSeats = 0;
  desks.forEach(d => {
    if (isStaffDesk(d, areas)) staffSeats += d.seats.length;
    else if (!isGuestDesk(d, areas)) otherSeats += d.seats.length;
    else if (d.status === 'occupied') occupiedSeats += d.seats.length;
  });
  return { occupiedSeats, staffSeats, otherSeats, excludedSeats: staffSeats + otherSeats };
}

// ===== 入口 =====
// 入口は部屋の壁（side: top/bottom/left/right）の上に置く
// pos = 壁に沿った入口の中心の位置、w = 入口の幅
const ENTRANCE_DEFAULT_W = 80;
const ENTRANCE_MIN_W = 40;
const ENTRANCE_MAX_W = 300;
const ENTRANCE_T = 14;   // 入口の帯の太さ

function wallLength(side) {
  return side === 'top' || side === 'bottom' ? FLOOR_W : FLOOR_H;
}

function clampEntrance(e) {
  if (!SIDES.includes(e.side)) e.side = 'bottom';
  e.w = Math.max(ENTRANCE_MIN_W, Math.min(ENTRANCE_MAX_W, Math.round(e.w)));
  const len = wallLength(e.side);
  e.pos = Math.max(e.w / 2, Math.min(len - e.w / 2, Math.round(e.pos)));
}

// クラウドから読み込んだ入口データを整える
function parseEntrances(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(r => {
    const e = {
      id: r.id || `${Date.now()}-${Math.random()}`,
      side: r.side,
      pos: Number.isFinite(r.pos) ? r.pos : 0,
      w: Number.isFinite(r.w) ? r.w : ENTRANCE_DEFAULT_W,
    };
    clampEntrance(e);
    return e;
  });
}

// 入口の帯の四角（部屋の内側、壁に沿って描く）
function entranceRect(e) {
  const a = e.pos - e.w / 2;
  switch (e.side) {
    case 'top':    return { x: a, y: 0, w: e.w, h: ENTRANCE_T };
    case 'bottom': return { x: a, y: FLOOR_H - ENTRANCE_T, w: e.w, h: ENTRANCE_T };
    case 'left':   return { x: 0, y: a, w: ENTRANCE_T, h: e.w };
    default:       return { x: FLOOR_W - ENTRANCE_T, y: a, w: ENTRANCE_T, h: e.w };
  }
}

// 「入口」の文字の位置（帯のすぐ内側）
function entranceLabelPoint(e) {
  const r = entranceRect(e);
  const inset = ENTRANCE_T + 16;
  switch (e.side) {
    case 'top':    return { x: e.pos, y: inset };
    case 'bottom': return { x: e.pos, y: FLOOR_H - inset };
    case 'left':   return { x: inset + 14, y: r.y + r.h / 2 };
    default:       return { x: FLOOR_W - inset - 14, y: r.y + r.h / 2 };
  }
}

// 部屋の中の点 p に一番近い壁と、壁に沿った位置
function nearestWall(p) {
  const d = { top: p.y, bottom: FLOOR_H - p.y, left: p.x, right: FLOOR_W - p.x };
  const side = SIDES.reduce((a, b) => (d[b] < d[a] ? b : a));
  return { side, pos: side === 'top' || side === 'bottom' ? p.x : p.y };
}

// ===== 用途の文字をまとめる =====
// 同じ用途で隣り合う机（机を囲む四角どうしのすき間が PURPOSE_GROUP_GAP 以下）を1グループにまとめる
// A–B、B–C が隣り合っていれば A・B・C が1グループになる
const PURPOSE_GROUP_GAP = 60;

function boundsGap(a, b) {
  const gx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
  const gy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
  return Math.hypot(gx, gy);
}

// 戻り値: [{ purpose, x, y }]（x, y = グループ全体を囲む四角の中心。ここに文字を1つ出す）
function purposeGroups(desks) {
  const list = desks.filter(d => d.purpose);
  const bounds = list.map(deskBounds);
  const parent = list.map((_, i) => i);
  const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (list[i].purpose === list[j].purpose && boundsGap(bounds[i], bounds[j]) <= PURPOSE_GROUP_GAP) {
        parent[find(i)] = find(j);
      }
    }
  }
  const groups = new Map();
  list.forEach((d, i) => {
    const root = find(i), b = bounds[i];
    const g = groups.get(root);
    if (!g) {
      groups.set(root, { purpose: d.purpose, x1: b.x, y1: b.y, x2: b.x + b.w, y2: b.y + b.h });
    } else {
      g.x1 = Math.min(g.x1, b.x); g.y1 = Math.min(g.y1, b.y);
      g.x2 = Math.max(g.x2, b.x + b.w); g.y2 = Math.max(g.y2, b.y + b.h);
    }
  });
  return [...groups.values()].map(g => ({ purpose: g.purpose, x: (g.x1 + g.x2) / 2, y: (g.y1 + g.y2) / 2 }));
}
