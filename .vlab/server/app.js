'use strict';
/*
 * Verilog 闯关训练 —— 本地 HTTP 服务（只监听 127.0.0.1）
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const { build: buildCache } = require('./prebuild');
const judgeMod = require('./judge');
const { IVERILOG, VVP, IVLROOT } = require('./sim');

const ROOT = path.join(__dirname, '..');
const WEB = path.join(ROOT, 'web');
const PORT = Number(process.env.VLAB_PORT || 7826);
const BUILD_STAMP = 'v2-' + new Date().toISOString();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

/** 打开资源管理器 / 浏览器；失败也不影响服务 */
function openSafe(target) {
  try {
    const child = exec(target, () => {});
    if (child && child.on) child.on('error', () => {});
  } catch (e) {
    console.warn('无法打开：' + target);
  }
}

/** 用系统默认浏览器打开网页（不经过 cmd，避免中文/引号问题） */
function openBrowser(url) {
  try {
    const child = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], { detached: true, stdio: 'ignore', windowsHide: true });
    child.on('error', () => {
      try { exec('start "" "' + url + '"', () => {}); } catch (_) {}
    });
    child.unref();
  } catch (e) {
    try { exec('start "" "' + url + '"', () => {}); } catch (_) {}
  }
}

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 8 * 1024 * 1024) { reject(new Error('body too large')); req.destroy(); }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function safeJoin(base, p) {
  const full = path.normalize(path.join(base, p));
  if (!full.startsWith(path.normalize(base))) return null;
  return full;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const p = decodeURIComponent(url.pathname);
  try {
    if (p === '/api/meta') {
      const chapters = judgeMod.loadChapters().map((c) => ({
        chapter: c.chapter, title: c.title, tag: c.tag, group: c.group || '教材',
        problems: c.problems.map((x) => ({
          id: x.id, title: x.title, type: x.type, difficulty: x.difficulty, tags: x.tags || [], brief: x.brief || '',
        })),
      }));
      return send(res, 200, JSON.stringify({ chapters, progress: judgeMod.loadProgress() }));
    }
    if (p.startsWith('/api/problem/')) {
      const id = p.slice('/api/problem/'.length);
      const prob = judgeMod.findProblem(id);
      if (!prob) return send(res, 404, JSON.stringify({ message: 'no such problem' }));
      return send(res, 200, JSON.stringify(judgeMod.publicProblem(prob)));
    }
    if (p === '/api/solution' && req.method === 'POST') {
      const body = await readBody(req);
      const prob = judgeMod.findProblem(body.id);
      return send(res, 200, JSON.stringify({ code: judgeMod.getSolution(prob, body.variant) }));
    }
    if (p === '/api/exam' && req.method === 'POST') {
      const body = await readBody(req);
      const exam = require('./exam');
      const html = exam.renderExam(body.ids || [], body.title || '硬件描述语言 · 手写模拟卷');
      return send(res, 200, html, 'text/html; charset=utf-8');
    }
    if (p === '/api/exam/docx' && req.method === 'POST') {
      const body = await readBody(req);
      const { makeExam } = require('./docxmaker');
      return makeExam(body.ids || [], body.title, (err, file) => {
        if (err) return send(res, 500, JSON.stringify({ message: err.message }));
        const buf = fs.readFileSync(file);
        res.writeHead(200, {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': 'attachment; filename="verilog_handwriting_exam.docx"',
        });
        res.end(buf);
      });
    }
    if (p === '/api/exam/docx-save' && req.method === 'POST') {
      const body = await readBody(req);
      const { makeExam, makeAnswers } = require('./docxmaker');
      return makeExam(body.ids || [], body.title, (err, file) => {
        if (err) return send(res, 500, JSON.stringify({ message: err.message }));
        makeAnswers(null, (err2, file2) => {
          // 在资源管理器里定位文件（失败不影响返回结果）
          openSafe('explorer.exe /select,"' + file + '"');
          return send(res, 200, JSON.stringify({ ok: true, file, answers: err2 ? null : file2 }));
        });
      });
    }
    if (p === '/api/shutdown' && (req.method === 'POST' || req.method === 'GET')) {
      send(res, 200, JSON.stringify({ ok: true, message: 'shutting down', pid: process.pid }));
      try { fs.unlinkSync(path.join(ROOT, 'data', 'server.pid')); } catch (_) {}
      console.log('');
      console.log('  收到停止请求，服务即将退出。');
      setTimeout(() => { try { server.close(); } catch (_) {} process.exit(0); }, 150);
      return;
    }
    if (p === '/api/judge' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body || !body.problemId) return send(res, 400, JSON.stringify({ message: 'missing problemId' }));
      const t0 = Date.now();
      const result = await judgeMod.judge(body);
      result.totalMs = Date.now() - t0;
      return send(res, 200, JSON.stringify(result));
    }
    if (p === '/api/explain' && req.method === 'POST') {
      // 只跑 lint，不跑仿真（秒回）
      const body = await readBody(req);
      const prob = judgeMod.findProblem(body.id);
      if (!prob) return send(res, 404, JSON.stringify({ message: 'no such problem' }));
      const { lintOnFiles } = judgeMod;
      return send(res, 200, JSON.stringify({ lint: lintOnFiles(body.files || [], prob) }));
    }
    if (p === '/api/progress' && req.method === 'POST') {
      const body = await readBody(req);
      judgeMod.saveProgress(body);
      return send(res, 200, JSON.stringify({ ok: true }));
    }
    if (p === '/api/progress' && req.method === 'GET') return send(res, 200, JSON.stringify(judgeMod.loadProgress()));
    if (p === '/api/answer' && req.method === 'POST') {
      const body = await readBody(req);
      return send(res, 200, JSON.stringify(judgeMod.saveAnswer(body.id, body.name || '', body.code || '')));
    }
    if (p === '/api/reload' && req.method === 'POST') {
      judgeMod.reload();
      return send(res, 200, JSON.stringify({ ok: true }));
    }
    if (p === '/api/open' && req.method === 'POST') {
      const body = await readBody(req).catch(() => ({}));
      const dir = body && body.what === 'runs'
        ? path.join(ROOT, 'data', 'runs')
        : path.join(ROOT, 'data', 'answers');
      fs.mkdirSync(dir, { recursive: true });
      openSafe('explorer.exe "' + dir + '"');
      return send(res, 200, JSON.stringify({ ok: true, dir }));
    }
    if (p === '/api/doctor') {
      let ok = false;
      try { ok = fs.existsSync(IVERILOG) && fs.existsSync(VVP); } catch (_) {}
      return send(res, 200, JSON.stringify({
        ok, iverilog: IVERILOG, vvp: VVP, ivlroot: IVLROOT,
        node: process.version, port: PORT,
        pid: process.pid, build: BUILD_STAMP,
        features: ['judge', 'wave', 'exam', 'shutdown'],
      }));
    }

    // 静态
    const file = p === '/' ? '/index.html' : p;
    const full = safeJoin(WEB, file);
    if (!full) return send(res, 403, 'forbidden', 'text/plain');
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      const ext = path.extname(full).toLowerCase();
      return send(res, 200, fs.readFileSync(full), MIME[ext] || 'application/octet-stream');
    }
    return send(res, 404, 'not found', 'text/plain; charset=utf-8');
  } catch (e) {
    console.error(e);
    return send(res, 500, JSON.stringify({ message: String((e && e.message) || e) }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}/`;
  // 记录 PID，便于「停止训练.bat」兜底强制结束
  try {
    fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'data', 'server.pid'), String(process.pid), 'utf8');
  } catch (_) {}
  console.log('');
  console.log('  Verilog 闯关训练已启动');
  console.log('  地址：' + url);
  console.log('  停止服务：双击「停止训练.bat」，或直接关掉这个窗口。');
  console.log('');
  if (process.argv.includes('--open')) openBrowser(url);
  // 后台预热：预编译各题测试台快照（失败也不影响使用）
  buildCache().then((r) => {
    if (r && r.ok) console.log('  [预编译] 测试台快照就绪：' + r.items.length + ' 个' + (r.cached ? '（使用缓存）' : ''));
  }).catch(() => {});
});
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`端口 ${PORT} 已被占用（可能已经在运行），直接打开 http://127.0.0.1:${PORT}/ 即可。`);
    openBrowser('http://127.0.0.1:' + PORT + '/');
  } else {
    console.error(e);
  }
  setTimeout(() => process.exit(0), 1500);
});