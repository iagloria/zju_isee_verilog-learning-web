'use strict';
/*
 * 时序逻辑专项：寄存器、计数器、复位、阻塞/非阻塞
 * 对应第 7 章行为级建模的时序部分，也是考试编程题的主体
 */
module.exports = {
  chapter: 'ch07s',
  testDir: 'ch07seq',
  title: '时序逻辑：寄存器 · 计数器 · 复位',
  tag: '第 7 章 · 时序',
  group: '重点专题',
  problems: [
    {
      id: 'c07s_p01',
      title: '带异步复位和使能的 8 位寄存器',
      type: 'write',
      difficulty: 1,
      tags: ['异步复位', '使能', '非阻塞'],
      brief: '时序逻辑骨架题',
      desc: `8 位寄存器，规格：

| 条件 | 行为 |
|---|---|
| \`rst_n = 0\` | 立即清零（异步） |
| \`rst_n = 1\` 且 \`en = 1\` | \`q <= d\` |
| \`rst_n = 1\` 且 \`en = 0\` | 保持 |

**要求**：低有效复位、异步；复位优先级高于使能；时钟沿用 \`posedge clk\`；赋值用非阻塞 \`<=\`。`,
      files: [
        {
          name: 'reg8.v',
          content: `module reg8 (
    input  wire       clk,
    input  wire       rst_n,
    input  wire       en,
    input  wire [7:0] d,
    output reg  [7:0] q
);
    // TODO: always @(...)

endmodule
`,
        },
      ],
      tests: [{ tb: 'reg8' }],
      solution: `module reg8 (
    input  wire       clk,
    input  wire       rst_n,
    input  wire       en,
    input  wire [7:0] d,
    output reg  [7:0] q
);
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n)
            q <= 8'h00;
        else if (en)
            q <= d;
    end
endmodule
`,
      lint: { requireAsyncReset: true },
      wave: () => `
module __vlab_wave;
  reg clk = 1'b0, rst_n = 1'b0, en = 1'b1;
  reg [7:0] d = 8'h5A;
  wire [7:0] q;
  integer k;
  reg8 dut (.clk(clk), .rst_n(rst_n), .en(en), .d(d), .q(q));
  always #5 clk = ~clk;
  initial begin
    repeat (2) @(negedge clk);
    @(negedge clk); rst_n = 1'b1;
    for (k = 0; k < 16; k = k + 1) begin
      @(negedge clk); #1;
      $display("[WAVE]q.bin=%b", q);
      d = d + 8'h11;
    end
    $finish;
  end
endmodule\n`,
      keyPoints: [
        '异步复位必须写进敏感表：or negedge rst_n。',
        '时序逻辑用非阻塞 <=，复位分支写在最前面。',
        'en 为 0 时不写赋值分支 = 保持，这是时序逻辑的正常写法。',
      ],
    },
    {
      id: 'c07s_p02',
      title: '模 10 计数器 + 单周期 tick',
      type: 'write',
      difficulty: 2,
      tags: ['计数器', 'tick', '脉冲'],
      brief: '期末最常考的计数器变式',
      desc: `0~9 循环计数器（异步低有效复位），并输出**一个时钟周期**的 tick：

- \`rst_n=0\` 时 \`count=0, tick=0\`；
- \`en=1\` 时每来一个时钟沿：\`count\` 计到 9 后回 0，并在**回到 0 的那个时钟周期**让 \`tick\` 输出 1；
- \`en=0\` 时 \`count\` 保持，\`tick\` 为 0。

> 注意：tick 必须是“单周期脉冲”，不能在 count==9 时一直保持。`,
      files: [
        {
          name: 'cnt_mod10.v',
          content: `module cnt_mod10 (
    input  wire       clk,
    input  wire       rst_n,
    input  wire       en,
    output reg  [3:0] count,
    output reg        tick
);
    // TODO

endmodule
`,
        },
      ],
      tests: [{ tb: 'cnt_mod10' }],
      solution: `module cnt_mod10 (
    input  wire       clk,
    input  wire       rst_n,
    input  wire       en,
    output reg  [3:0] count,
    output reg        tick
);
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            count <= 4'd0;
            tick  <= 1'b0;
        end else begin
            tick <= 1'b0;              // 默认拉低：只有满足条件时才是 1，保证单周期
            if (en) begin
                if (count == 4'd9) begin
                    count <= 4'd0;
                    tick  <= 1'b1;
                end else begin
                    count <= count + 1'b1;
                end
            end
        end
    end
endmodule
`,
      lint: { requireAsyncReset: true },
      wave: () => `
module __vlab_wave;
  reg clk = 1'b0, rst_n = 1'b0, en = 1'b1;
  wire [3:0] count;
  wire tick;
  integer k;
  cnt_mod10 dut (.clk(clk), .rst_n(rst_n), .en(en), .count(count), .tick(tick));
  always #5 clk = ~clk;
  initial begin
    repeat (2) @(negedge clk);
    @(negedge clk); rst_n = 1'b1;
    for (k = 0; k < 16; k = k + 1) begin
      @(negedge clk); #1;
      $display("[WAVE]count.bin=%b tick=%b", count, tick);
    end
    $finish;
  end
endmodule\n`,
      keyPoints: [
        'tick 每周期先清零，再在条件满足时置 1 —— 单周期脉冲的标准写法。',
        'count==9 时归零并出 tick；位宽 4 位足够表示 0~9。',
      ],
    },
    {
      id: 'c07s_p03',
      title: '找错：时序块里用了阻塞赋值',
      type: 'bug',
      difficulty: 2,
      tags: ['阻塞', '非阻塞', '移位寄存器'],
      brief: '三级寄存器变成了一根直通线',
      desc: `下面代码想做**三级移位寄存器**（数据延迟 3 个时钟周期），但实际仿真中 \`q2\` 在同一拍就跟着 \`din\` 变了。

请把赋值方式改正，并确认 \`q2\` 相对 \`din\` 确实延迟 3 拍。`,
      files: [
        {
          name: 'shift3_bug.v',
          content: `module shift3_bug (
    input  wire clk,
    input  wire din,
    output reg  q2
);
    reg q0, q1;
    always @(posedge clk) begin
        q0 = din;
        q1 = q0;
        q2 = q1;
    end
endmodule
`,
        },
      ],
      tests: [{ tb: 'shift3_bug' }],
      solution: `module shift3_bug (
    input  wire clk,
    input  wire din,
    output reg  q2
);
    reg q0, q1;
    always @(posedge clk) begin
        q0 <= din;
        q1 <= q0;
        q2 <= q1;
    end
endmodule
`,
      lint: { allowBlockingInCode: false },
      keyPoints: [
        '阻塞赋值立即生效：q1 = q0 拿到的是刚更新过的 q0，三级寄存器退化成一条直连。',
        '非阻塞赋值在时间步末尾统一更新，三个寄存器并行采样旧值 → 真正延迟 3 拍。',
      ],
    },
    {
      id: 'c07s_p04',
      title: '同步复位 vs 异步复位的敏感表',
      type: 'fill',
      difficulty: 2,
      tags: ['同步复位', '异步复位', '敏感表'],
      brief: '只填空：敏感表怎么写',
      desc: `同样的功能，写两个版本。都是低有效复位 \`rst_n\`，使能 \`en\`，装载 \`d\`。

1. **同步复位**版本：复位只在时钟上升沿起作用。
2. **异步复位**版本：复位一到立即生效。

每题只需要填写 \`always\` 后面的敏感表。`,
      files: [
        {
          name: 'rst_style.v',
          content: `module rst_sync (
    input  wire       clk,
    input  wire       rst_n,
    input  wire       en,
    input  wire [7:0] d,
    output reg  [7:0] q
);
    always @(____) begin
        if (!rst_n) q <= 8'h00;
        else if (en) q <= d;
    end
endmodule

module rst_async (
    input  wire       clk,
    input  wire       rst_n,
    input  wire       en,
    input  wire [7:0] d,
    output reg  [7:0] q
);
    always @(____) begin
        if (!rst_n) q <= 8'h00;
        else if (en) q <= d;
    end
endmodule
`,
        },
      ],
      tests: [{ tb: 'rst_style' }],
      solution: `module rst_sync (
    input  wire       clk,
    input  wire       rst_n,
    input  wire       en,
    input  wire [7:0] d,
    output reg  [7:0] q
);
    always @(posedge clk) begin
        if (!rst_n) q <= 8'h00;
        else if (en) q <= d;
    end
endmodule

module rst_async (
    input  wire       clk,
    input  wire       rst_n,
    input  wire       en,
    input  wire [7:0] d,
    output reg  [7:0] q
);
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) q <= 8'h00;
        else if (en) q <= d;
    end
endmodule
`,
      keyPoints: [
        '同步复位：敏感表只有 posedge clk。',
        '异步复位：敏感表加 or negedge rst_n，复位立即生效。',
      ],
    },
    {
      id: 'c07s_p05',
      title: '时钟使能 vs 门控时钟',
      type: 'quiz',
      difficulty: 2,
      tags: ['门控时钟', '时钟使能', '功耗'],
      brief: '期末PDF“精巧代码”考点',
      desc: '关于用使能控制寄存器，回答下列问题。',
      quiz: {
        questions: [
          { q: '最推荐的写法是', options: ['assign gclk = clk & en; 再用 gclk 触发寄存器', '在 always 的 if (en) 分支里赋值', '用 assign q = en ? d : q;', '用 always @(en) 触发'], answer: 1, why: '时钟使能（clock enable）不改变时钟树，综合工具会生成带 CE 的寄存器。' },
          { q: '直接用组合逻辑门控时钟的风险是', options: ['不能综合', '可能产生毛刺/窄脉冲，造成误触发', '功耗更高', '寄存器会变成锁存器'], answer: 1, why: 'en 与 clk 组合时若 en 在时钟有效沿附近变化，会产生毛刺。' },
          { q: '工程上真正要用门控时钟时应', options: ['随便用与门', '使用工艺库提供的集成时钟门控单元（ICG）', '用或门', '用与门再加延时'], answer: 1, why: 'ICG 单元内部用锁存器保证 en 稳定，不会产生毛刺。' },
          { q: '不使用门控时，寄存器每个时钟沿都在', options: ['保持', '翻转/重新采样，产生动态功耗', '清零', '复位'], answer: 1, why: '即使数据没变，时钟沿也会让触发器内部节点翻转，消耗动态功耗。' },
        ],
      },
      keyPoints: ['时钟使能是推荐做法；门控时钟要专用单元，避免毛刺。'],
    },
    {
      id: 'c07s_p06',
      title: '两级寄存器同步（防亚稳态）',
      type: 'write',
      difficulty: 2,
      tags: ['跨时钟域', '同步器', '非阻塞'],
      brief: '工程常识题，考试简答常出现',
      desc: `异步输入 \`async_in\` 需要先用两个触发器同步，再使用：

- \`sync1\`、\`sync2\` 组成两级同步器，异步复位到 0；
- 输出 \`sync2\`。

**要求**：\`always @(posedge clk or negedge rst_n)\`，两级寄存器在同一个 always 块里用非阻塞赋值。`,
      files: [
        {
          name: 'sync2ff.v',
          content: `module sync2ff (
    input  wire clk,
    input  wire rst_n,
    input  wire async_in,
    output reg  sync2
);
    reg sync1;
    // TODO

endmodule
`,
        },
      ],
      tests: [{ tb: 'sync2ff' }],
      solution: `module sync2ff (
    input  wire clk,
    input  wire rst_n,
    input  wire async_in,
    output reg  sync2
);
    reg sync1;
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            sync1 <= 1'b0;
            sync2 <= 1'b0;
        end else begin
            sync1 <= async_in;
            sync2 <= sync1;
        end
    end
endmodule
`,
      wave: () => `
module __vlab_wave;
  reg clk = 1'b0, rst_n = 1'b0;
  reg async_in = 1'b0;
  wire sync2;
  integer k;
  sync2ff dut (.clk(clk), .rst_n(rst_n), .async_in(async_in), .sync2(sync2));
  always #5 clk = ~clk;
  initial begin
    repeat (2) @(negedge clk);
    @(negedge clk); rst_n = 1'b1;
    @(negedge clk); async_in = 1'b1;
    for (k = 0; k < 16; k = k + 1) begin
      @(negedge clk); #1;
      $display("[WAVE]sync2=%b", sync2);
      if (k == 7) async_in = 1'b0;
    end
    $finish;
  end
endmodule\n`,
      keyPoints: [
        '两级同步器降低亚稳态传播概率，但会带来 2 拍延迟。',
        '同一 always 块、非阻塞赋值，两个寄存器同时更新。',
      ],
    },
  ],
};