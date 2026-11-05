/* 轻量 Markdown 渲染（题目描述用，够用就行） */
(function () {
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function inline(s) {
    let t = esc(s);
    t = t.replace(/`([^`]+)`/g, (m, code) => `<code>${code}</code>`);
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(?<![*\w])\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
    return t;
  }
  function render(md) {
    const lines = String(md || '').replace(/\r/g, '').split('\n');
    const out = [];
    let i = 0;
    let inList = null;
    let para = [];
    function flushPara() {
      if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; }
    }
    function closeList() { if (inList) { out.push(`</${inList}>`); inList = null; } }
    while (i < lines.length) {
      const line = lines[i];
      if (/^```/.test(line.trim())) {
        flushPara(); closeList();
        const lang = line.trim().slice(3).trim();
        const buf = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i].trim())) { buf.push(lines[i]); i++; }
        i++;
        out.push(`<pre><code data-lang="${esc(lang)}">${esc(buf.join('\n'))}</code></pre>`);
        continue;
      }
      if (/^\s*\|/.test(line)) {
        flushPara(); closeList();
        const rows = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(lines[i].trim()); i++; }
        let html = '<table>';
        rows.forEach((r, idx) => {
          if (/^\|[\s:|-]+\|$/.test(r)) return;
          const cells = r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
          const tag = idx === 0 ? 'th' : 'td';
          html += '<tr>' + cells.map((c) => `<${tag}>${inline(c)}</${tag}>`).join('') + '</tr>';
        });
        html += '</table>';
        out.push(html);
        continue;
      }
      if (/^\s*>/.test(line)) {
        flushPara(); closeList();
        const buf = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
        out.push('<blockquote>' + render(buf.join('\n')) + '</blockquote>');
        continue;
      }
      const h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) {
        flushPara(); closeList();
        const lv = Math.min(h[1].length + 1, 4);
        out.push(`<h${lv}>${inline(h[2])}</h${lv}>`);
        i++;
        continue;
      }
      if (/^\s*([-*])\s+/.test(line)) {
        flushPara();
        if (inList !== 'ul') { closeList(); out.push('<ul>'); inList = 'ul'; }
        out.push('<li>' + inline(line.replace(/^\s*[-*]\s+/, '')) + '</li>');
        i++;
        continue;
      }
      if (/^\s*\d+\.\s+/.test(line)) {
        flushPara();
        if (inList !== 'ol') { closeList(); out.push('<ol>'); inList = 'ol'; }
        out.push('<li>' + inline(line.replace(/^\s*\d+\.\s+/, '')) + '</li>');
        i++;
        continue;
      }
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
        flushPara(); closeList(); out.push('<hr>'); i++; continue;
      }
      if (!line.trim()) { flushPara(); closeList(); i++; continue; }
      para.push(line.trim());
      i++;
    }
    flushPara(); closeList();
    return out.join('\n');
  }

  // 波形绘制：值序列 -> SVG
  function wave(series, opts) {
    opts = opts || {};
    const rowH = 26, labelW = 120, gap = 6;
    const width = Math.max(420, opts.width || 640);
    const n = Math.max(1, (series[0] && series[0].vals.length) || 1);
    const innerW = width - labelW - 20;
    const step = innerW / n;
    const height = series.length * (rowH + gap) + 18;
    let svg = `<svg class="wave-canvas" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<rect width="${width}" height="${height}" fill="#12161c"/>`;
    series.forEach((s, r) => {
      const y0 = 12 + r * (rowH + gap);
      const yTop = y0 + 3, yBot = y0 + rowH - 3, yMid = (yTop + yBot) / 2;
      svg += `<text x="8" y="${yMid + 4}" fill="#38bdf8" font-size="11" font-family="Consolas,monospace">${esc(s.name)}</text>`;
      let d = '';
      s.vals.forEach((v, idx) => {
        const x0 = labelW + idx * step;
        const x1 = x0 + step;
        let y;
        if (v === '1' || v === 1 || v === true) y = yTop;
        else if (v === '0' || v === 0 || v === false) y = yBot;
        else y = yMid;
        if (idx === 0) d += `M${x0},${y}`;
        const prev = idx > 0 ? s.vals[idx - 1] : null;
        let prevY = null;
        if (idx > 0) {
          if (prev === '1' || prev === 1) prevY = yTop;
          else if (prev === '0' || prev === 0) prevY = yBot;
          else prevY = yMid;
        }
        if (prevY !== null && prevY !== y) d += ` L${x0},${prevY} L${x0},${y}`;
        else d += ` L${x0},${y}`;
        d += ` L${x1},${y}`;
      });
      const color = s.color || '#7dd3fc';
      svg += `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.6"/>`;
      // 网格线
      svg += `<line x1="${labelW}" y1="${yMid}" x2="${width - 10}" y2="${yMid}" stroke="#2a303b" stroke-dasharray="2 4"/>`;
    });
    // 时间刻度
    for (let k = 0; k <= n; k++) {
      const x = labelW + k * step;
      svg += `<line x1="${x}" y1="8" x2="${x}" y2="${height - 8}" stroke="#1d222b"/>`;
    }
    svg += `<text x="${width - 10}" y="${height - 2}" text-anchor="end" fill="#4a5568" font-size="10">周期 →</text>`;
    svg += '</svg>';
    return svg;
  }

  window.VL = window.VL || {};
  window.VL.renderMarkdown = render;
  window.VL.renderWave = wave;
  window.VL.esc = esc;
})();