'use strict';
/*
 * 第 7 章：行为级建模（组合逻辑）
 */
module.exports = {
  chapter: 'ch07',
  title: '行为级建模 · 组合逻辑',
  tag: '第 7 章',
  group: '教材',
  problems: [
    {
      id: 'c07_p01',
      title: '8 位优先编码器（避免锁存器）',
      type: 'write',
      difficulty: 2,
      tags: ['always @(*)', 'if-else', '锁存器'],
      brief: '组合逻辑完整赋值的经典题',
      desc: `实现 8 位优先编码器，\`in[7]\` 优先级最高：

| in | code | valid |
|---|---|---|
| in[7]=1 | 3'd7 | 1 |
| in[6]=1 | 3'd6 | 1 |
| … | … | 1 |
| 只有 in[0]=1 | 3'd0 | 1 |
| 全 0 | 3'd0 | 0 |

**要求**：\`always @(*)\` + \`if-else\`，输出必须声明为 \`reg\`，且**所有分支都要给 code 和 valid 赋值**，不要推断出锁存器。`,
      files: [
        {
          name: 'pri_enc8.v',
          content: `module pri_enc8 (
    input  wire [7:0] in,
    output reg  [2:0] code,
    output reg        valid
);
    // TODO: always @(*) ...


endmodule
`,
        },
      ],
      tests: [{ tb: 'pri_enc8' }],
      solution: `module pri_enc8 (
    input  wire [7:0] in,
    output reg  [2:0] code,
    output reg        valid
);
    always @(*) begin
        code  = 3'd0;
        valid = 1'b1;
        if      (in[7]) code = 3'd7;
        else if (in[6]) code = 3'd6;
        else if (in[5]) code = 3'd5;
        else if (in[4]) code = 3'd4;
        else if (in[3]) code = 3'd3;
        else if (in[2]) code = 3'd2;
        else if (in[1]) code = 3'd1;
        else if (in[0]) code = 3'd0;
        else            valid = 1'b0;
    end
endmodule
`,
      keyPoints: [
        '块首先给默认值，后面只覆盖特殊情况 —— 保证任何路径都有赋值。',
        'if-else 的先后顺序就是优先级：排在前面的 if 优先。',
      ],
    },
    {
      id: 'c07_p02',
      title: '找错：推断出锁存器',
      type: 'bug',
      difficulty: 2,
      tags: ['锁存器', 'if-else', '组合逻辑'],
      brief: '少写一个 else 的代价',
      desc: `下面代码想做“使能时输出 d，否则输出 0”，综合却会**推断出锁存器**（latch）。

仿真跑一遍会看到错误结果。请找出问题并修复，**保留 reg 输出和 always @(*)** 的写法。`,
      files: [
        {
          name: 'latch_bug.v',
          content: `module latch_bug (
    input  wire       en,
    input  wire [7:0] d,
    output reg  [7:0] q
);
    always @(*) begin
        if (en)
            q = d;
    end
endmodule
`,
        },
      ],
      tests: [{ tb: 'latch_bug' }],
      solution: `module latch_bug (
    input  wire       en,
    input  wire [7:0] d,
    output reg  [7:0] q
);
    always @(*) begin
        q = 8'h00;      // 默认值：任何路径都有赋值
        if (en)
            q = d;
    end
endmodule
`,
      keyPoints: [
        '组合逻辑里“不赋值 = 保持旧值”，硬件上只能用锁存器实现 → 推断锁存器。',
        '两种改法：块首赋默认值，或补全 else 分支。',
        '时序逻辑里的不赋值反而正是“保持”的意思，是正常的。',
      ],
    },
    {
      id: 'c07_p03',
      title: 'case 实现 ALU',
      type: 'write',
      difficulty: 2,
      tags: ['case', 'default', 'ALU'],
      brief: 'case 语句 + 默认分支',
      desc: `实现 4 种运算的 8 位 ALU（\`op\` 为操作码）：

| op | y |
|---|---|
| 2'b00 | a + b |
| 2'b01 | a - b |
| 2'b10 | a & b |
| 2'b11 | a \| b |

**要求**：必须使用 \`case\` 语句并带 \`default\` 分支。`,
      files: [
        {
          name: 'alu8.v',
          content: `module alu8 (
    input  wire [7:0] a,
    input  wire [7:0] b,
    input  wire [1:0] op,
    output reg  [7:0] y
);
    // TODO: always @(*)

endmodule
`,
        },
      ],
      tests: [{ tb: 'alu8' }],
      solution: `module alu8 (
    input  wire [7:0] a,
    input  wire [7:0] b,
    input  wire [1:0] op,
    output reg  [7:0] y
);
    always @(*) begin
        case (op)
            2'b00: y = a + b;
            2'b01: y = a - b;
            2'b10: y = a & b;
            2'b11: y = a | b;
            default: y = 8'h00;
        endcase
    end
endmodule
`,
      keyPoints: ['case 的每个分支都赋值，再加 default —— 既完整又防非法值。'],
    },
    {
      id: 'c07_p04',
      title: 'for 循环写 8 位奇偶校验',
      type: 'write',
      difficulty: 2,
      tags: ['for', 'integer', '组合逻辑'],
      brief: '过程 for ≠ generate for',
      desc: `用**过程 \`for\` 循环**计算 8 位输入中 1 的个数，输出 4 位计数 \`cnt\`（0~8）。

**要求**：必须使用 \`for\` 循环和 \`integer i\`，不能用缩减运算符一次算完。`,
      files: [
        {
          name: 'popcount8.v',
          content: `module popcount8 (
    input  wire [7:0] din,
    output reg  [3:0] cnt
);
    integer i;
    // TODO: always @(*) + for

endmodule
`,
        },
      ],
      tests: [{ tb: 'popcount8' }],
      solution: `module popcount8 (
    input  wire [7:0] din,
    output reg  [3:0] cnt
);
    integer i;
    always @(*) begin
        cnt = 4'd0;
        for (i = 0; i < 8; i = i + 1) begin
            if (din[i]) cnt = cnt + 1'b1;
        end
    end
endmodule
`,
      keyPoints: [
        '过程 for 在综合时被“展开”成重复的硬件，循环次数必须是常量。',
        '与之相对，generate for 在 elaboration 阶段产生多个实例。',
      ],
    },
    {
      id: 'c07_p05',
      title: 'generate for 参数化位宽反相器',
      type: 'write',
      difficulty: 2,
      tags: ['generate', 'genvar', '参数化'],
      brief: 'N 位反相：逐位例化 not 门',
      desc: `参数化模块 \`inv_n #(WIDTH)\`：用 \`generate for\` 例化 \`WIDTH\` 个 \`not\` 门，\`y[i] = ~a[i]\`。

**要求**：必须用 \`genvar\` + \`generate for\`，并且你的代码要能同时通过 \`WIDTH=4\` 和 \`WIDTH=8\` 两个测试（测试台会用不同参数例化）。`,
      files: [
        {
          name: 'inv_n.v',
          content: `module inv_n #(
    parameter WIDTH = 8
) (
    input  wire [WIDTH-1:0] a,
    output wire [WIDTH-1:0] y
);
    // TODO: genvar + generate for

endmodule
`,
        },
      ],
      tests: [{ tb: 'inv_n', data: ['tb_mut_1.v', 'tb_mut_2.v'] }],
      solution: `module inv_n #(
    parameter WIDTH = 8
) (
    input  wire [WIDTH-1:0] a,
    output wire [WIDTH-1:0] y
);
    genvar i;
    generate
        for (i = 0; i < WIDTH; i = i + 1) begin : gen_inv
            not u_not (y[i], a[i]);
        end
    endgenerate
endmodule
`,
      keyPoints: [
        'generate for 的循环变量用 genvar，且循环体会被展开成多个实例，每个实例需要唯一名字（begin : 名字）。',
        '参数化模块让固定宽度代码变成通用代码。',
      ],
    },
    {
      id: 'c07_p06',
      title: 'begin-end 与 fork-join 的判断',
      type: 'quiz',
      difficulty: 2,
      tags: ['顺序块', '并行块', '初始块'],
      brief: '仿真时间线的理解',
      desc: '阅读下面两段 initial 块，回答时间问题。\n\n```verilog\n// 块 1\ninitial begin\n  #10 a = 1;\n  #20 b = 1;\nend\n\n// 块 2\ninitial fork\n  #10 a = 1;\n  #20 b = 1;\njoin\n```',
      quiz: {
        questions: [
          { q: '块 1 中 b 变为 1 的时刻', options: ['t=10', 't=20', 't=30', 't=40'], answer: 2, why: '顺序块中延时累加：b 在 a 赋值之后再等 20 → t=30。' },
          { q: '块 2 中 b 变为 1 的时刻', options: ['t=10', 't=20', 't=30', 't=40'], answer: 1, why: '并行块中各分支同时启动，两个延时互不累加。' },
          { q: 'fork-join 常用于', options: ['描述寄存器阵列', 'Testbench 中同时产生时钟和激励', '生成块', 'UDP 表格'], answer: 1, why: 'familiar RTL 中很少用 fork-join，主要用于仿真。' },
        ],
      },
      keyPoints: ['顺序块延时累加，并行块延时同时开始。', 'fork-join 属于仿真建模，不作为综合 RTL 的电路结构。'],
    },
  ],
};