'use strict';
/*
 * 第 5 章：门级建模
 */
module.exports = {
  chapter: 'ch05',
  title: '门级建模',
  tag: '第 5 章',
  group: '教材',
  problems: [
    {
      id: 'c05_p01',
      title: '门级实现二选一 MUX',
      type: 'write',
      difficulty: 1,
      tags: ['门原语', 'MUX', '建模方式'],
      brief: 'not / and / or 三个门拼出来',
      desc: `用**门原语**实现 \`y = s ? b : a\`，即 \`y = (~s & a) | (s & b)\`。

题目已给出 \`ns, ya, yb\` 三根中间线，请填好门实例。注意**门实例的端口顺序是输出在前**。

> 三种建模方式考同一道题是常见套路，稍后还会用 assign 和 always 各写一遍。`,
      files: [
        {
          name: 'mux2_gate.v',
          content: `module mux2_gate (
    input  wire a,
    input  wire b,
    input  wire s,
    output wire y
);
    wire ns, ya, yb;

    // TODO: ns = ~s


    // TODO: ya = a & ns


    // TODO: yb = b & s


    // TODO: y = ya | yb


endmodule
`,
        },
      ],
      tests: [{ tb: 'mux2_gate' }],
      solution: `module mux2_gate (
    input  wire a,
    input  wire b,
    input  wire s,
    output wire y
);
    wire ns, ya, yb;

    not u_not (ns, s);
    and u_a   (ya, a, ns);
    and u_b   (yb, b, s);
    or  u_or  (y, ya, yb);
endmodule
`,
      keyPoints: [
        '门实例格式：门名 [实例名] (输出, 输入1, 输入2, ...);',
        '实例名不能省略（考试建议写，且同一层次内唯一）。',
      ],
    },
    {
      id: 'c05_p02',
      title: '找错：门实例端口顺序反了',
      type: 'bug',
      difficulty: 2,
      tags: ['门原语', '端口顺序'],
      brief: '编译能过，但结果全错',
      desc: `下面这段门级代码编译**不会报错**，但仿真的结果不对。请找出并改正。

> 门级例化是**位置连接**，顺序写反了编译器不会提示你。这类错误考试批卷时很难发现，自己写完一定要按“输出在前”检查一遍。`,
      files: [
        {
          name: 'gate_bug.v',
          content: `module gate_bug (
    input  wire a,
    input  wire b,
    output wire y,
    output wire yn
);
    // 想实现 y = a & b, yn = ~(a & b)
    and  u_and (a, b, y);
    nand u_nand (a, b, yn);
endmodule
`,
        },
      ],
      tests: [{ tb: 'gate_bug' }],
      solution: `module gate_bug (
    input  wire a,
    input  wire b,
    output wire y,
    output wire yn
);
    and  u_and  (y, a, b);
    nand u_nand (yn, a, b);
endmodule
`,
      keyPoints: ['门原语端口顺序：输出在前、输入在后。', '写反顺序不报错——这是门级代码最隐蔽的 bug。'],
    },
    {
      id: 'c05_p03',
      title: '三态缓冲器与总线',
      type: 'write',
      difficulty: 2,
      tags: ['三态门', 'bufif1', 'z'],
      brief: '共用一个 inout 总线',
      desc: `一个 8 位双向数据总线 \`bus\`，由两个模块轮流驱动：

- \`en1 = 1\` 时把 \`data1\` 驱动到总线上，否则输出高阻；
- \`en2 = 1\` 时把 \`data2\` 驱动到总线上，否则输出高阻。

**要求**：使用三态门原语 \`bufif1\`（\`bufif1 (out, in, ctrl)\`：ctrl 为 1 时 out = in，否则 out = z），
并且 \`bus\` 声明为 \`inout\`。

> 提示：三态门原语的端口宽度是 1 位，所以要想清楚怎样把它套用到 8 位向量上。
> 注意两个使能同时有效时会发生总线冲突（结果为 x）。` ,
      files: [
        {
          name: 'bus8.v',
          content: `module bus8 (
    input  wire       en1,
    input  wire       en2,
    input  wire [7:0] data1,
    input  wire [7:0] data2,
    inout  wire [7:0] bus
);
    // TODO: 两个 bufif1

endmodule
`,
        },
      ],
      tests: [{ tb: 'bus8' }],
      solution: `module bus8 (
    input  wire       en1,
    input  wire       en2,
    input  wire [7:0] data1,
    input  wire [7:0] data2,
    inout  wire [7:0] bus
);
    genvar i;
    generate
        for (i = 0; i < 8; i = i + 1) begin : gen_drv
            bufif1 u_drv1 (bus[i], data1[i], en1);
            bufif1 u_drv2 (bus[i], data2[i], en2);
        end
    endgenerate
endmodule
`,
      keyPoints: [
        'bufif1 (out, in, ctrl)：控制为 1 时导通；bufif0 相反。',
        'inout 端口必须声明为 wire，多个驱动源同时有效会产生 x。',
      ],
    },
    {
      id: 'c05_p04',
      title: '门延迟：输出何时变化',
      type: 'quiz',
      difficulty: 2,
      tags: ['门延迟', '惯性延时'],
      brief: '延迟模型考点',
      desc: `已知 \`and #(2, 3) u_and (y, a, b);\`，\`a\` 与 \`b\` 都保持 1，\`t=0\` 时 \`y=1\`。

在 \`t=10\` 时 \`a\` 拉低为 0，\`t=11\` 时又拉高回 1。关于 \`y\` 的波形，下列说法正确的是：`,
      quiz: {
        questions: [
          {
            q: 't=10 之后 y 会不会变化？',
            options: ['不会，因为 a 的低电平只持续 1 个时间单位，小于下降延迟 3', '会在 t=13 变成 0', '会在 t=12 变成 0', '会在 t=11 立即变成 0'],
            answer: 0,
            why: '门延迟是惯性延时：脉冲宽度小于延迟会被“滤掉”，不会出现在输出上。',
          },
          {
            q: '若 a 在 t=10 拉低并保持，y 什么时候变为 0？',
            options: ['t=10', 't=12', 't=13', 't=15'],
            answer: 2,
            why: '#(2, 3) 表示上升延迟 2、下降延迟 3：1→0 是下降，延迟 3 → t=13。',
          },
          {
            q: '#(2, 3) 中这两个数的含义是',
            options: ['上升延迟、下降延迟', '下降延迟、上升延迟', '最小延迟、最大延迟', '延时、时钟周期'],
            answer: 0,
            why: '只有一个数时上升下降相同；两个数时先上升后下降。',
          },
          {
            q: '门延迟在综合后',
            options: ['一定等于实际电路延迟', '只是仿真模型，实际延迟由工艺、布线决定', '会被综合成延时单元', '被忽略'],
            answer: 1,
            why: '门延迟只影响仿真；真实延迟来自工艺库、布局布线，可用 SDF 反标。',
          },
        ],
      },
      keyPoints: ['惯性延时能滤除窄脉冲。', '门延迟是仿真模型，不等于物理延迟。'],
    },
  ],
};