'use strict';
/** 停止服务：从 last_port.txt / 7826 起依次尝试，关掉本项目所有实例 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const PREFERRED = Number(process.env.VLAB_PORT || 7826);
const say = (s) => console.log('  ' + s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function req(port, method, p, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    let q;
    try {
      q = http.request({ host: '127.0.0.1', port, path: p, method, timeout: timeoutMs || 1500 }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (_) {}
          done({ ok: true, status: res.statusCode, json });
        });
      });
    } catch (e) { return done({ ok: false }); }
    q.on('error', () => done({ ok: false }));
    q.on('timeout', () => { try { q.destroy(); } catch (_) {} done({ ok: false }); });
    q.end();
  });
}

function candidatePorts() {
  const ports = new Set();
  ports.add(PREFERRED);
  try {
    const p = Number(fs.readFileSync(path.join(DATA, 'last_port.txt'), 'utf8').trim());
    if (Number.isFinite(p) && p > 0) ports.add(p);
  } catch (_) {}
  for (let i = 1; i <= 20; i++) ports.add(PREFERRED + i);
  return [...ports];
}

(async () => {
  console.log('');
  let stopped = 0;
  let failed = 0;
  for (const port of candidatePorts()) {
    const d = await req(port, 'GET', '/api/doctor', 700);
    if (!d.ok || !d.json || !d.json.iverilog) continue;
    say('发现服务（端口 ' + port + '，PID ' + (d.json.pid || '?') + '），正在停止……');
    await req(port, 'POST', '/api/shutdown', 2500);
    let gone = false;
    for (let i = 0; i < 25; i++) {
      await sleep(200);
      const now = await req(port, 'GET', '/api/doctor', 600);
      if (!now.ok) { gone = true; break; }
    }
    if (!gone) {
      // 兜底：按 PID 结束（旧版本没有 pid 字段，只能提示手动）
      const pid = d.json.pid;
      if (pid) {
        try { process.kill(pid); } catch (_) {}
        for (let i = 0; i < 10; i++) {
          await sleep(200);
          if (!(await req(port, 'GET', '/api/doctor', 600)).ok) { gone = true; break; }
        }
      }
    }
    if (gone) { say('  端口 ' + port + ' 已关闭。'); stopped++; }
    else {
      failed++;
      say('  端口 ' + port + ' 上的服务不响应停止请求（旧版本）。');
      say('  请双击一次「停止训练.bat」后重启，或在任务管理器里结束 node.exe。');
    }
  }

  try { fs.unlinkSync(path.join(DATA, 'last_port.txt')); } catch (_) {}

  if (!stopped && !failed) say('服务本来就没有在运行，无需停止。');
  else if (stopped && stopped > 1) say('共停止了 ' + stopped + ' 个实例。');
  else if (stopped) say('已停止。');
  if (failed && !stopped) say('未能停止旧版本服务（不响应停止请求）。');
  console.log('');
  await sleep(200);
  process.exit(failed && !stopped ? 1 : 0);
})();