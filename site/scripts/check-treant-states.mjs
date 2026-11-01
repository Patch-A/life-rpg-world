// 树人五状态素材（v3）验收：按 BRIEF-v3-five-states.md 的判据逐条量。
//
// 用法：node scripts/check-treant-states.mjs <素材目录>
// 默认读 docs/art/recordkeeper-concept-v2/
//
// 只读 PNGS，不改仓库、不接入应用。全部通过也只代表「素材够标准了」，
// 不代表真机好看——最后一条只有用户能在手机上判。
//
// 需要 PNG 解码：用 Node 自带的 zlib 手解，不引第三方依赖（仓库约定不加依赖）。
import {readFile} from 'node:fs/promises';
import {inflateSync} from 'node:zlib';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// 默认按「脚本在 site/scripts/、素材在仓库根 docs/」定位，不依赖当前工作目录：
// 从 site/ 还是仓库根跑，结果都一样。
const REPO = resolve(fileURLToPath(import.meta.url), '../../..');
const DIR = process.argv[2] || join(REPO, 'docs/art/recordkeeper-concept-v2');
const FILES = [
  ['idle', 'state-idle.png'],
  ['speaking', 'state-speaking.png'],
  ['listening', 'state-listening.png'],
  ['thinking', 'state-thinking.png'],
  ['still', 'state-still.png'],
];

// ---------- 最小 PNG 解码（8-bit RGBA / RGB / 灰度，非隔行） ----------
function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG');
  let pos = 8, w = 0, h = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  let palette = null, trns = null;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'PLTE') palette = Buffer.from(data);
    else if (type === 'tRNS') trns = Buffer.from(data);
    else if (type === 'IDAT') idat.push(Buffer.from(data));
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (bitDepth !== 8) throw new Error(`只支持 8-bit，实际 ${bitDepth}`);
  if (interlace !== 0) throw new Error('不支持隔行（Adam7）PNG');
  const CH = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[colorType];
  if (!CH) throw new Error(`不支持 colorType ${colorType}`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * CH;
  const out = Buffer.alloc(w * h * 4);
  const prev = Buffer.alloc(stride);
  let line = Buffer.alloc(stride);

  for (let y = 0; y < h; y++) {
    const off = y * (stride + 1);
    const filter = raw[off];
    raw.copy(line, 0, off + 1, off + 1 + stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= CH ? line[i - CH] : 0;
      const b = prev[i];
      const c = i >= CH ? prev[i - CH] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[i] = v & 0xff;
    }
    line.copy(prev);
    for (let x = 0; x < w; x++) {
      const s = x * CH, d = (y * w + x) * 4;
      let r, g, b2, al = 255;
      if (colorType === 6) { r = line[s]; g = line[s + 1]; b2 = line[s + 2]; al = line[s + 3]; }
      else if (colorType === 2) { r = line[s]; g = line[s + 1]; b2 = line[s + 2]; }
      else if (colorType === 0) { r = g = b2 = line[s]; }
      else if (colorType === 4) { r = g = b2 = line[s]; al = line[s + 1]; }
      else { const idx = line[s]; r = palette[idx * 3]; g = palette[idx * 3 + 1]; b2 = palette[idx * 3 + 2]; if (trns && idx < trns.length) al = trns[idx]; }
      out[d] = r; out[d + 1] = g; out[d + 2] = b2; out[d + 3] = al;
    }
  }
  return {w, h, px: out};
}

// ---------- 判据 ----------
function bbox({w, h, px}) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (px[(y * w + x) * 4 + 3] > 8) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : {x0, y0, x1, y1};
}

function corners(img) {
  const {w, h, px} = img;
  const at = (x, y) => px[(y * w + x) * 4 + 3];
  return [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)];
}

function transparentRatio(img) {
  const {w, h, px} = img;
  let n = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] < 8) n++;
  return n / (w * h);
}

// 判「没有紫色」不能要求严格 0：抗锯齿边缘出几个孤立像素是正常的，
// 拿 ===0 去卡只会逼着人去抠图。按「可见面积里的万分之一」给一个容忍量，
// 同时把实际数量打出来——真要混进一块紫色，数量会远高于这个量级。
function purplePixels(img) {
  const {px} = img;
  let n = 0, visible = 0;
  for (let i = 0; i < px.length; i += 4) {
    const al = px[i + 3];
    if (al < 128) continue;
    visible++;
    const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    const s = max === 0 ? 0 : d / max;
    if (s <= 0.28) continue;
    let hh;
    if (max === r) hh = 60 * (((g - b) / d) % 6);
    else if (max === g) hh = 60 * ((b - r) / d + 2);
    else hh = 60 * ((r - g) / d + 4);
    if (hh < 0) hh += 360;
    if (hh >= 255 && hh < 330) n++;
  }
  return {n, visible};
}

