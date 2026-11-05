'use strict';
/*
 * 静态检查（启发式 lint）—— 不运行仿真也能给出“哪里一定错/很可能错”的提示。
 * 目的是模拟老师批改卷子时最容易扣分的地方：位宽、reg/wire、锁存器、
 * 阻塞/非阻塞、敏感表、FSM 默认分支、UDP 格式等。
 */
const DEFAULT_OPTS = {
  // 期望的写法要求
  requireAsyncReset: false,     // 异步复位：敏感表里要有 negedge/posedge rst
  requireSyncReset: false,      // 同步复位：敏感表里不能有 rst
  resetPolarity: 'low',         // 'low' -> rst_n / !rst, 'high' -> rst
  allowBlockingInCode: true,    // 题面本身用阻塞赋值写组合块（如 FSM 第二段）
  needAlwaysStar: null,         // 'combinational' | 'sequential' | null
  ports: {                      // 期望端口（名字 -> 位宽描述），由题目给出，用于检查拼接位宽等
    // e.g. { a: 8, b: 8, sum: 8, cout: 1 }
  },
  isTestbench: false,
  isUdp: false,
  isGateLevel: false,
  isSwitchLevel: false,
};

const KEYWORDS = new Set([
  'module', 'endmodule', 'input', 'output', 'inout', 'wire', 'reg', 'integer', 'parameter',
  'localparam', 'assign', 'always', 'initial', 'begin', 'end', 'if', 'else', 'case', 'endcase',
  'casez', 'casex', 'default', 'for', 'while', 'repeat', 'forever', 'function', 'endfunction',
  'task', 'endtask', 'generate', 'endgenerate', 'genvar', 'posedge', 'negedge', 'or', 'and',
  'not', 'nand', 'nor', 'xor', 'xnor', 'buf', 'tran','tranif0','tranif1','nmos','pmos','cmos',
  'supply0', 'supply1', 'pullup', 'pulldown', 'primitive', 'endprimitive', 'table', 'endtable',
  'specify', 'endspecify', 'signed', 'time', 'real', 'defparam', 'fork', 'join', 'wait',
]);

function stripComments(code) {
  // 保留换行，便于行号定位
  return code
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, '');
}

function lineOf(code, index) {
  let n = 1;
  for (let i = 0; i < index && i < code.length; i++) if (code[i] === '\n') n++;
  return n;
}

function depthAt(code, index) {
  let d = 0;
  for (let i = 0; i < index && i < code.length; i++) {
    if (code[i] === '{' || code[i] === '(' || code[i] === '[') d++;
    else if (code[i] === '}' || code[i] === ')' || code[i] === ']') d--;
  }
  return d;
}

/** 粗粒度分块：把模块体内的 always / initial 块抽出来 */
function extractBlocks(code) {
  const blocks = [];
  const re = /\b(always|initial)\b/g;
  let m;
  while ((m = re.exec(code))) {
    const start = m.index;
    let i = re.lastIndex;
    // 读取敏感表 @(...)
    let hasAt = false;
    let sens = '';
    while (i < code.length && /\s/.test(code[i])) i++;
    if (code[i] === '@') {
      hasAt = true;
      let j = i + 1;
      while (j < code.length && /\s/.test(code[j])) j++;
      if (code[j] === '(') {
        let d = 0;
        const s = j;
        for (; j < code.length; j++) {
          if (code[j] === '(') d++;
          else if (code[j] === ')') { d--; if (d === 0) { j++; break; } }
        }
        sens = code.slice(s + 1, j - 1).trim();
        i = j;
      }
    }
    // 块体：begin...end 或单条语句
    while (i < code.length && /\s/.test(code[i])) i++;
    let bodyStart = i;
    let bodyEnd = i;
    if (/^begin\b/.test(code.slice(i, i + 6))) {
      let d = 0;
      for (let k = i; k < code.length; k++) {
        if (/^begin\b/.test(code.slice(k, k + 6))) d++;
        else if (/^end\b/.test(code.slice(k, k + 4))) {
          d--;
          if (d === 0) { bodyEnd = k + 3; break; }
        }
      }
    } else {
      bodyEnd = Math.min(code.indexOf(';', i) + 1 || code.length, code.indexOf('\n', i) + 1 || code.length);
    }
    blocks.push({
      kind: m[1],
      start,
      bodyStart,
      bodyEnd,
      sens,
      hasAt,
      text: code.slice(bodyStart, bodyEnd),
      line: lineOf(code, start),
    });
  }
  return blocks;
}

