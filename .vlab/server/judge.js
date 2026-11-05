'use strict';
/*
 * 题库存取 + 判题流程
 */
const fs = require('fs');
const path = require('path');
const { compileAndRun } = require('./sim');
const { lint } = require('./lint');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const RUNS = path.join(DATA, 'runs');
const PROG = path.join(DATA, 'progress');
const ANS = path.join(DATA, 'answers');
const TESTS = path.join(DATA, 'tests');

let chapters = null;
let P = null;

function loadChapters() {
  if (chapters) return chapters;
  const dir = path.join(DATA, 'problems');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.js') && !f.startsWith('_')).sort() : [];
  chapters = files.map((f) => {
    const full = path.join(dir, f);
    delete require.cache[require.resolve(full)];
    const ch = require(full);
    for (const p of ch.problems) {
      p.chapter = ch.chapter;
      p.chapterTitle = ch.title;
      p.tag = ch.tag;
      p.group = ch.group || '教材';
      p.testDir = ch.testDir || ch.chapter;
    }
    return ch;
  });
  return chapters;
}

function helpers() {
  if (P) return P;
  delete require.cache[require.resolve(path.join(DATA, 'tbjudge.js'))];
  P = require(path.join(DATA, 'tbjudge.js'));
  return P;
}

function reload() { chapters = null; P = null; return loadChapters(); }
function allProblems() { const out = []; for (const ch of loadChapters()) for (const p of ch.problems) out.push(p); return out; }
function findProblem(id) { return allProblems().find((p) => p.id === id) || null; }

function publicProblem(p) {
  if (!p) return null;
  const { solution, ...rest } = p;
  return { ...rest, hasSolution: !!solution };
}

function getSolution(p, variant = 'default') {
  if (!p || !p.solution) return null;
  if (typeof p.solution === 'string') return p.solution;
  return p.solution[variant] || p.solution.default || null;
}

function sanitizeId(s) { return String(s || '').replace(/[^A-Za-z0-9_\-]/g, '_').slice(0, 96); }

function clearDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  fs.mkdirSync(dir, { recursive: true });
}

function writeFiles(dir, files) {
  for (const f of files) fs.writeFileSync(path.join(dir, f.name), f.content, 'utf8');
}

function collectTops(files) {
  const list = [];
  for (const f of files) {
    if (!/\.v$/i.test(f.name)) continue;
    const re = /\bmodule\s+([A-Za-z_]\w*)/g;
    let m;
    while ((m = re.exec(f.content))) list.push(m[1]);
  }
  return [...new Set(list)];
}

function lintOn(files, p) {
  const issues = [];
  const opts = p.lint || {};
  const multi = files.filter((f) => /\.(v|sv)$/i.test(f.name)).length > 1;
  for (const f of files) {
    if (!/\.(v|sv)$/i.test(f.name)) continue;
    for (const it of lint(f.content || '', opts)) {
      issues.push({ ...it, file: f.name, msg: (multi ? `[${f.name}] ` : '') + it.msg });
    }
  }
  return issues;
}

