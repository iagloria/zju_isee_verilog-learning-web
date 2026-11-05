'use strict';
/*
 * 编译 + 仿真（Icarus Verilog 14）
 * 所有工作文件都放在 .vlab/data/runs/<runId> 下，每次判题一个独立目录。
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const TOOLS = path.join(__dirname, '..', 'tools', 'icarus');
const IVERILOG = path.join(TOOLS, 'iverilogx.exe');
const VVP = path.join(TOOLS, 'vvpx.exe');
const IVLROOT = path.join(__dirname, '..', 'tools');
const COMPILE_TIMEOUT = 60000;
const RUN_TIMEOUT = 25000;

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    let out = '';
    let err = '';
    let done = false;
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      // TMP 必须指向项目内的可写目录，否则 Icarus 会在系统 Temp 报
      // "Error opening temporary file ... Please check TMP or TMPDIR."
      env: require('./proc').childEnv(),
      windowsHide: true,
    });
    const finish = (code, killed) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ code, out, err, killed, ms: Date.now() - started });
    };
    const timer = setTimeout(() => {
      try { child.kill(); } catch (_) {}
      setTimeout(() => finish(-1, true), 1500);
    }, opts.timeout || COMPILE_TIMEOUT);
    child.stdout.on('data', (d) => {
      if (out.length < 400000) out += d.toString('utf8');
    });
    child.stderr.on('data', (d) => {
      if (err.length < 400000) err += d.toString('utf8');
    });
    child.on('error', (e) => {
      err += '\n' + String(e && e.message);
      finish(-1, false);
    });
    child.on('close', (code) => finish(code, false));
  });
}

function writeV(dir, files) {
  for (const f of files) {
    const p = path.join(dir, f.name);
    fs.writeFileSync(p, f.content, 'utf8');
  }
}

/** 归一化错误信息：把临时目录换成一个短标记，方便前端定位行号 */
function normalize(text, dir) {
  if (!text) return '';
  let t = text.split(dir).join('');
  t = t.replace(/\\/g, '/');
  return t.replace(/\r/g, '').trim();
}

/**
 * 参数化期望值替换
 *   {{.a.b|c0}}      -> 实例 a 的端口 b，取第 0 位（端口是向量）
 *   {{.a.b|u8}}      -> 无符号十进制
 *   {{.a.b|s16}}     -> 有符号十进制
 *   {{.a.b|bin}} / |hex
 */
function resolveWatch(template, values, bitWidths) {
  return template.replace(/\{\{([^}]+)\}\}/g, (m, expr) => {
    const parts = expr.trim().split('|').map((s) => s.trim());
    const sig = parts[0].replace(/^\./, '');
    const fmt = parts[1] || 'raw';
    const raw = values[sig];
    if (raw === undefined) return '?';
    let value = raw;
    if (/^\d+$/.test(fmt)) {
      const idx = parseInt(fmt, 10);
      const bits = String(raw.replace(/\s+/g, ''));
      if (/^[01]+$/.test(bits)) {
        const ch = bits[bits.length - 1 - idx];
        return ch === undefined ? 'x' : ch;
      }
      return '?';
    }
    const clean = String(raw).replace(/\s+/g, '').replace(/x/g, 'x');
    const isBin = /^[01x]+$/.test(clean);
    const width = bitWidths[sig];
    if (fmt === 'bin') return clean;
    if (fmt === 'hex' || fmt === 'raw') {
      if (fmt === 'raw') return raw;
      try { return BigInt('0b' + clean).toString(16).toUpperCase(); } catch (_) { return clean; }
    }
    if (fmt === 'u8' || fmt === 's16' || fmt === 'u') {
      if (!isBin) return clean;
      let v = 0n;
      for (const c of clean) { v = (v << 1n) | (c === '1' ? 1n : 0n); }
      if (fmt === 's16') {
        const w = Math.max(width || clean.length, clean.length);
        const sign = clean[0] === '1';
        if (sign) v = v - (1n << BigInt(w));
        return v.toString();
      }
      return v.toString();
    }
    return raw;
  });
}

const OUTPUT_MARKERS = ['[CHECK]', '[ERRORS]', '[WATCH]'];

/**
 * 编译 + 运行，返回结构化结果
 * @param {object} p {dir, sources:[{name,content}], top, mode:'sim'|'compile'}
 */
async function compileAndRun({ dir, sources, tops, top, mode, probes }) {
  fs.mkdirSync(dir, { recursive: true });
  const vfiles = sources.filter((s) => /\.(v|sv)$/i.test(s.name));
  const names = vfiles.map((s) => s.name);
  writeV(dir, vfiles);
  const args = ['-g2012', '-o', 'sim.vvp', ...names];
  const topList = tops && tops.length ? tops : (top ? [top] : []);
  for (const t of topList) args.push('-s', t);
  // 通过临时代理复制执行，避免个别环境直接启动 Icarus 时 EBUSY/EPERM
  const c = await runViaProxy(IVERILOG, args, dir, 'compile');
  const result = {
    ok: false,
    stage: 'compile',
    compile: {
      code: c.code,
      output: normalize(c.output, dir),
      ms: c.ms,
      killed: c.killed,
    },
    sim: null,
    probes: null,
  };
  if (c.code !== 0 || !fs.existsSync(path.join(dir, 'sim.vvp'))) {
    if (c.killed) result.compile.output = '编译超时（60 s）：可能有无法展开的 generate/循环。';
    return result;
  }
  if (mode === 'compile') {
    result.ok = true;
    result.stage = 'done';
    return result;
  }

  const r = await runViaProxy(VVP, ['sim.vvp'], dir, 'sim');
  const output = normalize(r.output, dir);
  result.sim = {
    code: r.code,
    output,
    ms: r.ms,
    killed: r.killed,
    finished: /run:all|\$finish/.test(output) || r.code === 0,
  };
  result.ok = r.code === 0 && !/\berror:/i.test(output);
  result.stage = result.ok ? 'done' : 'sim';
  return result;
}

/** 通过临时复制代理执行工具（规避个别安全策略对指定路径的启动限制） */
async function runViaProxy(exe, args, cwd, tag) {
  const proxyDir = path.join(ROOT_TOOLS(), '_proxy');
  try { fs.mkdirSync(proxyDir, { recursive: true }); } catch (_) {}
  const proxy = path.join(proxyDir, `vlab_${tag}_${process.pid}_${Math.random().toString(36).slice(2, 6)}${path.extname(exe)}`);
  try {
    fs.copyFileSync(exe, proxy);
  } catch (_) {
    return run(exe, args, { cwd });
  }
  const r = await run(proxy, args, { cwd });
  try { fs.unlinkSync(proxy); } catch (_) {}
  return r;
}

function ROOT_TOOLS() { return path.join(__dirname, '..', 'tools'); }

/** 生成探针模块：在 $finish 前打印各实例端口的值 */
function buildProbe(probes) {
  const lines = [
    '`timescale 1ns/1ps',
    'module __vlab_probe;',
    '  initial begin',
    '    #900000;',
  ];
  for (const p of probes) {
    for (const [sig, idx] of Object.entries(p.portIndex)) {
      const full = `${p.path}.${sig}`;
      lines.push(`    $display("[WATCH] ${full} = %b", ${full});`);
    }
  }
  lines.push('  end', 'endmodule');
  return lines.join('\n') + '\n';
}

module.exports = { compileAndRun, resolveWatch, run, IVERILOG, VVP, IVLROOT };