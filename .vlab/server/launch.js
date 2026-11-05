'use strict';
/**
 * 启动器（由 launch.bat 调用）
 *
 * 行为：
 *   1) 7826 已有「新版」服务在跑 -> 直接打开浏览器
 *   2) 7826 有「旧版/别的程序」占着 -> 自动改用下一个空闲端口，绝不失败
 *   3) 都没占 -> 启动服务并等待就绪
 *   4) 失败时打印真实原因，窗口不会一闪而过
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const { spawn, exec } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const LOGDIR = path.join(DATA, 'logs');
const PREFERRED = Number(process.env.VLAB_PORT || 7826);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 等待按键；最多等 ms 毫秒（没有 stdin 时也不会永久挂起） */
function waitKey(ms) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try { process.stdin.pause(); } catch (_) {}
      resolve();
    };
    const timer = setTimeout(finish, ms);
    try {
      process.stdin.resume();
      process.stdin.once('data', () => { clearTimeout(timer); finish(); });
    } catch (_) { clearTimeout(timer); finish(); }
  });
}

function openBrowser(url) {
  try {
    const c = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], { detached: true, stdio: 'ignore', windowsHide: true });
    c.on('error', () => { try { exec('start "" "' + url + '"', () => {}); } catch (_) {} });
    c.unref();
  } catch (_) {
    try { exec('start "" "' + url + '"', () => {}); } catch (_) {}
  }
}

/** 探测某个端口上的本项目服务（能识别旧版本） */
function probeDoctor(port, timeoutMs) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/api/doctor', timeout: timeoutMs || 1200 }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (_) {}
        resolve({ occupied: true, isOurs: !!(json && json.iverilog), json });
      });
    });
    req.on('error', () => resolve({ occupied: false }));
    req.on('timeout', () => { try { req.destroy(); } catch (_) {} resolve({ occupied: false }); });
  });
}

/** 端口是否被任意程序占用 */
function portBusy(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', (e) => resolve(e.code === 'EADDRINUSE'));
    s.once('listening', () => s.close(() => resolve(false)));
    s.listen(port, '127.0.0.1');
  });
}

