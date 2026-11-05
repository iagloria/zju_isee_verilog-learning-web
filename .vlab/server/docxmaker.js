'use strict';
/* 生成两份 Word：手写模拟卷 + 参考答案册 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
const J = require('./judge');

function findPython() {
  const cands = [process.env.VLAB_PYTHON, 'D:\\Python\\python.exe',
    'C:\\Users\\lenovo\\.dsh\\dsh-runtimes\\dsh-primary-runtime\\dependencies\\python\\python.exe'];
  for (const c of cands) { try { if (c && fs.existsSync(c)) return c; } catch (_) {} }
  return 'python';
}

function runPy(script, dataFile, outFile, cb) {
  const logFile = outFile + '.log';
  const fd = fs.openSync(logFile, 'w');
  const child = spawn(findPython(), [script, dataFile, outFile], { stdio: ['ignore', fd, fd], windowsHide: true });
  let settled = false;
  const done = (err, file) => { if (settled) return; settled = true; cb(err, file); };
  child.on('error', (e) => { try { fs.closeSync(fd); } catch (_) {} done(new Error('python 启动失败：' + e.code)); });
  child.on('close', (c) => {
    try { fs.closeSync(fd); } catch (_) {}
    if (c !== 0 || !fs.existsSync(outFile)) return done(new Error('生成失败，见 ' + logFile));
    done(null, outFile);
  });
}

/** 手写模拟卷（题目 + 作答框） */
function makeExam(ids, title, cb) {
  const probs = J.allProblems().filter((p) => p.type !== 'quiz' && (!ids || !ids.length || ids.includes(p.id)));
  const outDir = path.join(ROOT, 'data', 'exams');
  fs.mkdirSync(outDir, { recursive: true });
  const dataFile = path.join(outDir, 'exam_data.json');
  fs.writeFileSync(dataFile, JSON.stringify({
    title: title || '硬件描述语言 · 手写模拟卷',
    problems: probs.map((p) => ({ title: p.title, tag: p.tag, type: p.type, difficulty: p.difficulty, desc: p.desc, files: p.files || [] })),
  }, null, 2), 'utf8');
  runPy(path.join(__dirname, 'make_docx.py'), dataFile, path.join(outDir, 'Verilog手写模拟卷.docx'), cb);
}

/** 参考答案册（题目 + 答案 + 要点） */
function makeAnswers(title, cb) {
  const probs = J.allProblems();
  const outDir = path.join(ROOT, 'data', 'exams');
  fs.mkdirSync(outDir, { recursive: true });
  const dataFile = path.join(outDir, 'answers_data.json');
  fs.writeFileSync(dataFile, JSON.stringify({
    title: title || 'Verilog 参考答案册',
    problems: probs.map((p) => ({
      title: p.title, tag: p.tag, type: p.type, difficulty: p.difficulty,
      chapterTitle: p.chapterTitle + '（' + p.tag + '）',
      desc: p.desc, solution: J.getSolution(p) || null, quiz: p.quiz || null, keyPoints: p.keyPoints || [],
    })),
  }, null, 2), 'utf8');
  runPy(path.join(__dirname, 'make_answers_docx.py'), dataFile, path.join(outDir, 'Verilog参考答案.docx'), cb);
}

module.exports = { makeExam, makeAnswers, findPython };

if (require.main === module) {
  makeExam(null, '硬件描述语言 · 手写模拟卷', (e, f) => {
    if (e) return console.error('exam:', e.message);
    console.log('exam saved:', f, fs.statSync(f).size + 'B');
    makeAnswers(null, (e2, f2) => {
      if (e2) return console.error('answers:', e2.message);
      console.log('answers saved:', f2, fs.statSync(f2).size + 'B');
    });
  });
}