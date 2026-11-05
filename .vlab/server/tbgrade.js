'use strict';
/**
 * Testbench 题评分（服务端与 CLI 共用）
 * 学生写的 TB 与“参考 TB + 真实 DUT”放进同一个逻辑库：
 *   - 学生 TB（模块名不变）负责把向量打到 DUT 上
 *   - 参考 TB（模块名加前缀）负责把命中的结果打印出来
 * 运行时用 `vvp lib.vvp -s <顶层>` 选择要跑的那份快照。
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'runs', '_tbgrade', 'pkg');
const ICARUS = path.join(ROOT, 'tools', 'icarus');
const { runToFile } = require('./proc');

function J() { return require('./judge'); }

const DEFS = {
  tb_add8: {
    probId: 'c09_p01', dir: 'pkg_add8', refTop: 'vlab_tb_add8', stuTop: 'tb_add8',
    ref: path.join(ROOT, 'data', 'tests', 'ch09', 'grade_tb_add8.v'),
    impl: 'module add8 (input wire [7:0] a, input wire [7:0] b, output wire [7:0] sum, output wire cout);\n  assign {cout, sum} = a + b;\nendmodule\n',
    w: 'module vlab_add8_w (input wire [7:0] a, input wire [7:0] b, output wire [7:0] sum, output wire cout);\n  assign {cout, sum} = a + b;\nendmodule\n',
    dut: 'add8', wrapper: 'vlab_add8_w',
    expect: [
      ['第 1 组 a=0   b=0', 'sum=0 cout=0'],
      ['第 2 组 a=1   b=1', 'sum=2 cout=0'],
      ['第 3 组 a=255 b=1', 'sum=0 cout=1'],
      ['第 4 组 a=128 b=127', 'sum=255 cout=0'],
      ['第 5 组 a=7   b=9', 'sum=16 cout=0'],
    ],
  },
  tb_popcount: {
    probId: 'c09_p02', dir: 'pkg_popcount', refTop: 'vlab_tb_popcount', stuTop: 'tb_popcount',
    ref: path.join(ROOT, 'data', 'tests', 'ch09', 'grade_tb_popcount.v'),
    impl: 'module popcount8 (input wire [7:0] din, output wire [3:0] cnt);\n  integer i; reg [3:0] c;\n  always @(*) begin c = 4\'d0; for (i = 0; i < 8; i = i + 1) if (din[i]) c = c + 1\'b1; end\n  assign cnt = c;\nendmodule\n',
    w: 'module vlab_popcount8_w (input wire [7:0] din, output wire [3:0] cnt);\n  integer i; reg [3:0] c;\n  always @(*) begin c = 4\'d0; for (i = 0; i < 8; i = i + 1) if (din[i]) c = c + 1\'b1; end\n  assign cnt = c;\nendmodule\n',
    dut: 'popcount8', wrapper: 'vlab_popcount8_w',
    vec: path.join(ROOT, 'data', 'tests', 'ch09', 'vectors_tb_popcount.hex'),
    expect: [['din=00', 'cnt=0'], ['din=55', 'cnt=4'], ['din=ff', 'cnt=8'], ['din=a5', 'cnt=4']],
  },
};

async function gradeTb(probId) {
  const d = DEFS[probId];
  if (!d) return null;
  const p = J().findProblem(d.probId);
  const stuFile = p.files.find((f) => /\.v$/.test(f.name));
  const dir = path.join(OUT, d.dir);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  // 学生 TB：DUT 类型换成 wrapper，模块名保留；删掉学生文件里的 DUT 定义（避免重复定义）
  let stu = String(stuFile ? stuFile.content : '').replace(/\r/g, '');
  stu = stu.replace(new RegExp(`\\b${d.dut}\\s+([A-Za-z_]\\w*)\\s*\\(`, 'g'), `${d.wrapper} $1 (`);
  stu = stu.replace(new RegExp(`module\\s+${d.dut}\\b[\\s\\S]*?\\bendmodule`, 'g'), '');

  fs.writeFileSync(path.join(dir, 'ref_tb.v'), fs.readFileSync(d.ref, 'utf8').replace(/\r/g, ''), 'utf8');
  fs.writeFileSync(path.join(dir, 'stu_tb.v'), stu, 'utf8');
  fs.writeFileSync(path.join(dir, 'impl.v'), d.impl, 'utf8');
  fs.writeFileSync(path.join(dir, 'w.v'), d.w, 'utf8');
  if (d.vec) fs.writeFileSync(path.join(dir, 'vectors.hex'), fs.readFileSync(d.vec, 'utf8'), 'utf8');

  const lint = J().lintOnFiles([{ name: stuFile.name, content: stu }], p);
  const comp = await runToFile(path.join(ICARUS, 'iverilogx.exe'), ['-g2012', '-o', 'lib.vvp', 'ref_tb.v', 'stu_tb.v', 'impl.v', 'w.v'], dir, 'compile');
  const checks = [];
  if (comp.code !== 0) {
    checks.push({ res: 'F', value: '编译不通过：' + (comp.output.split('\n').filter((l) => /error/i.test(l))[0] || '').trim() });
    return {
      status: 'fail', stage: 'compile', compile: { code: comp.code, output: comp.output }, sim: null,
      tests: [{ name: 'Testbench 检查', passed: false, total: 1, pass: 0, fail: 1, maybe: 0, checks }],
      lint, failCount: 1, maybe: 0,
    };
  }

  const r1 = await runToFile(path.join(ICARUS, 'vvpx.exe'), ['lib.vvp', '-s', d.stuTop], dir, 'stu');
  const r2 = await runToFile(path.join(ICARUS, 'vvpx.exe'), ['lib.vvp', '-s', d.refTop], dir, 'ref');

  if (r1.code === 0 && /\$finish called/.test(r1.output)) checks.push({ res: 'P', value: '你的 Testbench 正常结束（$finish）' });
  else checks.push({ res: 'F', value: '你的 Testbench 没有正常结束：缺少 $finish 或仿真卡住了' });

  for (const [label, want] of d.expect) {
    const line = r2.output.split('\n').find((l) => l.includes(label));
    if (line && line.includes(want)) checks.push({ res: 'P', value: `DUT 收到了 ${label} → ${want}` });
    else checks.push({ res: 'F', value: `DUT 没有收到 ${label}（或收到错误的值）。参考检查：${line ? line.trim() : '该组从未出现'}` });
  }

  const printed = r1.output.split('\n').filter((l) => l.trim() && !l.startsWith('['));
  if (printed.length >= 1) checks.push({ res: 'P', value: `你的 TB 产生了 ${printed.length} 行输出` });
  else checks.push({ res: 'M', value: '你的 TB 没有任何输出（建议用 $display/$monitor 打印观察结果）' });

  const fail = checks.filter((c) => c.res === 'F').length;
  const maybe = checks.filter((c) => c.res === 'M').length;
  return {
    status: fail === 0 ? 'pass' : 'fail',
    stage: 'sim',
    compile: { code: 0, output: comp.output },
    sim: { output: ('--- 你的 TB ---\n' + r1.output + '\n--- 参考 TB 在 DUT 上观察到的 ---\n' + r2.output).slice(0, 60000), ms: (r1.ms || 0) + (r2.ms || 0), code: r1.code },
    tests: [{ name: 'Testbench 检查', passed: fail === 0, total: checks.length, pass: checks.length - fail - maybe, fail, maybe, checks }],
    lint, failCount: fail, maybe,
  };
}

module.exports = { gradeTb, DEFS };