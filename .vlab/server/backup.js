'use strict';
/**
 * 备份：把 .vlab（不含 tools 二进制与运行时垃圾）打包成 zip
 *   - 纯 Node 实现，不依赖 7-Zip / PowerShell
 *   - 输出到 .vlab\tools\backup\
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const SRC = ROOT;
const OUTDIR = path.join(ROOT, 'tools', 'backup');

// 不打包的内容
const SKIP_DIRS = new Set(['tools', 'runs', 'cache', 'tmp', 'logs', 'download', 'progress', 'answers', 'node_modules', '.git']);
const MAX_FILES = 20000;

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
    + '_' + p(d.getHours()) + '-' + p(d.getMinutes());
}

function collect(dir, base, out) {
  if (out.length > MAX_FILES) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = base ? base + '/' + e.name : e.name;
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      collect(full, rel, out);
    } else if (e.isFile()) {
      if (/\.(log|pid|vvp|tmp)$/i.test(e.name)) continue;
      try {
        const st = fs.statSync(full);
        out.push({ full, rel, size: st.size, mtime: st.mtime });
      } catch (_) {}
    }
  }
  return out;
}

// ---------- 极简 zip 写入 ----------
function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  return (crc ^ -1) >>> 0;
}

function dosTime(d) {
  const time = ((d.getHours() & 0x1F) << 11) | ((d.getMinutes() & 0x3F) << 5) | ((Math.floor(d.getSeconds() / 2)) & 0x1F);
  const date = (((d.getFullYear() - 1980) & 0x7F) << 9) | (((d.getMonth() + 1) & 0x0F) << 5) | (d.getDate() & 0x1F);
  return { time, date };
}

function writeZip(files, outPath) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const f of files) {
    const data = fs.readFileSync(f.full);
    const compressed = zlib.deflateRawSync(data, { level: 9 });
    const useDeflate = compressed.length < data.length;
    const payload = useDeflate ? compressed : data;
    const method = useDeflate ? 8 : 0;
    const nameBuf = Buffer.from(f.rel.replace(/\\/g, '/'), 'utf8');
    const crc = crc32(data);
    const { time, date } = dosTime(f.mtime);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);   // UTF-8 文件名
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, payload);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(time, 12);
    cd.writeUInt16LE(date, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(payload.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([cd, nameBuf]));

    offset += local.length + nameBuf.length + payload.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  fs.writeFileSync(outPath, Buffer.concat([...chunks, centralBuf, end]));
}

// ---------- main ----------
console.log('');
console.log('  ==========================================');
console.log('    Verilog 闯关训练 · 备份');
console.log('  ==========================================');
console.log('');

const files = collect(SRC, '', []);
if (!files.length) {
  console.log('  没有可备份的文件。');
  process.exit(1);
}
fs.mkdirSync(OUTDIR, { recursive: true });
const outPath = path.join(OUTDIR, 'vlab_backup_' + stamp() + '.zip');

try {
  writeZip(files, outPath);
} catch (e) {
  console.log('  备份失败：' + e.message);
  console.log('');
  console.log('  请手动复制整个 .vlab 文件夹。');
  process.exit(1);
}

const size = fs.statSync(outPath).size;
console.log('  已打包 ' + files.length + ' 个文件');
console.log('');
console.log('  备份位置：');
console.log('    ' + outPath);
console.log('    大小：' + (size / 1024 / 1024).toFixed(2) + ' MB');
console.log('');
console.log('  说明：不含 tools 编译器与临时文件，');
console.log('        需要时用 tools\\fetch-tools.bat 重新下载。');
console.log('');
setTimeout(() => process.exit(0), 300);