(async () => {
  let port = PREFERRED;

  // ---- 1) 已有本项目服务？ ----
  const d0 = await probeDoctor(PREFERRED, 1000);
  if (d0.occupied && d0.isOurs) {
    const hasNew = !!(d0.json && d0.json.features && d0.json.features.includes('shutdown'));
    if (hasNew) {
      const url = 'http://127.0.0.1:' + PREFERRED + '/';
      console.log('');
      console.log('  服务已经在运行：' + url);
      console.log('  正在为你打开浏览器…');
      openBrowser(url);
      await sleep(600);
      process.exit(0);
    }
    // 是旧版本：不复用，另找端口启动新版本
    console.log('');
    console.log('  端口 ' + PREFERRED + ' 上有一个旧版本的服务，将使用新端口启动。');
    console.log('  （双击「停止训练.bat」可以关掉旧的那个）');
  }

  // ---- 2) 找空闲端口 ----
  if (await portBusy(port)) {
    let found = 0;
    for (let p = port + 1; p <= port + 30; p++) {
      if (!(await portBusy(p))) { found = p; break; }
    }
    if (!found) {
      console.error('  附近没有空闲端口，请重启电脑后再试。');
      await sleep(4000);
      process.exit(1);
    }
    port = found;
    if (!d0.occupied) console.log('\n  端口 ' + PREFERRED + ' 被占用，已改用 ' + port + '。');
    else console.log('  已改用端口 ' + port + '。');
  }
  console.log('');

  // ---- 3) 工具链自检（第三方编译器不在仓库里，需要先下载）----
  const icarusDir = path.join(ROOT, 'tools', 'icarus');
  const hasIverilog = fs.existsSync(path.join(icarusDir, 'iverilogx.exe'))
    && fs.existsSync(path.join(icarusDir, 'vvpx.exe'));
  if (!hasIverilog) {
    console.log('  ==========================================');
    console.log('    Verilog 闯关训练  ·  Verilog Practice Lab');
    console.log('  ==========================================');
    console.log('');
    console.log('  ⚠ 缺少编译器（Icarus Verilog）');
    console.log('');
    console.log('  判题需要 Icarus Verilog，它属于第三方工具，');
    console.log('  不在仓库里。请先运行一次：');
    console.log('');
    console.log('      .vlab\\tools\\fetch-tools.bat');
    console.log('');
    console.log('  （双击即可，会自动下载安装，约 30 MB）');
    console.log('');
    console.log('  装好后再双击「启动训练.bat」即可。');
    console.log('');
    console.log('  按任意键关闭这个窗口……');
    await waitKey(8000);
    process.exit(1);
  }

  // ---- 4) 启动服务 ----
  console.log('');
  console.log('  ==========================================');
  console.log('    Verilog 闯关训练  ·  Verilog Practice Lab');
  console.log('  ==========================================');
  console.log('');
  console.log('  正在启动本地服务……');
  console.log('');

  // 临时目录自检（Icarus 需要可写的 TMP）
  const tmpDir = path.join(DATA, 'tmp');
  let tmpOk = false;
  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    const probeFile = path.join(tmpDir, '.probe');
    fs.writeFileSync(probeFile, 'ok');
    fs.unlinkSync(probeFile);
    tmpOk = true;
  } catch (_) { tmpOk = false; }
  if (!tmpOk) {
    console.log('  ⚠ 无法写入临时目录：' + tmpDir);
    console.log('    判题可能失败，请检查磁盘空间与文件夹权限。');
    console.log('');
  }

  try { fs.mkdirSync(LOGDIR, { recursive: true }); } catch (_) {}
  const outFile = path.join(LOGDIR, 'server.log');
  const errFile = path.join(LOGDIR, 'server.err.log');
  let fdOut, fdErr;
  try {
    fdOut = fs.openSync(outFile, 'w');
    fdErr = fs.openSync(errFile, 'w');
  } catch (e) {
    console.error('  无法创建日志文件：' + e.message);
    process.exit(1);
  }

  let child;
  try {
    child = spawn(process.execPath, [path.join(__dirname, 'app.js')], {
      cwd: ROOT,
      detached: true,
      stdio: ['ignore', fdOut, fdErr],
      windowsHide: true,
      env: { ...process.env, VLAB_PORT: String(port) },
    });
  } catch (e) {
    console.error('  启动服务失败：' + (e.code || e.message));
    process.exit(1);
  }
  child.on('error', (e) => console.error('  启动服务失败：' + (e.code || e.message)));
  child.unref();

  // ---- 4) 等待就绪 ----
  let ready = false;
  for (let i = 0; i < 60; i++) {
    await sleep(250);
    const d = await probeDoctor(port, 700);
    if (d.occupied && d.isOurs) { ready = true; break; }
  }

  const url = 'http://127.0.0.1:' + port + '/';

  if (ready) {
    try { fs.writeFileSync(path.join(DATA, 'last_port.txt'), String(port), 'utf8'); } catch (_) {}
    console.log('  ✔ 启动成功！');
    console.log('');
    console.log('  地址：' + url);
    console.log('');
    console.log('  正在为你打开浏览器…');
    console.log('');
    console.log('  ─────────────────────────────────────────');
    console.log('   · 这个窗口可以直接关掉，服务在后台继续运行');
    console.log('   · 要停止服务：双击「停止训练.bat」');
    console.log('  ─────────────────────────────────────────');
    console.log('');
    openBrowser(url);
    await sleep(1500);
    process.exit(0);
  }

  // ---- 5) 失败诊断 ----
  console.error('');
  console.error('  ✘ 启动失败，下面是服务输出的错误信息：');
  console.error('  ─────────────────────────────────────────');
  let txt = '';
  try { txt = fs.readFileSync(errFile, 'utf8'); } catch (_) {}
  if (!txt.trim()) { try { txt = fs.readFileSync(outFile, 'utf8'); } catch (_) {} }
  console.error(txt.trim() ? txt.trim().split('\n').slice(0, 15).join('\n') : '  （没有任何输出）');
  console.error('  ─────────────────────────────────────────');
  console.error('  日志：' + outFile);
  console.error('        ' + errFile);
  console.log('');
  console.log('  按任意键关闭这个窗口……');
  await waitKey(10000);
  process.exit(1);
})();