/** 找出块内被赋值的信号（左值） */
function assignedTargets(blockText) {
  const t = new Set();
  const re = /(?<![<>=!~&|^+\-*/])(\w+)\s*(?:\[[^\]]*\])?\s*(<=|=(?!=))/g;
  let m;
  while ((m = re.exec(blockText))) {
    if (KEYWORDS.has(m[1])) continue;
    t.add(m[1]);
  }
  return [...t];
}

/** 块内是否阅读了某信号 */
function readsSignal(blockText, sig) {
  const re = new RegExp(`(?<![\\w.])${sig}(?![\\w])`, 'g');
  return re.test(blockText);
}

/** 所有分支都赋值了吗？粗判：统计 if 无 else、case 无 default */
function checkCompleteAssignment(blockText) {
  const issues = [];
  // if 没有 else
  const ifRe = /\bif\s*\(/g;
  let m;
  while ((m = ifRe.exec(blockText))) {
    let i = m.index + m[0].length - 1;
    let d = 0;
    for (; i < blockText.length; i++) {
      if (blockText[i] === '(') d++;
      else if (blockText[i] === ')') { d--; if (d === 0) { i++; break; } }
    }
    const rest = blockText.slice(i).replace(/^\s+/, '');
    if (/^begin\b/.test(rest)) {
      let dd = 0;
      let k = 0;
      let endIdx = rest.length;
      for (k = 0; k < rest.length; k++) {
        if (/^begin\b/.test(rest.slice(k, k + 6))) dd++;
        else if (/^end\b/.test(rest.slice(k, k + 4))) { dd--; if (dd === 0) { endIdx = k + 3; break; } }
      }
      const after = rest.slice(endIdx).replace(/^\s+/, '');
      if (!/^else\b/.test(after)) issues.push('if-no-else');
    } else {
      const stmtEnd = rest.indexOf(';');
      const after = stmtEnd >= 0 ? rest.slice(stmtEnd + 1).replace(/^\s+/, '') : '';
      if (!/^else\b/.test(after)) issues.push('if-no-else');
    }
  }
  if (/\bcase\s*\(/.test(blockText) && !/\bdefault\s*:/.test(blockText)) issues.push('case-no-default');
  return issues;
}

function lint(code, opts = {}) {
  const o = { ...DEFAULT_OPTS, ...opts };
  const issues = [];
  const add = (sev, line, msg) => issues.push({ sev, line, msg });
  const src = stripComments(code);

  if (!src.trim()) {
    add('error', 1, '代码是空的。先写 module ... endmodule 骨架。');
    return issues;
  }

  // 1. 基本配对
  const pairs = [
    [/\bmodule\b/g, /\bendmodule\b/g, 'module / endmodule'],
    [/\bbegin\b/g, /\bend\b/g, 'begin / end'],
    [/\bcase[xz]?\s*\(/g, /\bendcase\b/g, 'case / endcase'],
    [/\bprimitive\b/g, /\bendprimitive\b/g, 'primitive / endprimitive'],
    [/\btable\b/g, /\bendtable\b/g, 'table / endtable'],
    [/\bfunction\b/g, /\bendfunction\b/g, 'function / endfunction'],
    [/\btask\b/g, /\bendtask\b/g, 'task / endtask'],
  ];
  for (const [a, b, name] of pairs) {
    const na = (src.match(a) || []).length;
    const nb = (src.match(b) || []).length;
    if (na !== nb) add('error', 1, `${name} 数量不匹配：前面出现 ${na} 次，后面出现 ${nb} 次（检查是否有漏写或重复）。`);
  }
  const openP = (src.match(/\(/g) || []).length;
  const closeP = (src.match(/\)/g) || []).length;
  if (openP !== closeP) add('error', 1, `圆括号不配对：左括号 ${openP} 个，右括号 ${closeP} 个。`);

  // 2. always 敏感表
  const blocks = extractBlocks(src);
  for (const b of blocks) {
    if (b.kind === 'always' && b.hasAt && !b.sens) add('error', b.line, 'always 的敏感表为空。');
    if (b.kind === 'always' && b.hasAt && b.sens) {
      const isEdge = /posedge|negedge/.test(b.sens);
      if (/@\s*\(\s*\*\s*\)|@\s*\*/.test(src.slice(b.start, b.start + 40))) {
        if (/<=\s*/.test(b.text) && !isEdge) {
          // 组合块里出现非阻塞赋值
          if (!o.allowBlockingInCode) add('warn', b.line, '组合块 always @(*) 里出现了非阻塞赋值 <=。组合逻辑用阻塞赋值 = 更稳妥（可综合，但容易掩盖锁存器）。');
        }
      }
      if (isEdge) {
        const resetName = /(\w*n)(?![a-z])/i.test(b.sens.match(/(?:posedge|negedge)\s+(\w+)/g)?.join(' ') || '');
        if (o.requireAsyncReset && !/(posedge|negedge)\s+\w*(rst|reset|clr)/i.test(b.sens)) {
          add('error', b.line, '题目要求异步复位，但敏感表里没有复位信号（应写成 always @(posedge clk or negedge rst_n)）。');
        }
        if (o.requireSyncReset && /(posedge|negedge)\s+\w*(rst|reset|clr)/i.test(b.sens)) {
          add('error', b.line, '题目要求同步复位，但敏感表里不应出现复位信号（只写 always @(posedge clk)）。');
        }
        // 时序块使用阻塞赋值
        if (/'[^']*'/.test(b.text)) { /* 常量里的位宽不算 */ }
        const blocking = /(?<![<>=!~&|^+\-*/])\b(\w+)\s*(?:\[[^\]]*\])?\s*=(?![=>])/g;
        let m;
        const seen = new Set();
        while ((m = blocking.exec(b.text))) {
          if (KEYWORDS.has(m[1])) continue;
          if (seen.has(m[1])) continue;
          seen.add(m[1]);
          if (!o.allowBlockingInCode) {
            add('warn', b.line, `时序块里出现了阻塞赋值 "${m[1]} = ..."。时序逻辑应使用非阻塞赋值 <=，否则同一时钟沿的寄存器会互相看到新值。`);
            break;
          }
        }
      }
    }
  }

  // 3. 组合块完整赋值 -> 锁存器
  for (const b of blocks) {
    if (b.kind !== 'always') continue;
    if (b.hasAt && b.sens && /posedge|negedge/.test(b.sens)) continue; // 时序块
    const targets = assignedTargets(b.text);
    if (!targets.length) continue;
    const face = checkCompleteAssignment(b.text);
    if (!face.length) continue;
    // 判断这些目标是否在块开头就被给了默认值
    const lines = b.text.split('\n');
    const defaults = new Set();
    for (const l of lines) {
      const mm = l.match(/^\s*(\w+)\s*(?:\[[^\]]*\])?\s*(?:<=|[^=<>!]=)\s*[^=]/);
      if (mm) defaults.add(mm[1]);
      if (/\b(if|case|else)\b/.test(l)) break;
    }
    const missing = targets.filter((t) => !defaults.has(t));
    if (face.includes('if-no-else') || face.includes('case-no-default')) {
      const where = face.includes('case-no-default') ? 'case 缺少 default 分支' : 'if 语句缺少 else 分支';
      if (missing.length) {
        add('warn', b.line, `组合 always 块里 ${where}，而 ${missing.join('、')} 又没有在块首赋默认值 —— 综合工具很可能推断出锁存器（latch）。建议块首先赋默认值，或补齐所有分支。`);
      } else {
        add('info', b.line, `组合 always 块里 ${where}。如果块首已经给所有输出赋了默认值可以忽略；否则会推断锁存器。`);
      }
    }
  }

  // 4. 声明与赋值方式（wire / reg）
  const declared = {};
  const regRe = /\breg\b\s*(\[[^\]]*\])?\s*([^;]+);/g;
  let m;
  while ((m = regRe.exec(src))) {
    for (const n of m[2].split(',')) {
      const name = n.trim().split(/[\s=\[]/)[0];
      if (name) declared[name] = 'reg';
    }
  }
  // ANSI 端口写法：output reg
  const outRegRe = /\boutput\s+(?:reg|logic)\b\s*(\[[^\]]*\])?\s*([^;,\)]+)/g;
  while ((m = outRegRe.exec(src))) {
    for (const n of m[2].split(',')) {
      const name = n.trim().split(/[\s=\[]/)[0];
      if (name) declared[name] = 'reg';
    }
  }
  const outRe = /\boutput\s+(?:wire\b\s*)?(\[[^\]]*\])?\s*([^;,\)]+)/g;
  while ((m = outRe.exec(src))) {
    for (const n of m[2].split(',')) {
      const name = n.trim().split(/[\s=\[]/)[0];
      if (name && !declared[name]) declared[name] = 'output';
    }
  }
  const wireRe = /\b(?:wire|tri)\b\s*(\[[^\]]*\])?\s*([^;]+);/g;
  while ((m = wireRe.exec(src))) {
    for (const n of m[2].split(',')) {
      const name = n.trim().split(/[\s=\[]/)[0];
      if (name) declared[name] = 'wire';
    }
  }
  // assign 左值是 wire；若被声明成 reg 报错
  const assignRe = /\bassign\b\s*([^=]+)=(?!=)/g;
  while ((m = assignRe.exec(src))) {
    const lhs = m[1].trim();
    const nameMatch = lhs.match(/(\w+)\s*(\[[^\]]*\])?$/);
    if (nameMatch) {
      const name = nameMatch[1];
      if (declared[name] === 'reg') {
        add('error', lineOf(src, m.index), `"${name}" 被声明成了 reg，但 assign 的左值必须是 wire（net 类型）。改成 wire，或把逻辑写进 always 块。`);
      }
    }
  }
  // always 里给 input 端口赋值
  const inputNames = new Set();
  const inRe = /\binput\b\s*(?:wire\b\s*)?(\[[^\]]*\])?\s*([^;,\)]+)/g;
  while ((m = inRe.exec(src))) {
    for (const n of m[2].split(',')) {
      const name = n.trim().split(/[\s=\[]/)[0];
      if (name) inputNames.add(name);
    }
  }
  for (const b of blocks) {
    for (const t of assignedTargets(b.text)) {
      if (inputNames.has(t)) add('error', lineOf(src, b.start), `在过程块里给输入端口 "${t}" 赋值了。输入端口只能由外部驱动，不能作为过程赋值的左值。`);
    }
  }
  // 在 always 里赋值但声明为 wire（且不是在 always 里声明）
  for (const b of blocks) {
    for (const t of assignedTargets(b.text)) {
      if (declared[t] === 'wire') add('error', lineOf(src, b.start), `"${t}" 在 always 块里被赋值，但声明成了 wire。过程赋值的左值必须声明为 reg。`);
      if (declared[t] === 'output') add('error', lineOf(src, b.start), `"${t}" 在 always 块里被赋值，输出端口必须声明为 output reg。`);
    }
  }

  // 5. 位宽检查：拼接中的无位宽数字
  const concatRe = /\{([^{}]*)\}/g;
  while ((m = concatRe.exec(src))) {
    if (/^\s*\d+\s*\{/.test(m[1])) continue; // 重复拼接 {N{...}} 外层
    const parts = m[1].split(',');
    if (parts.length < 2) continue;
    for (const p of parts) {
      const t = p.trim();
      if (/^\d+$/.test(t) && !/^[01]$/.test(t)) {
        add('warn', lineOf(src, m.index), `拼接运算符里有不带位宽的数字 "${t}"。Verilog 会把它当成 32 位整数，结果宽度会超出预期；应写成 1'b0 / 4'd9 这种带位宽的形式。`);
      } else if (/^\d*b[01xz]+$/i.test(t)) {
        add('warn', lineOf(src, m.index), `拼接里 "${t}" 没有写位宽，默认按 32 位处理，务必写成 N'bxxx 的形式（例如 3'b101）。`);
      }
    }
  }
  // 宽度不匹配的三元表达式/赋值（只在题目给出端口位宽时检查）
  if (o.ports) {
    for (const [name, w] of Object.entries(o.ports)) {
      const re = new RegExp(`\\b${name}\\s*(?:\\([^)]*\\))?\\s*(?:<=|=(?!=))\\s*([^;]+);`, 'g');
      const mm = re.exec(src);
      if (!mm) continue;
      const rhs = mm[1].trim();
      const bm = rhs.match(/^(\d+)'([bBhHdDoO])/);
      if (bm) {
        const bw = parseInt(bm[1], 10);
        if (/[bB]/.test(bm[2]) && bw !== w) {
          add('warn', lineOf(src, mm.index), `给 ${name}（${w} 位）赋了一个 ${bw} 位的常量 ${rhs.split(/\s/)[0]}，位宽不一致会导致截断或补零。`);
        }
      }
    }
    // {cout, sum} = a + b + cin 这类：检查拼接宽度与操作数宽度
    const addCat = /\{([^{}]+)\}\s*=\s*([^;]+);/g;
    while ((m = addCat.exec(src))) {
      const lhsParts = m[1].split(',').map((s) => s.trim());
      const rhsParts = m[2].split('+').map((s) => s.trim());
      const widths = lhsParts.map((p) => o.ports[p]);
      if (widths.some((w) => w === undefined)) continue;
      const total = widths.reduce((a, b) => a + b, 0);
      const rhsW = rhsParts.map((p) => o.ports[p]).filter((w) => w !== undefined);
      if (rhsW.length === rhsParts.length && rhsW.length) {
        const maxRhs = Math.max(...rhsW);
        if (total !== maxRhs + 1) {
          add('warn', lineOf(src, m.index), `{${lhsParts.join(', ')}} 共 ${total} 位，而右侧加法运算结果宽 ${maxRhs} 位。Verilog 在赋值时才扩展，所以进位会被“截掉”——别忘了加 1 位给溢出（或用 {cout, sum} 接收）。`);
        }
      }
    }
  }

  // 6. 常见笔误
  if (/;\s*;/.test(src)) add('warn', 1, '出现了多余的空语句 ";;"。');
  if (/\bcase\s*\([^)]*\)[^;]*\bendcase\b/.test(src) && !/\bdefault\b/.test(src) && !o.isUdp) {
    const lineNo = lineOf(src, src.search(/\bcase\s*\(/));
    add('warn', lineNo, 'case 语句没有 default 分支。组合逻辑里会推断锁存器，状态机里非法状态无法恢复。');
  }
  if (/\boutput\b[^;]*\breg\b/.test(src) === false && /\balways\b/.test(src) && /\(\s*output\s+\w+\s+[^;]*\)/.test(src) && hasAlwaysAssigningOutput(src)) {
    // 由第 4 段处理，不重复
  }
  if (o.requireAlwaysStar === 'combinational' && /always\s*@\s*\(/.test(src) && !/always\s*@\s*\(\s*\*\s*\)/.test(src) && !/posedge|negedge/.test(src)) {
    add('warn', 1, '组合逻辑建议写成 always @(*)，自动收集敏感信号，避免漏写信号导致仿真与综合不一致。');
  }
  if (o.isUdp) {
    // UDP 专项检查
    if (!/\boutput\b/.test(src)) add('error', 1, 'UDP 必须声明 output。');
    const outs = (src.match(/^\s*output\b/gm) || []).length;
    if (outs > 1) add('error', 1, 'UDP 只能有一个输出端口。');
    if (/\binitial\b|\balways\b/.test(src)) add('error', 1, 'UDP 里不能写 always/initial，只能写 table。');
    const tableBody = (src.match(/\btable\b([\s\S]*?)\bendtable\b/) || [])[1];
    if (tableBody) {
      const rows = tableBody.split(/;/).map((s) => s.trim()).filter(Boolean);
      for (const r of rows) {
        if (!r.includes(':')) {
          add('error', lineOf(src, src.indexOf(r.slice(0, 8))), `UDP 表格行 "${r.slice(0, 30)}" 缺少冒号 ":"（输入与输出之间必须用冒号分隔）。`);
        }
        if (!/[01xX?*]/.test(r)) add('warn', lineOf(src, src.indexOf(r.slice(0, 8))), `表格行 "${r.slice(0, 30)}" 看起来不含合法的输入符号（0 1 x ? -）。`);
      }
      if (!/;\s*$/.test(tableBody.trim())) add('error', 1, 'UDP 表格的最后一行缺少分号 ";"。');
    } else if (!o.expectNoTable) {
      add('error', 1, 'UDP 必须有 table ... endtable 结构。');
    }
  }
  // 位宽与复位极性（只在明确要求时）
  if (o.resetPolarity === 'low' && /\brst\b/.test(src) === false && o.requireAsyncReset) {
    // 题目用 rst_n，未出现 rst_n 时提示
    if (!/rst_n/.test(src)) add('info', 1, '题目约定低有效复位信号 rst_n，未检测到这个信号名。');
  }
  if (o.requireSpecify) {
    if (!/\bspecify\b/.test(src)) add('error', 1, '题目要求使用 specify 块描述路径延迟，但没有找到 specify ... endspecify。');
    else if (!/\*\s*>/.test(src)) add('error', 1, 'specify 块里没有找到路径延迟写法 (输入 *> 输出) = 延迟;');
  }
  if (o.requireFsm) {
    const hasCase = /\bcase\s*\(/.test(src) && /\bendcase\b/.test(src);
    const hasEdge = /posedge|negedge/.test(src);
    if (!hasCase) add('error', 1, '题目要求用三段式/状态机实现，但没有找到 case 语句写的次态逻辑。');
    if (!hasEdge) add('error', 1, '状态机里没有时钟沿触发的状态寄存器（posedge clk）。');
    if (hasCase && !/\bdefault\s*:/.test(src)) add('error', 1, 'FSM 的 case 缺少 default 分支：非法状态无法恢复。');
  }
  return issues;
}

function hasAlwaysAssigningOutput(src) {
  return /\balways\b[\s\S]*?=\s*[^=;]+;/.test(src);
}

module.exports = { lint, stripComments, lineOf, extractBlocks };