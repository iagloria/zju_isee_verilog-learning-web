'use strict';
/*
 * 第 6 章：数据流建模
 */
module.exports = {
  chapter: 'ch06',
  title: '数据流建模',
  tag: '第 6 章',
  group: '教材',
  problems: [
    {
      id: 'c06_p01',
      title: '数据流实现 4 选 1 MUX（带使能，无效输出 0）',
      type: 'write',
      difficulty: 2,
      tags: ['assign', 'MUX', '条件运算符'],
      brief: 'assign + 三目运算符',
      desc: `实现 8 位 4 选 1 多路选择器：

- \`en\` 低有效（\`en_n = 0\` 时工作）；
- 使能有效时 \`y\` 由 \`sel\` 选择 \`in0 ~ in3\`；
- 使能无效时 \`y = 8'h00\`。

**要求**：使用 \`assign\`（数据流建模）。可以用三目运算符嵌套，也可以用 \`& |\` 与门-或门结构。`,
      files: [
        {
          name: 'mux4_df.v',
          content: `module mux4_df (
    input  wire [7:0] in0,
    input  wire [7:0] in1,
    input  wire [7:0] in2,
    input  wire [7:0] in3,
    input  wire [1:0] sel,
    input  wire       en_n,
    output wire [7:0] y
);
    // TODO: 用 assign 实现

endmodule
`,
        },
      ],
      tests: [{ tb: 'mux4_df' }],
      solution: `module mux4_df (
    input  wire [7:0] in0,
    input  wire [7:0] in1,
    input  wire [7:0] in2,
    input  wire [7:0] in3,
    input  wire [1:0] sel,
    input  wire       en_n,
    output wire [7:0] y
);
    wire [7:0] mux_out;
    assign mux_out = sel[1] ? (sel[0] ? in3 : in2)
                            : (sel[0] ? in1 : in0);
    assign y = en_n ? 8'h00 : mux_out;
endmodule
`,
      wave: () => `\`timescale 1ns/1ps\n
module __vlab_wave;
  reg  [7:0] in0 = 8'h11, in1 = 8'h22, in2 = 8'h33, in3 = 8'h44;
  reg  [1:0] sel;
  reg        en_n;
  wire [7:0] y;
  integer k;
  mux4_df dut (.in0(in0), .in1(in1), .in2(in2), .in3(in3), .sel(sel), .en_n(en_n), .y(y));
  initial begin
    for (k = 0; k < 8; k = k + 1) begin
      {en_n, sel} = k[2:0];
      #1 $display("[WAVE]y.bin=%b", y);
    end
    $finish;
  end
endmodule\n`,
      keyPoints: [
        '三目运算符嵌套就是 MUX 级联，最外层就是优先级最高的一级选择。',
        '使能处理放在最外层最直观：assign y = en_n ? 8\'h00 : mux_out;',
      ],
    },
    {
      id: 'c06_p02',
      title: '中间变量全加器',
      type: 'write',
      difficulty: 2,
      tags: ['assign', '全加器', '中间信号'],
      brief: '期末“精巧代码题”的原型',
      desc: `这是复习文档里重点提到的“中间变量全加器”：先算两个半加器的中间结果，再合成最终结果。

请补全 5 条 \`assign\`：

| 信号 | 含义 |
|---|---|
| \`p\` | a、b 的异或（传播项 propagate）|
| \`g\` | a、b 的与（产生项 generate）|
| \`sum\` | 第二个半加器的和 |
| \`c2\` | 第二个半加器产生的进位 |
| \`cout\` | 两个进位来源的或 |`,
      files: [
        {
          name: 'fa_mid.v',
          content: `module fa_mid (
    input  wire a,
    input  wire b,
    input  wire cin,
    output wire sum,
    output wire cout
);
    wire p, g, c2;

    // TODO: 第一级半加器

    // TODO: 第二级半加器

    // TODO: 进位合并

endmodule
`,
        },
      ],
      tests: [{ tb: 'fa_mid' }],
      solution: `module fa_mid (
    input  wire a,
    input  wire b,
    input  wire cin,
    output wire sum,
    output wire cout
);
    wire p, g, c2;

    assign p = a ^ b;
    assign g = a & b;

    assign sum = p ^ cin;
    assign c2  = p & cin;

    assign cout = g | c2;
endmodule
`,
      keyPoints: ['sum = p ^ cin，cout = g | (p & cin)，这就是两个半加器级联。'],
    },
    {
      id: 'c06_p03',
      title: '缩减运算：全 1 检测与奇偶校验',
      type: 'write',
      difficulty: 1,
      tags: ['缩减运算', '&a', '^a'],
      brief: '=& 和 =^ 的典型用法',
      desc: `对 8 位输入 \`din\`：

- \`all_one\`：din 全 1 时为 1；
- \`parity\`：din 中 1 的个数为奇数时为 1（即所有位异或的结果）；
- \`any_one\`：至少有一位为 1 时为 1。

**要求**：只能使用缩减运算符（\`&\`、\`|\`、\`^\`），不得写成循环或逐位相与。`,
      files: [
        {
          name: 'reduce.v',
          content: `module reduce (
    input  wire [7:0] din,
    output wire       all_one,
    output wire       parity,
    output wire       any_one
);
    // TODO: 三条 assign，各用一个缩减运算符

endmodule
`,
        },
      ],
      tests: [{ tb: 'reduce' }],
      solution: `module reduce (
    input  wire [7:0] din,
    output wire       all_one,
    output wire       parity,
    output wire       any_one
);
    assign all_one = &din;
    assign parity  = ^din;
    assign any_one = |din;
endmodule
`,
      keyPoints: ['缩减运算符把整个向量压成 1 位，不需要写循环。', '&q 常用于计数器溢出检测。'],
    },
    {
      id: 'c06_p04',
      title: '找错：位宽不够导致进位丢失',
      type: 'bug',
      difficulty: 2,
      tags: ['位宽', '进位', 'assign'],
      brief: '编译通过、功能错——最坑的一类错误',
      desc: `下面代码想把两个 8 位数相加，并输出进位。它编译完全正常，但 **cout 永远是 0**。请找出原因并修复。

> 想想：Verilog 在计算 \`a + b\` 时，结果的位宽是多少？是在哪一步扩展的？`,
      files: [
        {
          name: 'add8_bug.v',
          content: `module add8_bug (
    input  wire [7:0] a,
    input  wire [7:0] b,
    output wire [7:0] sum,
    output wire       cout
);
    assign sum  = a + b;
    assign cout = (a + b) >> 8;
endmodule
`,
        },
      ],
      tests: [{ tb: 'add8_bug' }],
      solution: `module add8_bug (
    input  wire [7:0] a,
    input  wire [7:0] b,
    output wire [7:0] sum,
    output wire       cout
);
    assign {cout, sum} = a + b;
endmodule
`,
      keyPoints: [
        'a + b 的结果位宽 = max(操作数位宽) = 8 位，进位在加法器内部就已经溢出丢失了。',
        '(a+b) >> 8 移的是已经截断的 8 位结果，恒为 0。',
        '正确做法：先用 9 位接收 ({cout, sum} = a + b)，或显式扩展 {1\'b0,a} + {1\'b0,b}。',
      ],
    },
    {
      id: 'c06_p05',
      title: '资源分享：两个加法器还是一个？',
      type: 'quiz',
      difficulty: 2,
      tags: ['资源共享', '综合', '关键路径'],
      brief: '综合结果分析',
      desc: '阅读下面两段组合逻辑，回答问题。\n\n```verilog\n// 版本 A\nif (sel) y = b + c;\nelse     y = b + d;\n\n// 版本 B\ny = b + (sel ? c : d);\n```',
      quiz: {
        questions: [
          { q: '综合后的硬件结构', options: ['A 一个加法器 + 一个 MUX，B 两个加法器', 'A 两个加法器，B 一个 MUX + 一个加法器', 'A、B 都是两个加法器', 'A、B 都是一个加法器'], answer: 1, why: 'A 的两个分支各自需要一个加法器（综合器一般不会自动共享）；B 先选再算，只需一个加法器。' },
          { q: 'B 的代价是', options: ['面积一定更小，没有代价', '多一级 MUX，关键路径可能变长', '不能用 assign 实现', '不能综合'], answer: 1, why: '资源共享换来面积下降，但数据要先过 MUX 再进加法器，路径变长。' },
          { q: '这种优化叫什么', options: ['流水线', '资源共享（resource sharing）', '时钟门控', '寄存器重定时'], answer: 1, why: '用同一份硬件在不同时间处理不同数据，就是资源共享。' },
        ],
      },
      keyPoints: ['面积与速度的权衡是综合题的经典考点。', '条件里套运算（版本 B）更容易被综合器识别成共享。'],
    },
  ],
};