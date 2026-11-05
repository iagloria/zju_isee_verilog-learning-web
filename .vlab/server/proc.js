'use strict';
/*
 * 子进程执行工具（无外部依赖，避免循环引用）
 *
 * 重要：Icarus 会在 TMP 目录里创建临时文件。如果系统的 TMP/TEMP 不可写
 * （某些机器的用户 Temp 目录权限异常、或磁盘被安全软件锁住），
 * iverilog 会报：
 *     Error opening temporary file ...  Please check TMP or TMPDIR.
 * 所以这里始终把 TMP/TEMP/TMPDIR 指向项目内的可写目录。
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TOOLS = path.join(ROOT, 'tools');
const ICARUS = path.join(TOOLS, 'icarus');
const IVERILOG = path.join(ICARUS, 'iverilogx.exe');
const VVP = path.join(ICARUS, 'vvpx.exe');

// 项目内的临时目录（纯 ASCII 路径更保险，避开中文路径的工具兼容问题）
const TMPDIR = path.join(ROOT, 'data', 'tmp');

function ensureTmpDir() {
  try {
    fs.mkdirSync(TMPDIR, { recursive: true });
    return TMPDIR;
  } catch (_) {
    return null;
  }
}

/** 给子进程用的环境变量：TMP 一律指向项目内目录 */
function childEnv(extra) {
  const tmp = ensureTmpDir();
  const env = { ...process.env, IVERILOG_IVLROOT: TOOLS };
  if (tmp) {
    env.TMP = tmp;
    env.TEMP = tmp;
    env.TMPDIR = tmp;
  }
  return extra ? { ...env, ...extra } : env;
}

/** 清理过期的临时文件（保留最近 5 分钟内的） */
function sweepTmp() {
  const tmp = ensureTmpDir();
  if (!tmp) return;
  try {
    const now = Date.now();
    for (const f of fs.readdirSync(tmp)) {
      const p = path.join(tmp, f);
      try {
        const st = fs.statSync(p);
        if (now - st.mtimeMs > 5 * 60 * 1000) {
          if (st.isDirectory()) fs.rmSync(p, { recursive: true, force: true });
          else fs.unlinkSync(p);
        }
      } catch (_) {}
    }
  } catch (_) {}
}

/** 运行一个命令，stdout/stderr 写到文件（不走管道，规避沙箱限制） */
function runToFile(exe, args, cwd, tag, timeoutMs) {
  return new Promise((resolve) => {
    const outFile = path.join(cwd, `.${tag}.txt`);
    let fd;
    try { fd = fs.openSync(outFile, 'w'); } catch (e) { return resolve({ code: -9, output: String(e), ms: 0 }); }
    const t0 = Date.now();
    let child;
    let done = false;
    const finish = (code) => {
      if (done) return;
      done = true;
      try { fs.closeSync(fd); } catch (_) {}
      let output = '';
      try { output = fs.readFileSync(outFile, 'utf8'); } catch (_) {}
      resolve({ code, output: output.replace(/\r/g, ''), ms: Date.now() - t0 });
    };
    try {
      child = spawn(exe, args, {
        cwd, stdio: ['ignore', fd, fd], windowsHide: true,
        env: childEnv(),
      });
    } catch (e) { return finish(-1); }
    const timer = setTimeout(() => {
      try { child.kill(); } catch (_) {}
      setTimeout(() => finish(-2), 600);
    }, timeoutMs || (tag === 'sim' || tag === 'stu' || tag === 'ref' ? 25000 : 90000));
    child.on('error', () => { clearTimeout(timer); finish(-1); });
    child.on('close', (code) => { clearTimeout(timer); finish(code); });
  });
}

module.exports = { runToFile, ICARUS, IVERILOG, VVP, TOOLS, TMPDIR, childEnv, ensureTmpDir, sweepTmp };

/** 把常见报错翻译成用户能看懂的话 */
function explainError(text) {
  const t = String(text || '');
  if (/Error opening temporary file|check TMP or TMPDIR/i.test(t)) {
    return '编译器无法创建临时文件。通常是系统临时目录（TEMP）不可写。\n'
      + '本项目已改为使用 .vlab\\data\\tmp 作为临时目录，请确认该目录可写；\n'
      + '若仍报错，请检查磁盘空间与杀毒软件拦截。';
  }
  if (/No such file or directory/i.test(t) && /test\.v|\.v'/.test(t)) {
    return '找不到源文件，请确认文件都在题目目录里。';
  }
  if (/Unknown module type/i.test(t)) {
    return '存在没有定义的模块：检查模块名拼写、文件是否都包含进来了。';
  }
  if (/syntax error/i.test(t)) {
    return '语法错误：注意 endmodule/begin-end 是否配对、语句末尾是否缺分号。';
  }
  return '';
}