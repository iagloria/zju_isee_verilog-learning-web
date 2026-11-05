'use strict';
module.exports = {
  chapter: 'ch04',
  title: '模块、端口与数据类型',
  tag: '第 3–4 章',
  group: '教材',
  problems: [
    {
      id: 'c04_p01',
      title: '4 位加法器：拼接接收进位',
      type: 'write',
      difficulty: 1,
      tags: ['拼接运算符', '位宽', 'assign'],
      brief: '题目已给出端口，你只写 assign',
      desc: `端口已经写好，请补全功能：4 位二进制加法器。

- \`sum = a + b + cin\` 的低 4 位
- \`cout\` 为第 5 位的进位

**要求**：只允许使用 \`assign\`，推荐用拼接运算符一次接收 5 位结果。

> 考试时自己也要会从零写出整个 module，包括端口声明。`,
      files: [
        {
          name: 'add4.v',
          content: `module add4 (
    input  wire [3:0] a,
    input  wire [3:0] b,
    input  wire       cin,
    output wire [3:0] sum,
    output wire       cout
);
    // TODO: 在这里写 assign 语句


endmodule
`,
        },
      ],
      tests: [{ tb: 'add4', data: ['tb_add4.v'] }],
      solution: `module add4 (
    input  wire [3:0] a,
    input  wire [3:0] b,
    input  wire       cin,
    output wire [3:0] sum,
    output wire       cout
);
    assign {cout, sum} = a + b + cin;
endmodule
`,
      lint: { ports: { a: 4, b: 4, cin: 1, sum: 4, cout: 1 } },
      wave: () => `\`timescale 1ns/1ps\n
module __vlab_wave;
  reg  [3:0] a = 4'd4, b = 4'd3;
  reg        cin = 1'b0;
  wire [3:0] sum;
  wire       cout;
  add4 dut (.a(a), .b(b), .cin(cin), .sum(sum), .cout(cout));
  initial begin
    $display("[WAVE]sum.bin=%b cout=%b", sum, cout);
    #1 a = 4'd15; b = 4'd0; cin = 1'b1;
    #1 $display("[WAVE]sum.bin=%b cout=%b", sum, cout);
    $finish;
  end
endmodule\n`,
      keyPoints: [
        '{cout, sum} 是 5 位，正好容纳 a+b+cin 的 5 位结果。',
        '若写成 assign sum = a + b + cin;，进位会被截掉。',
      ],
    },
    {
      id: 'c04_p02',
      title: '找错：assign 的左值写成了 reg',
      type: 'bug',
      difficulty: 1,
      tags: ['wire', 'reg'],
      brief: '最基础的语法错误',
      desc: `下面的代码想实现 \`y = a & b\`，但编译不过。运行一次看看编译器怎么说，然后修好它。

> 改一个即可：要么改声明，要么改写法。`,
      files: [
        {
          name: 'and_gate.v',
          content: `module and_gate (
    input  wire a,
    input  wire b,
    output reg  y
);
    assign y = a & b;
endmodule
`,
        },
      ],
      tests: [{ tb: 'and_gate' }],
      solution: `module and_gate (
    input  wire a,
    input  wire b,
    output wire y
);
    assign y = a & b;
endmodule
`,
      keyPoints: ['assign 驱动的信号必须是 wire（net）。', '另一种改法：保留 output reg，写成 always @(*) y = a & b;'],
    },
    {
      id: 'c04_p03',
      title: '符号扩展与零扩展',
      type: 'write',
      difficulty: 2,
      tags: ['拼接', '复制运算符'],
      brief: '把 4 位补码变成 8 位',
      desc: `把 4 位输入 \`a\` 扩展成 8 位输出 \`y\`：

| signed_mode | 含义 |
|---|---|
| 1 | 符号扩展：高 4 位全等于 a[3] |
| 0 | 零扩展：高 4 位为 0 |

补全 \`assign fill = ...\`。**要求使用复制运算符** \`{N{...}}\`。`,
      files: [
        {
          name: 'sext.v',
          content: `module sext (
    input  wire [3:0] a,
    input  wire       signed_mode,
    output wire [7:0] y
);
    wire [3:0] fill;
    // TODO: signed_mode 为 1 时 fill 取 4 个 a[3]，否则取 4 个 0
    assign fill = 4'b0000;
    assign y = {fill, a};
endmodule
`,
        },
      ],
      tests: [{ tb: 'sext' }],
      solution: `module sext (
    input  wire [3:0] a,
    input  wire       signed_mode,
    output wire [7:0] y
);
    wire [3:0] fill;
    assign fill = {4{signed_mode & a[3]}};
    assign y = {fill, a};
endmodule
`,
      keyPoints: ['{4{x}} 复制 4 份；复制次数必须是常量。', '题目参考文档里的写法是 {{8{value[7]}}, value}。'],
    },
    {
      id: 'c04_p04',
      title: '填空判卷：== 与 ===、& 与 &&',
      type: 'quiz',
      difficulty: 2,
      tags: ['四值逻辑', '运算符'],
      brief: '考试选择题原样练习',
      desc: `已知 \`a = 4'b1x01\`，\`b = 4'b1x01\`。为每个表达式选择结果。`,
      quiz: {
        questions: [
          { q: 'a == b 的值是', options: ['1', '0', 'x', '不合法'], answer: 2, why: '== 遇到含 x 的位，结果可能为 x。' },
          { q: 'a === b 的值是', options: ['1', '0', 'x', '不合法'], answer: 0, why: '=== 把 x、z 也当确定值比较，完全相同→1。' },
          { q: '|a 的值是', options: ['1', '0', 'x', 'z'], answer: 0, why: '缩减或有一位为 1 即 1。' },
          { q: '&a 的值是', options: ['1', '0', 'x', 'z'], answer: 1, why: '有 0 位就一定是 0。' },
          { q: 'a && 1\'b1 的值是', options: ['1', '0', 'x', '4\'b1x01'], answer: 2, why: '逻辑与无法判断含 x 向量是否为真→x。' },
          { q: 'a & 4\'b0000 的值是', options: ['4\'b0000', '1\'b0', '4\'b1x01', 'x'], answer: 0, why: '按位与保持 4 位宽，全部为 0。' },
        ],
      },
      keyPoints: ['==/=== 的区别，& 与 && 的区别是选择题高频点。'],
    },
    {
      id: 'c04_p05',
      title: '名字连接与位置连接',
      type: 'write',
      difficulty: 2,
      tags: ['层次化', '例化'],
      brief: '两种端口连接方式都写一遍',
      desc: `补全顶层 \`top\`：

- \`u_ha0\` 用**名字连接**，接 \`a0, b0 → s0, c0\`
- \`u_ha1\` 用**位置连接**，接 \`a1, b1 → s1, c1\`

子模块 \`half_adder\` 的端口顺序是 \`(a, b, s, c)\`。`,
      files: [
        {
          name: 'top.v',
          content: `module half_adder (
    input  wire a,
    input  wire b,
    output wire s,
    output wire c
);
    assign s = a ^ b;
    assign c = a & b;
endmodule

module top (
    input  wire a0, b0, a1, b1,
    output wire s0, c0, s1, c1
);
    // TODO: 名字连接
    half_adder u_ha0 ();

    // TODO: 位置连接
    half_adder u_ha1 ();
endmodule
`,
        },
      ],
      tests: [{ tb: 'ha_top' }],
      solution: `module half_adder (
    input  wire a,
    input  wire b,
    output wire s,
    output wire c
);
    assign s = a ^ b;
    assign c = a & b;
endmodule

module top (
    input  wire a0, b0, a1, b1,
    output wire s0, c0, s1, c1
);
    half_adder u_ha0 (
        .a(a0), .b(b0), .s(s0), .c(c0)
    );
    half_adder u_ha1 (a1, b1, s1, c1);
endmodule
`,
      keyPoints: ['名字连接 .端口名(信号)，与顺序无关；位置连接按声明顺序，错序不报错但功能错误。'],
    },
  ],
};