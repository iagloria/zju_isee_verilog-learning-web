/* Verilog 闯关训练 —— 前端逻辑 */
(function () {
  'use strict';
  const VL = window.VL;
  const $ = (s) => document.querySelector(s);
  const STORE_KEY = 'vlab.progress.v1';

  const state = {
    meta: null,
    problems: [],
    byId: {},
    current: null,      // 当前题目对象（含 files）
    editors: {},        // filename -> CodeMirror
    activeFile: null,
    progress: {},
    filter: '',
    running: false,
    lastResult: null,
    solutionShown: false,
  };

  /* ---------------- 进度 ---------------- */
  function loadProgress() {
    try { state.progress = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (_) { state.progress = {}; }
  }
  function saveProgress() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state.progress)); } catch (_) {}
    // 同时写一份到磁盘（服务器关闭也不丢）
    fetch('/api/progress', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problems: state.progress, updated: new Date().toISOString() }),
    }).catch(() => {});
  }
  function rec(id) {
    if (!state.progress[id]) state.progress[id] = { code: null, status: 'todo' };
    return state.progress[id];
  }

  /* ---------------- 列表 ---------------- */
  function renderList() {
    const box = $('#problemList');
    const groups = { '教材': [], '重点专题': [] };
    const list = [];
    state.meta.chapters.forEach((ch) => {
      ch.problems.forEach((p) => list.push({ ...p, chapter: ch.chapter, chapterTitle: ch.title, group: ch.group }));
    });
    state.problems = list;
    state.byId = {};
    list.forEach((p) => { state.byId[p.id] = p; });

    const q = state.filter.trim().toLowerCase();
    const html = [];
    let lastGroup = null;
    state.meta.chapters.forEach((ch) => {
      const items = ch.problems.filter((p) => {
        if (!q) return true;
        return (p.title + ' ' + (p.tags || []).join(' ') + ' ' + p.id + ' ' + (p.brief || '') + ' ' + ch.title).toLowerCase().includes(q);
      });
      if (!items.length) return;
      if (ch.group !== lastGroup && !q) {
        html.push(`<div class="group-title">${ch.group === '重点专题' ? '重点专题' : '教材 1–12 章'}</div>`);
        lastGroup = ch.group;
      }
      html.push(`<div class="chapter" data-ch="${ch.chapter}">`);
      html.push(`<div class="chapter-head"><span class="chev">▼</span><span>${escapeHtml(ch.title)}</span><span class="count">${items.length}</span></div>`);
      html.push('<div class="items">');
      items.forEach((p) => {
        const r = state.progress[p.id] || {};
        const dotCls = r.status === 'pass' ? 'pass' : (r.tries ? 'try' : (r.status === 'view' ? 'view' : ''));
        html.push(`<div class="item" data-id="${p.id}"><span class="dot ${dotCls}"></span><span class="t" title="${escapeAttr(p.title)}">${escapeHtml(p.title)}</span></div>`);
      });
      html.push('</div></div>');
    });
    box.innerHTML = html.join('');
    box.querySelectorAll('.item').forEach((el) => {
      el.addEventListener('click', () => openProblem(el.dataset.id));
    });
    box.querySelectorAll('.chapter-head').forEach((el) => {
      el.addEventListener('click', () => el.parentElement.classList.toggle('collapsed'));
    });
    highlightActive();
    updateProgressMini();
  }

  function highlightActive() {
    const id = state.current && state.current.id;
    document.querySelectorAll('.item').forEach((el) => el.classList.toggle('active', el.dataset.id === id));
  }

  function updateProgressMini() {
    const total = state.problems.length;
    const done = Object.values(state.progress).filter((x) => x.status === 'pass').length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    $('#progressMini').innerHTML = `<span>已通过</span><div class="progress-bar"><i style="width:${pct}%"></i></div><b style="color:#fff">${done}/${total}</b>`;
  }

  /* ---------------- 打开题目 ---------------- */
  async function openProblem(id) {
    if (state.running) return;
    const res = await fetch('/api/problem/' + encodeURIComponent(id));
    if (!res.ok) { alert('题目加载失败：' + id); return; }
    const p = await res.json();
    state.current = p;
    state.solutionShown = false;
    state.lastResult = null;
    document.title = p.title + ' · Verilog 闯关';

    // 恢复代码
    const saved = (state.progress[id] && state.progress[id].code) || null;
    p._savedCode = saved;
    renderHeader(p);
    renderDesc(p);
    renderEditor(p);
    renderResultEmpty(p);
    $('#solutionBody').innerHTML = '';
    $('#logBody').querySelector('.log').textContent = '';
    $('#waveBody').innerHTML = '';
    setStage('');
    highlightActive();
    const r = rec(id);
    if (!r.status || r.status === 'todo') { r.status = 'view'; saveProgress(); renderList(); }
    if (window.innerWidth < 1100) $('#descPane').classList.add('show');
  }

  function renderHeader(p) {
    const typeMap = { write: '手写代码', bug: '找错改错', fill: '补全代码', quiz: '概念选择', tb: '写 Testbench' };
    const diffStars = '★'.repeat(p.difficulty || 1);
    $('#descHeader').innerHTML = `
      <div class="dh-title">${escapeHtml(p.title)}</div>
      <div class="dh-meta">
        <span class="pill type-${p.type}">${typeMap[p.type] || p.type}</span>
        <span class="pill">${escapeHtml(p.tag || '')}</span>
        <span class="pill diff" title="难度">${diffStars}</span>
        ${(p.tags || []).map((t) => `<span class="pill">${escapeHtml(t)}</span>`).join('')}
      </div>`;
  }

  function renderDesc(p) {
    let html = '';
    if (p.brief) html += `<p style="color:#9aa6b8"><em>${escapeHtml(p.brief)}</em></p>`;
    html += VL.renderMarkdown(p.desc || '');
    $('#descBody').innerHTML = html;

    const extra = $('#descExtra');
    if (p.type === 'quiz') {
      extra.innerHTML = renderQuiz(p);
      bindQuiz(p);
    } else {
      extra.innerHTML = paperPanel(p);
      bindPaper(p);
    }
  }

  /* ---------------- 手写练习区 ---------------- */
  function paperPanel(p) {
    const r = state.progress[p.id] || {};
    return `
      <div class="paper">
        <div class="paper-head">
          <span>✍️ 手写练习区（模拟卷面：先在这里默写，再切到编辑器运行验证）</span>
        </div>
        <textarea id="paper" placeholder="在这里写答案草稿……（自动保存）" spellcheck="false">${escapeHtml(r.paper || '')}</textarea>
        <div class="paper-foot">
          <button class="btn secondary" id="btnPaperCopy">拷贝到编辑器</button>
          <button class="btn secondary" id="btnPaperClear">清空</button>
        </div>
      </div>`;
  }
  function bindPaper(p) {
    const ta = $('#paper');
    if (!ta) return;
    ta.addEventListener('input', () => {
      rec(p.id).paper = ta.value;
      clearTimeout(ta._t);
      ta._t = setTimeout(saveProgress, 800);
    });
    const copyBtn = $('#btnPaperCopy');
    if (copyBtn) copyBtn.addEventListener('click', () => {
      if (state.activeFile && state.editors[state.activeFile]) {
        state.editors[state.activeFile].setValue(ta.value);
        switchTab('result');
      }
    });
    const clearBtn = $('#btnPaperClear');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      if (ta.value && !confirm('确定清空手写区？')) return;
      ta.value = '';
      rec(p.id).paper = '';
      saveProgress();
    });
  }

  /* ---------------- 选择题 ---------------- */
  function renderQuiz(p) {
    const qs = (p.quiz && p.quiz.questions) || [];
    const ans = (state.progress[p.id] && state.progress[p.id].quiz) || {};
    return `<div class="quiz">${qs.map((q, qi) => {
      const chosen = ans[qi];
      const done = chosen !== undefined;
      return `<div class="qcard ${done ? 'done' : ''}" data-q="${qi}">
        <div class="q">${qi + 1}. ${escapeHtml(q.q)}</div>
        ${q.options.map((o, oi) => {
          let cls = 'opt';
          if (done) {
            if (oi === q.answer) cls += ' right';
            else if (oi === chosen) cls += ' wrong';
          } else if (oi === chosen) cls += ' sel';
          return `<div class="${cls}" data-o="${oi}"><span class="k">${'ABCD'[oi]}.</span><span>${escapeHtml(o)}</span></div>`;
        }).join('')}
        <div class="why">✔ 正确答案：${'ABCD'[q.answer]}。${escapeHtml(q.why || '')}</div>
      </div>`;
    }).join('')}
    <div style="display:flex;gap:8px;margin-top:6px">
      <button class="btn primary" id="btnQuizCheck">提交答案</button>
      <button class="btn secondary" id="btnQuizReset">重做</button>
      <span id="quizScore" style="align-self:center;color:#9aa6b8;font-size:13px"></span>
    </div></div>`;
  }
  function bindQuiz(p) {
    const answers = ((state.progress[p.id] || {}).quiz) || {};
    const pick = {};
    Object.assign(pick, answers);
    let submitted = Object.keys(answers).length > 0;

    function paint() {
      document.querySelectorAll('.qcard').forEach((card) => {
        const qi = Number(card.dataset.q);
        const q = p.quiz.questions[qi];
        card.classList.toggle('done', submitted);
        card.querySelectorAll('.opt').forEach((o) => {
          const oi = Number(o.dataset.o);
          o.className = 'opt';
          if (submitted) {
            if (oi === q.answer) o.classList.add('right');
            else if (pick[qi] === oi) o.classList.add('wrong');
          } else if (pick[qi] === oi) o.classList.add('sel');
        });
      });
      const scoreEl = $('#quizScore');
      if (!scoreEl) return;
      if (submitted) {
        let sc = 0;
        p.quiz.questions.forEach((q, i) => { if (pick[i] === q.answer) sc++; });
        scoreEl.textContent = `得分 ${sc} / ${p.quiz.questions.length}`;
        scoreEl.style.color = sc === p.quiz.questions.length ? '#34d399' : '#fbbf24';
      } else scoreEl.textContent = '';
    }

    document.querySelectorAll('.opt').forEach((o) => {
      o.addEventListener('click', () => {
        if (submitted) return;
        const qi = Number(o.closest('.qcard').dataset.q);
        pick[qi] = Number(o.dataset.o);
        paint();
      });
    });
    const checkBtn = $('#btnQuizCheck');
    if (checkBtn) checkBtn.addEventListener('click', () => {
      const unanswered = p.quiz.questions.findIndex((q, i) => pick[i] === undefined);
      if (unanswered >= 0) { alert('第 ' + (unanswered + 1) + ' 题还没选'); return; }
      submitted = true;
      const r = rec(p.id);
      r.quiz = { ...pick };
      let allRight = true;
      p.quiz.questions.forEach((q, i) => { if (pick[i] !== q.answer) allRight = false; });
      r.status = allRight ? 'pass' : (r.status === 'pass' ? 'pass' : 'todo');
      r.tries = (r.tries || 0) + 1;
      saveProgress();
      paint();
      renderList();
    });
    const resetBtn = $('#btnQuizReset');
    if (resetBtn) resetBtn.addEventListener('click', () => {
      submitted = false;
      Object.keys(pick).forEach((k) => delete pick[k]);
      const r = rec(p.id);
      delete r.quiz;
      if (r.status === 'pass') r.status = 'todo';
      saveProgress();
      paint();
      renderList();
    });
    paint();
  }

  /* ---------------- 编辑器 ---------------- */
  function renderEditor(p) {
    const tabs = $('#fileTabs');
    tabs.innerHTML = '';
    const files = p.files || [];
    Object.values(state.editors).forEach((cm) => { try { cm.toTextArea(); } catch (_) {} });
    state.editors = {};
    const host = $('#editor');
    host.innerHTML = '';

    if (!files.length || p.type === 'quiz') {
      host.innerHTML = '<div class="empty-hint" style="padding-top:60px">这是一道概念题，不需要写代码。<br>在左侧题目描述里作答即可。</div>';
      $('#btnRun').disabled = true;
      $('#btnExplain').disabled = true;
      $('#btnSave').disabled = true;
      $('#btnReset').disabled = true;
      return;
    }
    $('#btnRun').disabled = false;
    $('#btnExplain').disabled = false;
    $('#btnSave').disabled = false;
    $('#btnReset').disabled = false;

    files.forEach((f, idx) => {
      const ta = document.createElement('textarea');
      ta.className = 'file-src';
      ta.dataset.name = f.name;
      host.appendChild(ta);
      const tab = document.createElement('button');
      tab.className = 'ftab' + (idx === 0 ? ' active' : '');
      tab.textContent = f.name;
      tab.dataset.name = f.name;
      tabs.appendChild(tab);
      tab.addEventListener('click', () => switchFile(f.name));

      const key = p.id + '::' + f.name;
      const savedAll = state.progress[p.id] && state.progress[p.id].codeAll;
      let value = f.content;
      if (savedAll && savedAll[f.name] !== undefined) value = savedAll[f.name];
      else if (idx === 0 && p._savedCode) value = p._savedCode;

      const cm = CodeMirror.fromTextArea(ta, {
        mode: 'verilog',
        lineNumbers: true,
        matchBrackets: true,
        autoCloseBrackets: true,
        styleActiveLine: true,
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: false,
        viewportMargin: Infinity,
      });
      cm.setValue(value);
      cm._name = f.name;
      cm._p = p;
      cm._idx = idx;
      if (idx !== 0) cm.getWrapperElement().style.display = 'none';
      cm.getWrapperElement().dataset.name = f.name;
      state.editors[f.name] = cm;
      cm.on('change', () => {
        clearTimeout(cm._t);
        cm._t = setTimeout(persistCode, 700);
      });
    });
    state.activeFile = files[0] ? files[0].name : null;
    setTimeout(() => { if (state.editors[state.activeFile]) state.editors[state.activeFile].refresh(); }, 30);
  }

  function switchFile(name) {
    Object.entries(state.editors).forEach(([n, cm]) => {
      cm.getWrapperElement().style.display = n === name ? '' : 'none';
    });
    document.querySelectorAll('.ftab').forEach((t) => t.classList.toggle('active', t.dataset.name === name));
    state.activeFile = name;
    if (state.editors[name]) setTimeout(() => state.editors[name].refresh(), 10);
  }

  function persistCode() {
    const p = state.current;
    if (!p) return;
    const r = rec(p.id);
    const all = {};
    Object.entries(state.editors).forEach(([n, cm]) => { all[n] = cm.getValue(); });
    r.codeAll = all;
    const first = p.files && p.files[0] ? p.files[0].name : null;
    r.code = first && all[first] !== undefined ? all[first] : null;
    saveProgress();
  }

  function collectFiles() {
    const p = state.current;
    if (!p || !p.files) return [];
    return p.files.map((f) => ({ name: f.name, content: (state.editors[f.name] || { getValue: () => '' }).getValue() }));
  }

  /* ---------------- 运行 ---------------- */
  async function run() {
    const p = state.current;
    if (!p || state.running || !p.files || !p.files.length) return;
    state.running = true;
    const btn = $('#btnRun');
    btn.disabled = true; btn.classList.add('running'); btn.textContent = '运行中…';
    setStage('正在编译并仿真…');
    persistCode();
    try {
      const res = await fetch('/api/judge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemId: p.id, files: collectFiles(), show: true }),
      });
      const r = await res.json();
      state.lastResult = r;
      const rr = rec(p.id);
      rr.tries = (rr.tries || 0) + 1;
      rr.last = r.status;
      if (r.status === 'pass') rr.status = 'pass';
      saveProgress();
      renderResult(r);
      renderLog(r);
      renderWave(r);
      renderList();
    } catch (e) {
      setStage('出错了');
      showVerdict('bad', '运行失败', String(e));
    } finally {
      state.running = false;
      btn.disabled = false; btn.classList.remove('running'); btn.textContent = '▶ 运行';
    }
  }

  async function explain() {
    const p = state.current;
    if (!p || state.running || !p.files || !p.files.length) return;
    const res = await fetch('/api/explain', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, files: collectFiles() }),
    });
    const r = await res.json();
    switchTab('result');
    const box = $('#resultBody');
    const errs = (r.lint || []).filter((x) => x.sev === 'error');
    const warns = (r.lint || []).filter((x) => x.sev === 'warn');
    const infos = (r.lint || []).filter((x) => x.sev === 'info');
    let html = `<div class="verdict ${errs.length ? 'bad' : (warns.length ? 'warn' : 'ok')}">${errs.length ? '✖ 发现 ' + errs.length + ' 个“一定错”的问题' : (warns.length ? '⚠ 有 ' + warns.length + ' 处可疑写法' : '✔ 静态检查没发现问题')}<span class="sub">（只做了检查，没有仿真）</span></div>`;
    if (!r.lint.length) html += '<div class="empty-hint">看起来不错。运行一下做功能验证吧。</div>';
    html += lintHtml(r.lint || []);
    html += `<div class="sec-title">考场上最容易被扣分的点</div>` +
      `<div class="issue info"><span class="tag">提示</span><div>组合逻辑要么块首赋默认值，要么所有分支都赋值（否则推断锁存器）；时序逻辑一律用 <=；异步复位的复位信号要写进敏感表；“保持”就故意不写赋值。</div></div>`;
    box.innerHTML = html;
    setStage('静态检查');
  }

  function lintHtml(list) {
    if (!list.length) return '';
    const order = { error: 0, warn: 1, info: 2 };
    list = list.slice().sort((a, b) => (order[a.sev] - order[b.sev]) || ((a.line || 0) - (b.line || 0)));
    return list.map((it) => `
      <div class="issue ${it.sev}">
        <span class="tag">${it.sev === 'error' ? '错误' : it.sev === 'warn' ? '注意' : '提示'}</span>
        <div>${it.line ? `<span class="ln" data-line="${it.line}">第 ${it.line} 行</span> ` : ''}${escapeHtml(it.msg)}</div>
      </div>`).join('');
  }

  function bindLineLinks(root) {
    root.querySelectorAll('.ln').forEach((el) => {
      el.addEventListener('click', () => {
        const cm = state.editors[state.activeFile];
        if (!cm) return;
        const ln = Number(el.dataset.line) - 1;
        cm.focus();
        cm.setCursor({ line: ln, ch: 0 });
        cm.scrollIntoView({ line: ln, ch: 0 }, 80);
      });
    });
  }

  function showVerdict(cls, title, sub) {
    $('#resultBody').innerHTML = `<div class="verdict ${cls}">${title}<span class="sub">${escapeHtml(sub || '')}</span></div>`;
  }

  function renderResultEmpty(p) {
    switchTab('result');
    const tip = p.type === 'tb'
      ? '这道题要你写 Testbench：系统会检查你是否真的把题目要求的每组输入都打到了 DUT 上、有没有 $finish。'
      : '写好代码后点「▶ 运行」（Ctrl+Enter）。会真的调用 Icarus Verilog 编译 + 仿真，逐条告诉你哪组测试没通过。';
    $('#resultBody').innerHTML = `<div class="empty-hint">${tip}</div>`;
    setStage('');
  }

  function renderResult(r) {
    if (r.status === 'notfound') { showVerdict('bad', '题目加载失败', r.message || ''); return; }
    const box = $('#resultBody');
    const stageMap = { compile: '编译阶段失败', sim: '仿真阶段失败', done: '完成' };
    if (r.stage === 'compile' || (r.compile && r.compile.code !== 0)) {
      const out = (r.compile && r.compile.output) || '';
      let html = `<div class="verdict bad">✖ 编译不通过<span class="sub">先修复语法/端口错误</span></div>`;
      html += `<div class="sec-title">编译器输出</div><pre class="log">${formatCompile(out)}</pre>`;
      html += hintForCompile(out);
      html += lintHtml(r.lint || []);
      box.innerHTML = html;
      bindLineLinks(box);
      setStage('编译失败 · ' + (r.totalMs || 0) + 'ms');
      return;
    }

    const pass = r.status === 'pass';
    const totalChecks = (r.tests || []).reduce((a, t) => a + (t.total || 0), 0);
    const failed = (r.tests || []).reduce((a, t) => a + (t.fail || 0), 0);
    const maybe = (r.tests || []).reduce((a, t) => a + (t.maybe || 0), 0);
    let html = `<div class="verdict ${pass ? 'ok' : 'bad'}">${pass ? '✔ 全部通过' : '✖ 还有测试没通过'}
      <span class="sub">${pass ? `共 ${totalChecks} 个检查点` : `失败 ${failed} 项${maybe ? `，存疑 ${maybe} 项` : ''}`} · ${r.totalMs || 0}ms 内完成</span></div>`;
    if (pass && (r.lint || []).some((x) => x.sev === 'warn')) {
      html += `<div class="issue warn"><span class="tag">注意</span><div>功能是对的，但下面这些写法在考试/综合时可能被扣分，建议看一眼。</div></div>`;
    }
    (r.tests || []).forEach((t, i) => {
      html += `<div class="sec-title">${escapeHtml(t.name || '测试')} ${t.passed ? '✔' : '✖'}</div>`;
      html += '<div class="tests">';
      html += `<div class="test ${t.passed ? 'pass' : 'fail'}">
        <div class="test-head">${t.passed ? '✔ 通过' : '✖ 未通过'}
          <span class="counts">${t.pass || 0} ✔ / ${t.fail || 0} ✖ ${t.maybe ? `/ ${t.maybe} ?` : ''}</span></div>
        <div class="test-body">${(t.checks || []).map((c) => `<div class="chk ${c.res}"><span class="r">${c.res === 'P' ? '✔' : c.res === 'F' ? '✖' : '?'}</span><span class="v">${escapeHtml(c.value)}</span></div>`).join('') || '<span style="color:#6b7789">全部通过</span>'}</div>
      </div></div>`;
    });
    if (r.watch && r.watch.length) {
      html += `<div class="sec-title">仿真结束时 DUT 端口的值</div><table class="watch-table">` +
        r.watch.map((w) => { const m = w.match(/^(\S+)\s*=\s*(\S+)$/); return m ? `<tr><td>${escapeHtml(m[1])}</td><td>${escapeHtml(m[2])}</td></tr>` : ''; }).join('') + '</table>';
    }
    html += lintHtml(r.lint || []);
    box.innerHTML = html;
    bindLineLinks(box);
    setStage(`${stageMap[r.stage] || r.stage} · ${(r.sim && r.sim.ms) || 0}ms 仿真`);
  }

  function hintForCompile(out) {
    const hints = [];
    const add = (re, msg) => { if (re.test(out)) hints.push(msg); };
    add(/Error opening temporary file|check TMP or TMPDIR/i,
      '这是工具链问题，不是你的代码错：编译器无法创建临时文件（系统 TEMP 目录不可写）。'
      + '本项目已改用 .vlab\\data\\tmp 作为临时目录；若仍出现，请检查该目录是否可写、磁盘是否已满、杀毒软件是否拦截。');
    add(/Unknown module type/, '提示：模块名写错了，或实例化时模块名与定义不一致（大小写敏感）。');
    add(/already been declared/, '提示：同一个名字定义了两个 module，检查是否重复粘贴。');
    add(/is not a net|must be a net/i, '提示：assign 的左值必须是 wire。');
    add(/could not find port|port .* is not a port/i, '提示：例化时端口名写错，或子模块没有这个端口（按名字连接 .xxx() 时最容易错）。');
    add(/syntax error/, '提示：检查上一行是否漏了分号、begin/end 是否配对、括号是否闭合。');
    add(/not defined|failed to elaborate/i, '提示：端口位宽或连接方向不匹配。');
    return hints.length ? `<div class="sec-title">可能的原因</div>` + hints.map((h) => `<div class="issue info"><span class="tag">提示</span><div>${escapeHtml(h)}</div></div>`).join('') : '';
  }

  function formatCompile(out) {
    if (!out) return '<span class="dim">（没有输出）</span>';
    return escapeHtml(out).split('\n').map((l) => {
      if (/error/i.test(l)) return `<span class="err">${l}</span>`;
      if (/warning/i.test(l)) return `<span style="color:#fbbf24">${l}</span>`;
      return `<span class="dim">${l}</span>`;
    }).join('\n');
  }

  function renderLog(r) {
    const pre = $('#logBody').querySelector('.log');
    let html = '';
    if (r.compile && r.compile.output) {
      html += `<span class="dim">==== 编译（iverilog） ====</span>\n` + formatCompile(r.compile.output) + '\n';
    } else if (r.compile) {
      html += `<span class="ok">编译通过</span>\n`;
    }
    if (r.sim && r.sim.output) {
      html += `<span class="dim">==== 仿真（vvp） ====</span>\n`;
      html += escapeHtml(r.sim.output).split('\n').map((l) => {
        if (l.startsWith('[CHECK]P')) return `<span class="ok">${l}</span>`;
        if (l.startsWith('[CHECK]F')) return `<span class="err">${l}</span>`;
        if (l.startsWith('[CHECK]M')) return `<span style="color:#fbbf24">${l}</span>`;
        if (l.includes('error:')) return `<span class="err">${l}</span>`;
        return l;
      }).join('\n');
    }
    pre.innerHTML = html || '<span class="dim">（没有输出）</span>';
  }

  function renderWave(r) {
    const box = $('#waveBody');
    if (!r.watch || !r.watch.length) {
      box.innerHTML = '<div class="empty-hint">这道题没有波形数据。<br>波形只对“带时钟的时序题”生成：它会用一组固定激励重跑你的电路，把关键寄存器按周期画出来。</div>';
      return;
    }
    // 解析 "count.bin=0101 tick=0" 这种行
    const names = [];
    const cols = [];
    r.watch.forEach((line) => {
      const parts = line.trim().split(/\s+/);
      const vals = {};
      parts.forEach((kv) => {
        const m = kv.match(/^([^=]+)=(\S+)$/);
        if (!m) return;
        const n = m[1];
        if (!names.includes(n)) names.push(n);
        vals[n] = m[2];
      });
      cols.push(vals);
    });
    const series = names.map((n) => {
      const isBin = cols.some((c) => c[n] && /^[01x]+$/.test(c[n]) && c[n].length > 1);
      if (isBin) {
        // 向量：逐位画成一条线（取最低位），并在标签里显示数值
        return { name: n, vals: cols.map((c) => (c[n] || 'x').slice(-1)), ticks: cols.map((c) => c[n]) };
      }
      const vals = cols.map((c) => {
        const v = c[n];
        return v === '1' ? '1' : (v === '0' ? '0' : 'x');
      });
      return { name: n, vals };
    });
    let html = '<div class="wave-legend">每个格子 = 1 个时钟周期（取仿真过程中的关键拍）。向量信号显示为最低位波形，右侧标注每拍的数值。</div>';
    html += VL.renderWave(series.map((s) => ({ name: s.name, vals: s.vals })), { width: 700 });
    const vec = series.filter((s) => s.ticks);
    if (vec.length) {
      html += '<table class="watch-table" style="margin-top:10px">';
      html += '<tr><td>周期</td>' + vec.map((s) => `<td>${escapeHtml(s.name)}</td>`).join('') + '</tr>';
      for (let i = 0; i < cols.length; i++) {
        html += `<tr><td>${i}</td>` + vec.map((s) => `<td>${escapeHtml(s.ticks[i] || '-')}</td>`).join('') + '</tr>';
      }
      html += '</table>';
    }
    const scalar = series.filter((s) => !s.ticks);
    if (scalar.length) {
      html += '<table class="watch-table" style="margin-top:10px">';
      html += '<tr><td>周期</td>' + scalar.map((s) => `<td>${escapeHtml(s.name)}</td>`).join('') + '</tr>';
      for (let i = 0; i < cols.length; i++) {
        html += `<tr><td>${i}</td>` + scalar.map((s) => `<td>${escapeHtml(s.vals[i] || '-')}</td>`).join('') + '</tr>';
      }
      html += '</table>';
    }
    box.innerHTML = html;
  }

  function switchTab(name) {
    document.querySelectorAll('.rtab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    ['result', 'log', 'wave', 'solution'].forEach((n) => {
      const el = $('#' + n + 'Body');
      if (el) el.classList.toggle('hidden', n !== name);
    });
  }

  function setStage(s) { $('#stageBadge').textContent = s || ''; }

  /* ---------------- 参考答案 ---------------- */
  async function showSolution() {
    const p = state.current;
    if (!p) return;
    switchTab('solution');
    const box = $('#solutionBody');
    box.innerHTML = '<div class="empty-hint">正在加载…</div>';
    let r = { code: null };
    try {
      const res = await fetch('/api/solution', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id }),
      });
      r = await res.json();
    } catch (_) {}
    let html = '';
    if (r.code) {
      html += `<div class="sol-toolbar">
        <button class="btn primary" id="btnUseSol">加载到编辑器（看完自己再改回去）</button>
        <span style="align-self:center;color:#6b7789;font-size:12px">建议先自己做一遍，再对照参考答案</span></div>`;
      html += `<pre class="sol-code">${escapeHtml(r.code)}</pre>`;
    } else if (p.type === 'quiz') {
      html += '<div class="empty-hint">选择题的答案就在每道题下面，先自己选再查看。</div>';
    } else {
      html += '<div class="empty-hint">这道题没有附带参考答案。</div>';
    }
    if (p.keyPoints && p.keyPoints.length) {
      html += `<div class="kp"><div class="sec-title">关键点 / 考场提醒</div><ul>${p.keyPoints.map((k) => `<li>${escapeHtml(k)}</li>`).join('')}</ul></div>`;
    }
    box.innerHTML = html;
    const use = $('#btnUseSol');
    if (use) use.addEventListener('click', () => {
      const cm = state.editors[state.activeFile];
      if (cm && r.code) cm.setValue(r.code);
      switchTab('result');
    });
  }

  /* ---------------- 其他按钮 ---------------- */
  function resetCode() {
    const p = state.current;
    if (!p) return;
    if (!confirm('确定恢复成题目初始代码？你写的代码会丢失。')) return;
    p.files.forEach((f) => {
      if (state.editors[f.name]) state.editors[f.name].setValue(f.content);
    });
    persistCode();
  }

  async function saveAnswer() {
    const p = state.current;
    if (!p) return;
    const all = collectFiles();
    const content = all.map((f) => `// ===== ${f.name} =====\n` + f.content).join('\n\n');
    await fetch('/api/answer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, code: content }),
    });
    alert('已保存到 .vlab\\data\\answers\\ 目录');
  }

  /* ---------------- 手写模拟卷 ---------------- */
  async function requestExam(wantDocx) {
    const pool = state.problems.filter((p) => p.type !== 'quiz');
    const chosen = pool.filter((p) => !(state.progress[p.id] || {}).status || state.progress[p.id].status !== 'pass');
    const ids = (chosen.length >= 6 ? chosen : pool).slice(0, 12).map((p) => p.id);
    const title = 'Verilog 手写模拟卷 · ' + new Date().toLocaleDateString('zh-CN');
    if (wantDocx) {
      try {
        const res = await fetch('/api/exam/docx-save', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, title }),
        });
        const r = await res.json();
        if (r.ok) alert('已生成 Word：\n' + r.file + (r.answers ? '\n' + r.answers : '') + '\n\n已用资源管理器为你打开所在文件夹。');
        else alert('生成失败：' + (r.message || ''));
      } catch (e) { alert('生成失败：' + e.message); }
      return;
    }
    const res = await fetch('/api/exam', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, title }),
    });
    const html = await res.text();
    const w = window.open('', '_blank');
    if (!w) { alert('浏览器拦截了弹出窗口，请允许后重试'); return; }
    w.document.write(html);
    w.document.close();
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escapeAttr(s) { return escapeHtml(s); }

  /* ---------------- 初始化 ---------------- */
  async function init() {
    loadProgress();
    const res = await fetch('/api/meta');
    state.meta = await res.json();
    // 合并服务器进度（以本地为准，服务器只做备份/兜底）
    if (state.meta.progress && state.meta.progress.problems) {
      Object.entries(state.meta.progress.problems).forEach(([k, v]) => {
        if (!state.progress[k]) state.progress[k] = v;
      });
    }
    renderList();

    $('#search').addEventListener('input', (e) => { state.filter = e.target.value; renderList(); });
    $('#btnRun').addEventListener('click', run);
    $('#btnExplain').addEventListener('click', explain);
    $('#btnReset').addEventListener('click', resetCode);
    $('#btnSave').addEventListener('click', saveAnswer);
    $('#btnOpenAnswers').addEventListener('click', () => fetch('/api/open', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }));
    $('#btnExam').addEventListener('click', () => requestExam(false));
    $('#btnExamDocx').addEventListener('click', () => requestExam(true));
    $('#btnRandom').addEventListener('click', () => {
      const todo = state.problems.filter((p) => !(state.progress[p.id] || {}).status || state.progress[p.id].status !== 'pass');
      const pool = todo.length ? todo : state.problems;
      const p = pool[Math.floor(Math.random() * pool.length)];
      if (p) openProblem(p.id);
    });

    document.querySelectorAll('.rtab').forEach((t) => {
      t.addEventListener('click', () => {
        if (t.dataset.tab === 'solution') showSolution();
        switchTab(t.dataset.tab);
      });
    });

    // 快捷键
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); }
      else if (e.key === 's' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveAnswer(); }
      else if (e.key === 'e' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); explain(); }
    });

    // 分隔条：拖动调整编辑器/结果区间高度
    const sp = $('#splitter');
    let dragging = false;
    sp.addEventListener('mousedown', () => { dragging = true; document.body.style.cursor = 'row-resize'; });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const pane = $('#resultPane');
      const h = window.innerHeight - e.clientY;
      pane.style.height = Math.max(120, Math.min(window.innerHeight - 200, h)) + 'px';
    });
    window.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false; document.body.style.cursor = '';
      Object.values(state.editors).forEach((cm) => cm.refresh());
    });

    // 打开第一道未通过的题，或者第一题
    const first = state.problems.find((p) => !(state.progress[p.id] || {}).status || state.progress[p.id].status !== 'pass') || state.problems[0];
    if (first) openProblem(first.id);

    window.addEventListener('resize', () => Object.values(state.editors).forEach((cm) => cm.refresh()));
  }

  document.addEventListener('DOMContentLoaded', init);
})();