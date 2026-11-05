'use strict';
/*
 * 启动前预编译（按题目逐个快照）：
 *   每个题目：先把测试台编成快照（-s tp_xxx），学生实现存成 .vvp（-s impl_xxx），
 *   判题时把两者拼起来跑。这样避免不同题目 DUT 名字冲突，也不用每次重新解析测试台。
 */
const fs = require('fs');
const path = require('path');
const { runToFile, IVERILOG } = require('./proc');

const ROOT = path.join(__dirname, '..');
const CACHE = path.join(ROOT, 'data', 'cache');

function collect() {
  const J = require('./judge');
  const items = [];
  for (const p of J.allProblems()) {
    if (p.type === 'tb') continue;
    if (!p.tests || !p.tests.length) continue;
    const tb = `tb_${p.tests[0].tb}`;
    const f = path.join(ROOT, 'data', 'tests', p.testDir, `${tb}.v`);
    if (!fs.existsSync(f)) continue;
    items.push({
      id: p.id, tb, file: f, implMod: implModuleOf(p),
      data: (p.tests[0].data || [])
        .filter((d) => d !== `${tb}.v`)
        .map((d) => ({ name: d, path: path.join(ROOT, 'data', 'tests', p.testDir, d) }))
        .filter((d) => fs.existsSync(d.path)),
    });
  }
  return items;
}

/** 从参考实现里找出学生要写的模块名（用于生成 impl 快照） */
function implModuleOf(p) {
  const m = String(p.solution || '').match(/^\s*module\s+([A-Za-z_]\w*)/m);
  return m ? m[1] : null;
}

function signatureOf(items) {
  const parts = [];
  for (const it of items) {
    parts.push(it.id + ':' + it.tb + ':' + fs.statSync(it.file).size);
    for (const d of it.data) parts.push(d.name + ':' + fs.statSync(d.path).size);
  }
  return parts.join('|');
}

async function build(force) {
  fs.mkdirSync(CACHE, { recursive: true });
  const meta = path.join(CACHE, 'snapshots.json');
  const items = collect();
  const sig = signatureOf(items);
  if (!force && fs.existsSync(meta)) {
    try {
      const old = JSON.parse(fs.readFileSync(meta, 'utf8'));
      if (old.signature === sig && old.items.every((i) => fs.existsSync(i.snap) && (!i.impl || fs.existsSync(i.impl)))) return { ok: true, cached: true, items: old.items };
    } catch (_) {}
  }
  const out = [];
  for (const it of items) {
    const dir = path.join(CACHE, 'build', it.id);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${it.tb}.v`), fs.readFileSync(it.file, 'utf8').replace(/\r/g, ''), 'utf8');
    for (const d of it.data) fs.writeFileSync(path.join(dir, d.name), fs.readFileSync(d.path, 'utf8'), 'utf8');
    const vfiles = [`${it.tb}.v`, ...it.data.filter((d) => d.name.endsWith('.v')).map((d) => d.name)];
    const wrapper = `module vlab_entry (); endmodule\n`;
    fs.writeFileSync(path.join(dir, '__vlab_entry.v'), wrapper, 'utf8');
    const r = await runToFile(IVERILOG, ['-g2012', '-s', 'vlab_entry', '-o', 'snap.vvp', '__vlab_entry.v', ...vfiles], dir, 'build', 120000);
    if (r.code !== 0) {
      console.warn('[预编译失败]', it.id, r.output.split('\n').slice(0, 2).join(' ').slice(0, 160));
      continue;
    }
    const snap = path.join(CACHE, `${it.id}.tb.vvp`);
    fs.copyFileSync(path.join(dir, 'snap.vvp'), snap);
    const rec = { id: it.id, tb: it.tb, snap, tipMod: `vlab_tip_${it.id.replace(/[^A-Za-z0-9]/g, '_')}` };
    fs.rmSync(dir, { recursive: true, force: true });
    out.push(rec);
  }
  fs.writeFileSync(meta, JSON.stringify({ signature: sig, items: out, built: new Date().toISOString() }, null, 2), 'utf8');
  return { ok: true, cached: false, items: out };
}

function getSnapshot(problemId) {
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(CACHE, 'snapshots.json'), 'utf8'));
    const it = meta.items.find((i) => i.id === problemId);
    if (it && fs.existsSync(it.snap)) return it;
  } catch (_) {}
  return null;
}

module.exports = { build, getSnapshot, collect, CACHE, implModuleOf };

if (require.main === module) {
  build(true).then((r) => { console.log('snapshots:', r.items.length, r.cached ? '(cached)' : '(built)'); process.exit(0); });
}