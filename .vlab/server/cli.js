'use strict';
/*
 * 命令行版判题器（沙箱里也能用）：
 *   node server/cli.js <problemId> <源文件路径> [--show]
 * 它自己做“编译 -> 仿真 -> 解析”三步，子进程输出重定向到文件（不用管道），
 * 所以不受“父进程捕获子进程管道”限制。
 *
 * 服务端（app.js）在无法直接 spawn 时也会调用它，见 cli_bridge.js。
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TOOLS = path.join(ROOT, 'tools');
const ICARUS = path.join(TOOLS, 'icarus');
const IVERILOG = path.join(ICARUS, 'iverilogx.exe');
const VVP = path.join(ICARUS, 'vvpx.exe');

const J = require('./judge');

function runToFile(exe, args, cwd, tag) {
  return new Promise((resolve) => {
    const outFile = path.join(cwd, `.${tag}.txt`);
    let fd;
    try { fd = fs.openSync(outFile, 'w'); } catch (e) { return resolve({ code: -9, output: String(e) }); }
    const t0 = Date.now();
    let child;
    const finish = (code) => {
      try { fs.closeSync(fd); } catch (_) {}
      let output = '';
      try { output = fs.readFileSync(outFile, 'utf8'); } catch (_) {}
      resolve({ code, output: output.replace(/\r/g, ''), ms: Date.now() - t0 });
    };
    try {
      child = spawn(exe, args, { cwd, stdio: ['ignore', fd, fd], windowsHide: true, env: { ...process.env, IVERILOG_IVLROOT: TOOLS } });
    } catch (e) {
      return finish(-1);
    }
    const timer = setTimeout(() => { try { child.kill(); } catch (_) {} }, tag === 'sim' ? 25000 : 90000);
    child.on('error', () => { clearTimeout(timer); finish(-1); });
    child.on('close', (code) => { clearTimeout(timer); finish(code); });
  });
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

async function judgeFiles(problemId, files) {
  const p = J.findProblem(problemId);
  if (!p) return { status: 'notfound' };
  // Testbench 题：交给专门的评分器（延迟 require，避免循环依赖）
  if (p.type === 'tb') {
    const { gradeTb } = require('./tbgrade');
    const r = await gradeTb(problemId === 'c09_p01' ? 'tb_add8' : problemId === 'c09_p02' ? 'tb_popcount' : p.tb);
    if (r) return r;
  }
  const runId = `${p.id}_cli_${Date.now()}`;
  const dir = path.join(ROOT, 'data', 'runs', runId);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  fs.mkdirSync(dir, { recursive: true });

  // 附加测试台（与学生文件同目录，便于 .vvp 相对路径）
  const extra = [];
  if (p.type === 'tb') {
    const H = require(path.join(ROOT, 'data', 'tbjudge.js'));
    const built = H.build(files, p.tb);
    if (built) {
      // 先把与 DUT 无关的模块编进快照（避免把 DUT 留成"未定义模块"）
      const extraV = built.files.filter((f) => /\.v$/.test(f.name)).map((f) => f.name);
      await runToFile(IVERILOG, ['-g2012', '-s', '__vlab_obs', '-o', 'shim.vvp', ...extraV], dir, 'shim');
      extra.push(...built.files);
    }
    const hx = path.join(ROOT, 'data', 'tests', 'ch09', `vectors_${p.tb}.hex`);
    if (fs.existsSync(hx)) extra.push({ name: 'vectors.hex', content: fs.readFileSync(hx, 'utf8') });
  } else if (p.tests && p.tests.length) {
    const tbName = `tb_${p.tests[0].tb}`;
    const tbPath = path.join(ROOT, 'data', 'tests', p.testDir, `${tbName}.v`);
    if (fs.existsSync(tbPath)) extra.push({ name: `${tbName}.v`, content: fs.readFileSync(tbPath, 'utf8') });
    for (const d of (p.tests[0].data || [])) {
      const f = path.join(ROOT, 'data', 'tests', p.testDir, d);
      if (fs.existsSync(f)) extra.push({ name: d, content: fs.readFileSync(f, 'utf8') });
    }
  }
  // 去重：同名文件只保留一份（学生文件优先）
  const seen = new Set(files.map((f) => f.name));
  const all = [...files, ...extra.filter((e) => !seen.has(e.name) && (seen.add(e.name), true))];
  for (const f of all) fs.writeFileSync(path.join(dir, f.name), f.content, 'utf8');

  const vfiles = all.filter((f) => /\.v$/i.test(f.name)).map((f) => f.name);
  const tops = collectTops(all);
  const topArgs = [];
  for (const t of tops) topArgs.push('-s', t);
  const comp = await runToFile(IVERILOG, ['-g2012', ...topArgs, '-o', 'sim.vvp', ...vfiles], dir, 'compile');
  const result = {
    status: 'fail',
    stage: 'compile',
    compile: { code: comp.code, output: comp.output.replace(dir, '').replace(/\\/g, '/'), ms: comp.ms },
    sim: null,
    tests: [],
    lint: J.lintOnFiles(files, p),
  };
  if (comp.code !== 0 || !fs.existsSync(path.join(dir, 'sim.vvp'))) return result;

  const sim = await runToFile(VVP, ['sim.vvp'], dir, 'sim');
  const out = sim.output.split(dir).join('');
  result.stage = 'sim';
  result.sim = { output: out.slice(0, 60000), ms: sim.ms, code: sim.code };

  // 复用公共量化逻辑
  const { quantifyText } = require('./quant');
  result.tests = quantifyText(out, true);
  // TB 题：分析
  if (p.type === 'tb') {
    const H = require(path.join(ROOT, 'data', 'tbjudge.js'));
    const checks = H.analyze(p.tb, out, dir);
    const fail = checks.filter((c) => c.res === 'F').length;
    result.tests = [{ name: 'Testbench 行为检查', passed: fail === 0, total: checks.length, pass: checks.length - fail, fail, maybe: 0, checks }];
    result.status = fail === 0 && /\$finish called/.test(out) ? 'pass' : 'fail';
  } else {
    const fail = result.tests.reduce((a, t) => a + (t.fail || 0), 0);
    result.status = sim.code === 0 && result.tests.length > 0 && fail === 0 ? 'pass' : 'fail';
  }
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  return result;
}

if (require.main === module) {
  (async () => {
    const argv = process.argv.slice(2);
    // 服务端调用：node cli.js --json <请求文件>，结果写到同目录同名 .out.json
    if (argv[0] === '--json') {
      const inp = argv[1];
      const payload = JSON.parse(fs.readFileSync(inp, 'utf8'));
      const r = await judgeFiles(payload.problemId, payload.files);
      r.lint = J.lintOnFiles(payload.files, J.findProblem(payload.problemId));
      process.stdout.write(JSON.stringify(r));
      process.exit(0);
      return;
    }
    const [pid, file] = argv;
    if (!pid || !file) { console.log('用法: node cli.js <problemId> <源文件>'); process.exit(2); }
    const content = fs.readFileSync(file, 'utf8');
    const p = J.findProblem(pid);
    const files = p.files.map((f, i) => ({ name: f.name, content: i === 0 ? content : f.content }));
    const r = await judgeFiles(pid, files);
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.status === 'pass' ? 0 : 1);
  })();
}

module.exports = { judgeFiles, runToFile };