'use strict';
/* 把「文本输出 + 题号」量化成测试分组（供 cli.js 与 judge.js 共用） */
function groupBlocks(out) {
  const blocks = [];
  let cur = null;
  for (const line of (out || '').split('\n')) {
    if (line.startsWith('[CHECK]')) {
      if (!cur) { cur = { checks: [] }; blocks.push(cur); }
      const v = line.slice(7).trim();
      cur.checks.push({ res: v.slice(0, 1), value: v.slice(1).trim() });
    } else if (/^\[VEC\]|^\[SEQ\]|^\[STEP\]|^\[CASE\]|^\[BUS\]|^\[SIM\]/.test(line)) {
      cur = { checks: [] };
      blocks.push(cur);
    }
  }
  return blocks.filter((b) => b.checks.length);
}

function quantifyText(out, show) {
  const blocks = groupBlocks(out);
  if (!blocks.length) {
    return [{
      name: '仿真', passed: false, total: 1, pass: 0, maybe: 0, fail: 1,
      checks: [{ res: 'F', value: '没有产生任何检查结果：可能卡死（死循环 / 时钟没产生），或者仿真没有跑到 $finish。' }],
    }];
  }
  return blocks.map((b, i) => {
    const fail = b.checks.filter((c) => c.res === 'F').length;
    const maybe = b.checks.filter((c) => c.res === 'M').length;
    const pass = b.checks.filter((c) => c.res === 'P').length;
    return {
      name: blocks.length > 1 ? `第 ${i + 1} 组` : '整组测试',
      passed: fail === 0, total: b.checks.length, pass, fail, maybe,
      checks: show ? b.checks : b.checks.filter((c) => c.res !== 'P').slice(0, 12),
    };
  });
}

module.exports = { groupBlocks, quantifyText };