'use strict';
module.exports = {
  chapter: 'ch12',
  title: '用户自定义原语 UDP',
  tag: '第 12 章',
  group: '教材',
  problems: [
    {
      id: 'c12_p01',
      title: '写一个组合 UDP：二输入 MUX',
      type: 'write',
      difficulty: 2,
      tags: ['UDP', 'table', '?'],
      brief: 'UDP 表格格式最易出错',
      desc: `用 \`primitive\` 定义二输入 MUX 的 UDP：

- 输出 \`y\`，输入 \`a, b, sel\`，即 \`y = sel ? b : a\`
- **必须使用 \`?\` 无关项来压缩真值表**（不允许把 8 行全写出来）
- 表格列顺序必须与端口声明顺序一致

> 端口顺序建议：\`udp_mux2 (y, a, b, sel)\`，输出在最前。`,
      files: [
        {
          name: 'udp_mux2.v',
          content: `primitive udp_mux2 (y, a, b, sel);
    output y;
    input  a, b, sel;

    table
        // TODO: 用 ? 压缩，写出全部 0/1 情况（不要写 x 行也能过功能测试）


    endtable
endprimitive
`,
        },
      ],
      tests: [{ tb: 'udp_mux2' }],
      solution: `primitive udp_mux2 (y, a, b, sel);
    output y;
    input  a, b, sel;

    table
    // a b sel : y
       0  ?  0  : 0;
       1  ?  0  : 1;
       ?  0  1  : 0;
       ?  1  1  : 1;
    endtable
endprimitive
`,
      lint: { isUdp: true },
      keyPoints: [
        '一个 UDP 只能有一个输出。',
        '表格每行：输入列 + ":" + 输出列 + ";"',
        '? 表示无关位，化简真值表。',
      ],
    },
    {
      id: 'c12_p02',
      title: 'UDP 规范检查',
      type: 'quiz',
      difficulty: 2,
      tags: ['UDP', 'table'],
      brief: '第 12 章例题变式',
      desc: '关于 UDP 的规定与书写规则。',
      quiz: {
        questions: [
          { q: '一个 UDP 有多个输出端口', options: ['合法，可以有任意个', '不合法，只能有一个输出', '只能有 2 个输出', '取决于输入个数'], answer: 1, why: 'UDP 只有一个输出端口，可以有多个输入。' },
          { q: '时序 UDP 的输出需要声明为', options: ['wire', 'reg', 'integer', '不能声明'], answer: 1, why: '时序 UDP 需要保存内部状态，输出必须声明为 reg。' },
          { q: 'UDP 表格列顺序', options: ['可以任意', '必须和端口声明顺序一致', '必须是输出第一', '只按名字匹配'], answer: 1, why: '按位置，不是按名字。' },
          { q: '`?` 在 UDP 表格中表示', options: ['未知值', '高阻', '无关项（可用于化简）', '非法'], answer: 2, why: '? 可匹配 0、1、x 等，用来压缩真值表。' },
          { q: 'UDP 中能写 always 块吗', options: ['可以', '不可以，只能写 table', '可以但要加延时', '只要在组合 UDP 里就可以'], answer: 1, why: 'UDP 里只能写 table/endtable。' },
          { q: '时序 UDP 的表格第一行通常是', options: ['输出值', '初始状态行（如 ? : ?）', '延时', '例化语句'], answer: 1, why: '时序 UDP 需要初始状态。' },
        ],
      },
      keyPoints: ['一个输出、多个输入；表格列顺序、冒号、分号；? 化简。'],
    },
  ],
};