async function judge(req) {
  const p = findProblem(req.problemId);
  if (!p) return { status: 'notfound', message: '找不到题目：' + req.problemId };
  if (p.type === 'quiz') return { status: 'quiz' };
  if (p.type !== 'tb' && (!p.tests || !p.tests.length)) return { status: 'notfound', message: '该题没有测试台' };

  if (req.waveOnly) return judgeWave(p, req);

  // 交互模式：交给命令行子进程（它的输出走文件重定向，能在更严格的沙箱里工作）
  if (!process.env.VLAB_INPROC) {
    const { runCli } = require('./cli_bridge');
    const t0 = Date.now();
    const r = await runCli(p.id, req.files, 150000);
    r.totalMs = Date.now() - t0;
    if (r.status === 'error') {
      // 退回到进程内执行
      process.env.VLAB_INPROC = '1';
      try { return await judge(req); } finally { delete process.env.VLAB_INPROC; }
    }
    if (!req.show && r.tests) {
      r.tests = r.tests.map((t) => ({ ...t, checks: (t.checks || []).filter((c) => c.res !== 'P').slice(0, 12) }));
    }
    return r;
  }

  const runId = `${sanitizeId(p.id)}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const dir = path.join(RUNS, runId);
  pruneRuns();
  clearDir(dir);

  if (p.type === 'tb') return judgeTb(p, req, dir, runId);

  const lintIssues = lintOn(req.files, p);
  const tbName = `tb_${p.tests[0].tb}`;
  const tbPath = path.join(TESTS, p.testDir, `${tbName}.v`);
  const extra = [];
  if (fs.existsSync(tbPath)) extra.push({ name: `${tbName}.v`, content: fs.readFileSync(tbPath, 'utf8') });
  for (const t of (p.tests[0].data || [])) {
    const f = path.join(TESTS, p.testDir, t);
    if (fs.existsSync(f)) extra.push({ name: t, content: fs.readFileSync(f, 'utf8') });
  }
  const files = [...req.files, ...extra];
  writeFiles(dir, files);
  const tops = collectTops(files);

  const result = await compileAndRun({ dir, sources: files, tops, mode: 'sim', probes: null });
  let tests = [];
  let watch = null;
  if (result.sim) {
    tests = quantify(result, req);
    if (req.show && p.probe) {
    }
  }
  return finish(result, tests, lintIssues, runId, req, watch);
}

function finish(result, tests, lintIssues, runId, req, watch) {
  const maybe = tests.reduce((a, t) => a + (t.maybe || 0), 0);
  const fail = tests.reduce((a, t) => a + (t.fail || 0), 0);
  const errs = lintIssues.filter((l) => l.sev === 'error').length;
  const passed = result.ok && tests.length > 0 && fail === 0 && errs === 0;
  return {
    status: passed ? 'pass' : 'fail',
    stage: result.stage,
    compile: result.compile,
    sim: result.sim ? { output: result.sim.output.slice(0, 60000), ms: result.sim.ms, killed: result.sim.killed } : null,
    tests, maybe, failCount: fail, lintErrors: errs,
    lint: lintIssues,
    watch,
    runId,
    showAll: !!req.show,
  };
}

/* 清理旧运行目录，避免磁盘被填满 */
function pruneRuns(maxKeep = 60) {
  try {
    const dirs = fs.readdirSync(RUNS).filter((d) => d !== '_selftest')
      .map((d) => ({ d, t: fs.statSync(path.join(RUNS, d)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    for (const x of dirs.slice(maxKeep)) {
      try { fs.rmSync(path.join(RUNS, x.d), { recursive: true, force: true }); } catch (_) {}
    }
  } catch (_) {}
}

/** 只生成波形数据（不判题）：用题目自带的激励重跑一次，抓 [WAVE] 行 */
async function judgeWave(p, req) {
  if (!p.wave) return { watch: [] };
  const runId = `wave_${sanitizeId(p.id)}_${Date.now()}`;
  const dir = path.join(RUNS, runId);
  pruneRuns();
  clearDir(dir);
  const wavesrc = p.wave();
  const files = [...req.files, { name: '__vlab_wave.v', content: wavesrc }];
  writeFiles(dir, files);
  const parser = (out) => out.split('\n').filter((l) => l.startsWith('[WAVE]')).map((l) => l.slice(6).trim());
  // 走命令行（沙箱里也能工作）
  if (!process.env.VLAB_INPROC) {
    const { runToFile } = require('./proc');
    const { IVERILOG, VVP } = require('./proc');
    const names = files.filter((f) => /\.v$/i.test(f.name)).map((f) => f.name);
    const comp = await runToFile(IVERILOG, ['-g2012', '-s', '__vlab_wave', '-o', 'wave.vvp', ...names], dir, 'wave_c');
    if (comp.code !== 0) {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
      return { watch: [], compile: { code: comp.code, output: comp.output.slice(0, 2000) } };
    }
    const r = await runToFile(VVP, ['wave.vvp'], dir, 'wave_r');
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
    return { watch: parser(r.output), compile: { code: 0, output: '' } };
  }
  const res = await compileAndRun({ dir, sources: files, tops: ['__vlab_wave'], mode: 'sim', probes: null });
  const out = res.sim ? res.sim.output : '';
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  return { watch: parser(out), compile: res.compile ? { code: res.compile.code, output: String(res.compile.output).slice(0, 2000) } : null };
}

function groupBlocks(out) {
  let cur = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('[CHECK]')) {
      if (!cur) { cur = { checks: [] }; blocks.push(cur); }
      const v = line.slice(7).trim();
      cur.checks.push({ res: v.slice(0, 1), value: v.slice(1).trim() });
    } else if (/^\[VEC\]|^\[SEQ\]|^\[STEP\]|^\[CASE\]|^\[BUS\]|^\[SIM\]/.test(line)) {
      cur = { checks: [] };
      blocks.push(cur);
    }
  }
  return blocks.filter((b) => b.checks.length);
}

function quantify(result, req) {
  const out = result.sim ? result.sim.output : '';
  const blocks = groupBlocks(out);
  const show = !!req.show;
  if (!blocks.length) {
    return [{
      name: '仿真', passed: false, total: 1, pass: 0, maybe: 0, fail: 1,
      checks: [{ res: 'F', value: '没有产生任何检查结果：' + (result.sim ? (result.sim.killed ? '仿真超时（可能死循环，或时钟/复位没有产生）' : '可能卡死，或测试没有运行完') : '仿真没有运行') }],
    }];
  }
  return blocks.map((b, i) => {
    const fail = b.checks.filter((c) => c.res === 'F').length;
    const maybe = b.checks.filter((c) => c.res === 'M').length;
    const pass = b.checks.filter((c) => c.res === 'P').length;
    return {
      name: blocks.length > 1 ? `第 ${i + 1} 组` : '整组测试',
      passed: fail === 0,
      total: b.checks.length, pass, fail, maybe,
      checks: show ? b.checks : b.checks.filter((c) => c.res !== 'P').slice(0, 12),
    };
  });
}

async function judgeTb(p, req, dir, runId) {
  const H = helpers();
  const entry = H.KNOWN[p.tb];
  if (!entry) return { status: 'notfound', message: '测试台评分规则缺失' };
  const lintIssues = lintOn(req.files, p);
  const built = H.build(req.files, p.tb);
  const extra = built ? built.files.slice() : [];
  const hx = path.join(TESTS, 'ch09', `vectors_${p.tb}.hex`);
  if (fs.existsSync(hx)) extra.push({ name: 'vectors.hex', content: fs.readFileSync(hx, 'utf8') });
  const files = [...req.files, ...extra];
  writeFiles(dir, files);
  const tops = collectTops(files);
  const result = await compileAndRun({ dir, sources: files, tops, mode: 'sim', probes: null });
  if (!result.compile || result.compile.code !== 0) {
    return finish({ ...result, ok: false, stage: 'compile' }, [], lintIssues, runId, req);
  }
  const checks = H.analyze(p.tb, result.sim ? result.sim.output : '', dir);
  const fail = checks.filter((c) => c.res === 'F').length;
  const maybe = checks.filter((c) => c.res === 'M').length;
  let watch = null;
  if (req.show) {
    try {
      const sigs = ['clk', ...Object.keys(entry.signals)].map((n) => ({ name: n, w: entry.signals[n] || 1 }));

    } catch (_) { watch = null; }
  }
  const tests = [{
    name: 'Testbench 行为检查',
    passed: fail === 0,
    total: checks.length,
    pass: checks.filter((c) => c.res === 'P').length, fail, maybe,
    checks: req.show ? checks : checks.filter((c) => c.res !== 'P'),
  }];
  const out = result.sim ? result.sim.output : '';
  const finished = /\$finish called/.test(out);
  const ok = fail === 0 && finished && !!(result.sim && result.sim.code === 0) && !!built;
  return finish({ ...result, ok }, tests, lintIssues, runId, req, watch);
}

function saveProgress(obj) {
  fs.mkdirSync(PROG, { recursive: true });
  fs.writeFileSync(path.join(PROG, 'progress.json'), JSON.stringify(obj, null, 2), 'utf8');
  return { ok: true };
}
function loadProgress() {
  try { return JSON.parse(fs.readFileSync(path.join(PROG, 'progress.json'), 'utf8')); } catch (_) { return {}; }
}
function saveAnswer(pid, name, code) {
  fs.mkdirSync(ANS, { recursive: true });
  const f = path.join(ANS, `${sanitizeId(pid)}${name ? '__' + sanitizeId(name) : ''}.v`);
  fs.writeFileSync(f, code, 'utf8');
  return { ok: true, path: f };
}

module.exports = {
  loadChapters, reload, allProblems, findProblem, publicProblem, getSolution, judge,
  saveProgress, loadProgress, saveAnswer, DATA, ROOT, TESTS,
  lintOnFiles: lintOn,
};