// 缩到 56px 的剪影，用面积平均当近似（够判断「形状差多少」）。
function silhouette(img, size = 56) {
  const bb = bbox(img);
  if (!bb) return null;
  const {w, px} = img;
  const bw = bb.x1 - bb.x0 + 1, bh = bb.y1 - bb.y0 + 1;
  const side = Math.max(bw, bh);
  const out = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sx0 = bb.x0 + Math.floor((x / size) * side);
    const sx1 = bb.x0 + Math.floor(((x + 1) / size) * side);
    const sy0 = bb.y0 + Math.floor((y / size) * side);
    const sy1 = bb.y0 + Math.floor(((y + 1) / size) * side);
    let hit = 0, tot = 0;
    for (let sy = sy0; sy < Math.max(sy1, sy0 + 1); sy++) for (let sx = sx0; sx < Math.max(sx1, sx0 + 1); sx++) {
      if (sy < 0 || sy >= img.h || sx < 0 || sx >= w) continue;
      tot++;
      if (px[(sy * w + sx) * 4 + 3] > 128) hit++;
    }
    out[y * size + x] = tot && hit / tot >= 0.5 ? 1 : 0;
  }
  return out;
}

function diffRatio(a, b) {
  if (!a || !b) return 1;
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n / a.length;
}

// ---------- 跑 ----------
const results = [];
const check = (name, pass, detail) => {
  results.push({name, pass, detail});
  console.log(`${pass ? '✅' : '❌'} ${name} — ${detail}`);
};

const imgs = {};
for (const [key, file] of FILES) {
  try {
    imgs[key] = decodePNG(await readFile(join(DIR, file)));
  } catch (e) {
    console.log(`❌ 读不到 ${file} — ${e.message}`);
    console.log('\n素材还没到，先不用往下跑。');
    process.exit(2);
  }
}

const sizes = Object.entries(imgs).map(([k, i]) => `${k}:${i.w}x${i.h}`);
const sameSize = new Set(Object.values(imgs).map(i => `${i.w}x${i.h}`)).size === 1;
check('五张画布尺寸一致', sameSize, sizes.join('  '));

const boxes = Object.fromEntries(Object.entries(imgs).map(([k, i]) => [k, bbox(i)]));
const missing = Object.entries(boxes).filter(([, b]) => !b).map(([k]) => k);
check('每张都有可见内容', missing.length === 0, missing.length ? `空白：${missing.join(',')}` : '五张都有内容');

if (!missing.length) {
  const bottoms = Object.entries(boxes).map(([k, b]) => [k, b.y1]);
  const spread = Math.max(...bottoms.map(([, y]) => y)) - Math.min(...bottoms.map(([, y]) => y));
  check('土包基线对齐（≤2px）', spread <= 2, `底边差 ${spread}px：${bottoms.map(([k, y]) => `${k}=${y}`).join(' ')}`);

  const cx = Object.entries(boxes).map(([k, b]) => [k, +((b.x0 + b.x1) / 2).toFixed(1)]);
  const cspread = Math.max(...cx.map(([, v]) => v)) - Math.min(...cx.map(([, v]) => v));
  check('水平居中一致（中心差 ≤3px）', cspread <= 3, `中心差 ${cspread.toFixed(1)}px`);
}

for (const [k, img] of Object.entries(imgs)) {
  const c = corners(img);
  const tr = transparentRatio(img);
  check(`${k} 四角透明`, c.every(a => a === 0), `角点 alpha=${c.join(',')}；全透明 ${(tr * 100).toFixed(1)}%`);
  check(`${k} 透明面积 ≥30%`, tr >= 0.3, `${(tr * 100).toFixed(1)}%`);
  const {n: p, visible} = purplePixels(img);
  const tolerance = Math.max(5, Math.floor(visible * 0.0001));
  check(`${k} 无紫色像素`, p <= tolerance, `${p} 个（容忍上限 ${tolerance}）`);
}

// thinking / idle 剪影必须分得开
const sIdle = silhouette(imgs.idle), sThink = silhouette(imgs.thinking);
const d = diffRatio(sIdle, sThink);
check('thinking 与 idle 剪影可区分（≥8%）', d >= 0.08, `56px 剪影差异 ${(d * 100).toFixed(1)}%`);

const failed = results.filter(r => !r.pass);
console.log(`\n---- ${results.length - failed.length}/${results.length} 通过 ----`);
if (failed.length) {
  console.log('未通过的项目：');
  for (const f of failed) console.log(` - ${f.name}：${f.detail}`);
  console.log('\n把这份输出贴回去即可，不用你逐条解释。');
  process.exit(1);
}
console.log('素材层面全部通过。下一步是接入应用 + 真机看观感，后者只有你能判。');
