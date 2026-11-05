'use strict';
/*
 * 手写模拟卷生成：
 *   - HTML 版：浏览器里直接打印 / 导出 PDF
 *   - DOCX 版：Word 里打开、批注、打印
 * 题目列表来自题库；不显示答案（答案单独给）。
 */
const fs = require('fs');
const path = require('path');
const J = require('./judge');

const MD = (s) => String(s == null ? '' : s);

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function mdToHtml(md) {
  // 极简 markdown（题目描述里用到的语法：标题/列表/表格/代码块/引用/加粗/行内代码）
  const lines = String(md || '').replace(/\r/g, '').split('\n');
  const out = [];
  let i = 0;
  const inline = (s) => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line.trim())) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) { buf.push(lines[i]); i++; }
      i++;
      out.push('<pre>' + esc(buf.join('\n')) + '</pre>');
      continue;
    }
    if (/^\s*\|/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(lines[i].trim()); i++; }
      let html = '<table>';
      rows.forEach((r, idx) => {
        if (/^\|[\s:|-]+\|$/.test(r)) return;
        const cells = r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        const tag = idx === 0 ? 'th' : 'td';
        html += '<tr>' + cells.map((c) => `<${tag}>${inline(c)}</${tag}>`).join('') + '</tr>';
      });
      out.push(html + '</table>');
      continue;
    }
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
      out.push('<blockquote>' + mdToHtml(buf.join('\n')) + '</blockquote>');
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) { out.push(`<h${h[1].length + 2}>${inline(h[2])}</h${h[1].length + 2}>`); i++; continue; }
    if (/^\s*[-*]\s+/.test(line)) {
      out.push('<ul>');
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { out.push('<li>' + inline(lines[i].replace(/^\s*[-*]\s+/, '')) + '</li>'); i++; }
      out.push('</ul>');
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      out.push('<ol>');
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { out.push('<li>' + inline(lines[i].replace(/^\s*\d+\.\s+/, '')) + '</li>'); i++; }
      out.push('</ol>');
      continue;
    }
    if (!line.trim()) { i++; continue; }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(```|\s*\||\s*>|#{1,3}\s|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i])) { buf.push(lines[i].trim()); i++; }
    out.push('<p>' + inline(buf.join(' ')) + '</p>');
  }
  return out.join('\n');
}

function pick(ids) {
  const all = J.allProblems();
  const list = ids && ids.length ? ids.map((id) => all.find((p) => p.id === id)).filter(Boolean) : all;
  return list.filter((p) => p.type !== 'quiz');
}

function renderExam(ids, title) {
  const probs = pick(ids);
  const body = probs.map((p, idx) => `
  <section class="q">
    <div class="qhead"><span class="no">第 ${idx + 1} 题</span>
      <span class="meta">${esc(p.tag || '')} ｜ ${esc(tagName(p.type))} ｜ 难度 ${'★'.repeat(p.difficulty || 1)}</span>
    </div>
    <h3>${esc(p.title)}</h3>
    <div class="desc">${mdToHtml(p.desc || '')}</div>
    <div class="src">${(p.files || []).map((f) => `<div class="fname">${esc(f.name)}</div><pre class="code">${esc(f.content)}</pre>`).join('')}</div>
    <div class="answerbox"><span>作答区</span></div>
  </section>`).join('\n');

  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  body { font-family: "Microsoft YaHei", "Segoe UI", sans-serif; color: #111; font-size: 11pt; line-height: 1.6; }
  h1 { font-size: 17pt; text-align: center; margin: 0 0 4px; }
  .sub { text-align: center; color: #666; font-size: 9.5pt; margin-bottom: 14px; }
  .q { page-break-inside: avoid; margin-bottom: 18px; border-top: 1px dashed #bbb; padding-top: 10px; }
  .qhead { display: flex; justify-content: space-between; font-size: 9.5pt; color: #555; }
  .no { font-weight: 700; color: #000; }
  .q h3 { font-size: 12pt; margin: 4px 0 6px; }
  .desc { font-size: 10pt; }
  .desc p { margin: 4px 0; }
  .desc ul, .desc ol { margin: 4px 0 4px 18px; padding: 0; }
  .desc table { border-collapse: collapse; margin: 6px 0; font-size: 9.5pt; }
  .desc th, .desc td { border: 1px solid #999; padding: 2px 6px; }
  .desc code { font-family: Consolas, monospace; background: #f2f2f2; padding: 0 3px; }
  .desc pre { font-family: Consolas, monospace; font-size: 9.5pt; background: #f7f7f7; border: 1px solid #ddd; padding: 6px; white-space: pre-wrap; }
  .desc blockquote { border-left: 3px solid #888; margin: 6px 0; padding: 2px 8px; color: #444; font-size: 9.5pt; }
  .src { margin-top: 6px; }
  .fname { font-family: Consolas, monospace; font-size: 9pt; color: #555; }
  .code { font-family: Consolas, monospace; font-size: 9pt; background: #fafafa; border: 1px solid #ddd; padding: 6px; white-space: pre-wrap; margin: 2px 0 6px; }
  .answerbox { border: 1px solid #999; min-height: 150px; margin-top: 8px; position: relative; }
  .answerbox span { position: absolute; top: 2px; left: 6px; font-size: 8.5pt; color: #999; }
  .foot { text-align: center; color: #888; font-size: 9pt; margin-top: 16px; }
</style></head><body>
<h1>${esc(title)}</h1>
<div class="sub">共 ${probs.length} 题 · 建议限时 90 分钟 · 先手写，再用「Verilog 闯关训练」验证</div>
${body}
<div class="foot">—— 卷面结束 ——</div>
</body></html>`;
}

function tagName(t) {
  return { write: '手写代码', bug: '找错改错', fill: '补全代码', tb: '写 Testbench', quiz: '概念选择' }[t] || t;
}

/** 导出 Word（python-docx 在工作区 python 环境里） */
function exportDocx(ids, title) {
  const probs = pick(ids);
  const outDir = path.join(__dirname, '..', 'data', 'exams');
  fs.mkdirSync(outDir, { recursive: true });
  const dataFile = path.join(outDir, 'exam_data.json');
  const docx = path.join(outDir, 'verilog_handwriting_exam.docx');
  fs.writeFileSync(dataFile, JSON.stringify({
    title,
    problems: probs.map((p) => ({
      title: p.title, tag: p.tag, type: tagName(p.type), difficulty: p.difficulty,
      desc: p.desc, files: p.files || [],
    })),
  }, null, 2), 'utf8');
  const py = path.join(__dirname, 'make_docx.py');
  const { spawnSync } = require('child_process');
  const cands = [process.env.VLAB_PYTHON, 'D:\\Python\\python.exe', process.execPath.replace(/node\.exe$/i, '..\\python\\python.exe'),
    'C:\\Users\\lenovo\\.dsh\\dsh-runtimes\\dsh-primary-runtime\\dependencies\\python\\python.exe', 'python'];
  let r = null;
  for (const pyExe of cands) {
    if (!pyExe) continue;
    r = spawnSync(pyExe, [py, dataFile, docx], { encoding: 'utf8', timeout: 120000, windowsHide: true });
    if (r.error && r.error.code === 'ENOENT') continue;
    break;
  }
  if (!r || r.status !== 0 || !fs.existsSync(docx)) {
    const msg = r ? (r.stderr || r.error || '') : '';
    throw new Error('生成 Word 失败：' + String(msg).slice(0, 300));
  }
  return docx;
}

module.exports = { renderExam, exportDocx, mdToHtml, pick };