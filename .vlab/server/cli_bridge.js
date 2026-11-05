'use strict';
/* 桥接：服务端把判题交给命令行子进程完成（子进程输出重定向到文件，不走管道） */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CLI = path.join(__dirname, 'cli.js');
const TMP = path.join(ROOT, 'data', 'runs', '_bridge');

function ensure() { try { fs.mkdirSync(TMP, { recursive: true }); } catch (_) {} }

function runCli(problemId, files, timeoutMs) {
  ensure();
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const inFile = path.join(TMP, `${stamp}.in.json`);
  const outFile = path.join(TMP, `${stamp}.out.json`);
  fs.writeFileSync(inFile, JSON.stringify({ problemId, files }), 'utf8');
  return new Promise((resolve) => {
    const out = fs.openSync(outFile, 'w');
    let child;
    try {
      child = spawn(process.execPath, [CLI, '--json', inFile], {
        cwd: ROOT, stdio: ['ignore', out, out], windowsHide: true,
        env: require('./proc').childEnv(),
      });
    } catch (e) {
      try { fs.closeSync(out); } catch (_) {}
      return resolve({ status: 'error', message: '无法启动判题子进程：' + (e.code || e.message) });
    }
    const timer = setTimeout(() => { try { child.kill(); } catch (_) {} }, timeoutMs || 150000);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { fs.closeSync(out); } catch (_) {}
      let r = null;
      let raw = '';
      try { raw = fs.readFileSync(outFile, 'utf8'); r = JSON.parse(raw); } catch (_) { r = null; }
      try { fs.unlinkSync(inFile); } catch (_) {}
      try { fs.unlinkSync(outFile); } catch (_) {}
      if (!r) {
        // 子进程没有产出合法 JSON：带上它是怎么失败的
        const tail = raw.replace(/\s+/g, ' ').slice(-400);
        return resolve({
          status: 'error',
          childExit: child.exitCode,
          message: '判题子进程没有返回结果：' + (tail || '（无任何输出，可能是进程启动失败）'),
        });
      }
      resolve(r);
    };
    child.on('error', () => { done = false; resolve({ status: 'error', message: '判题子进程启动失败（' + (child.exitCode) + '）' }); });
    child.on('close', finish);
  });
}

module.exports = { runCli };