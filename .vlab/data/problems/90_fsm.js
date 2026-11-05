'use strict';
/*
 * FSM 专题：状态机（考试最需要“手写不出错”的部分）
 */
module.exports = {
  chapter: 'fsm',
  testDir: 'fsm',
  title: 'FSM 状态机专题',
  tag: '状态机专题',
  group: '重点专题',
  problems: [
    {
      id: 'fsm_p01',
      title: '序列检测器（检测 101，允许重叠，Moore）',
      type: 'write',
      difficulty: 3,
      tags: ['FSM', '三段式', 'Moore', '重叠'],
      brief: '最经典的序列检测题',
      desc: `设计 Moore 型序列检测器：串行输入 \`din\`，检测到 \`101\` 时输出 \`found = 1\`（在本状态停留的整个周期内为 1），**允许重叠**。

状态定义（已给出，照抄）：

| 状态 | 含义 |
|---|---|
| S0 | 无有效前缀 |
| S1 | 最近输入 1 |
| S2 | 最近输入 10 |
| S3 | 最近输入 101 |

转移（重叠检测：检测完成后再来 1 仍算 S1）：

- S0: din→S1 / ~din→S0
- S1: din→S1 / ~din→S2
- S2: din→S3 / ~din→S0
- S3: din→S1 / ~din→S0

**要求**：三段式（状态寄存器 + 次态组合 + 输出组合），异步低有效复位，次态块先赋默认值，case 有 default 回 S0。`,
      files: [
        {
          name: 'seq101_moore.v',
          content: `module seq101_moore (
    input  wire clk,
    input  wire rst_n,
    input  wire din,
    output reg  found
);
    localparam S0 = 2'd0, S1 = 2'd1, S2 = 2'd2, S3 = 2'd3;
    reg [1:0] state, next_state;

    // 第一段：状态寄存器
    // TODO

    // 第二段：次态逻辑
    // TODO

    // 第三段：输出逻辑
    // TODO

endmodule
`,
        },
      ],
      tests: [{ tb: 'seq101' }],
      solution: `module seq101_moore (
    input  wire clk,
    input  wire rst_n,
    input  wire din,
    output reg  found
);
    localparam S0 = 2'd0, S1 = 2'd1, S2 = 2'd2, S3 = 2'd3;
    reg [1:0] state, next_state;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) state <= S0;
        else        state <= next_state;
    end

    always @(*) begin
        next_state = S0;
        case (state)
            S0: next_state = din ? S1 : S0;
            S1: next_state = din ? S1 : S2;
            S2: next_state = din ? S3 : S0;
            S3: next_state = din ? S1 : S0;
            default: next_state = S0;
        endcase
    end

    always @(*) begin
        found = 1'b0;
        if (state == S3) found = 1'b1;
    end
endmodule
`,
      lint: { requireAsyncReset: true, requireFsm: true },
      wave: () => `
module __vlab_wave;
  reg clk = 1'b0, rst_n = 1'b0, din = 1'b0;
  wire found;
  integer k;
  reg [6:0] s = 7'b1101011;
  seq101_moore dut (.clk(clk), .rst_n(rst_n), .din(din), .found(found));
  always #5 clk = ~clk;
  initial begin
    repeat (2) @(negedge clk);
    @(negedge clk); rst_n = 1'b1;
    for (k = 6; k >= 0; k = k - 1) begin
      @(negedge clk); din = s[k];
      @(negedge clk); #1;
      $display("[WAVE]din=%b found=%b", din, found);
    end
    $finish;
  end
endmodule\n`,
      keyPoints: [
        'Moore 输出只看当前状态：found = (state == S3)。',
        '重叠检测的关键：S3 收到 1 回到 S1，而不是 S0。',
        '三段式：时序块只存状态，组合块算次态，输出块只算输出。',
      ],
    },
    {
      id: 'fsm_p02',
      title: '序列检测器（检测 1101，禁止重叠，寄存器输出）',
      type: 'write',
      difficulty: 3,
      tags: ['FSM', '三段式', '不重叠', '输出寄存'],
      brief: '把 101 加长成 1101：两个变式一起练',
      desc: `检测串行输入中的 \`1101\`，**不允许重叠**（检测到一次后从头重新计），命中时输出**一个时钟周期**的 \`found\`。

状态：

| 状态 | 含义 |
|---|---|
| S0 | 无匹配 |
| S1 | 已匹配 1 |
| S2 | 已匹配 11 |
| S3 | 已匹配 110（再来一个 1 就命中）|

转移：

- S0: din→S1 / ~din→S0
- S1: din→S2 / ~din→S0
- S2: din→S2 / ~din→S3
- S3: din→**S1**（不重叠：重新从"已匹配 1"开始）/ ~din→S0

注意 **S2 收到 1 要留在 S2**（"111" 仍匹配前缀 "11"），这是最容易写成回 S0 的地方。

**输出要求：用寄存器输出**（无毛刺、宽度固定一拍）：

\`\`\`verilog
always @(posedge clk or negedge rst_n)
    if (!rst_n) found <= 1'b0;
    else        found <= (state == S3) && din;
\`\`\`

> 为什么不用纯组合的 Mealy 写法？组合输出 \`found = (state==S3 && din)\` 在纸面上也对，
> 但它要求测试在"输入刚变、时钟沿还没到"的瞬间采样。考试手写时这种时刻最容易写错，
> 而且不同仿真器对组合输出变化时刻的处理并不一致。寄存器输出是更重要、也更稳的写法。`,
      files: [
        {
          name: 'seq1101_fsm.v',
          content: `module seq1101_fsm (
    input  wire clk,
    input  wire rst_n,
    input  wire din,
    output reg  found
);
    localparam S0 = 2'd0, S1 = 2'd1, S2 = 2'd2, S3 = 2'd3;
    reg [1:0] state, next_state;

    // TODO: 三段式（found 用寄存器输出）

endmodule
`,
        },
      ],
      tests: [{ tb: 'seq1101' }],
      solution: `module seq1101_fsm (
    input  wire clk,
    input  wire rst_n,
    input  wire din,
    output reg  found
);
    localparam S0 = 2'd0, S1 = 2'd1, S2 = 2'd2, S3 = 2'd3;
    reg [1:0] state, next_state;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) state <= S0;
        else        state <= next_state;
    end

    always @(*) begin
        next_state = S0;
        case (state)
            S0: next_state = din ? S1 : S0;
            S1: next_state = din ? S2 : S0;
            S2: next_state = din ? S2 : S3;
            S3: next_state = din ? S1 : S0;   // 不重叠
            default: next_state = S0;
        endcase
    end

    // 寄存器输出：命中条件在时钟沿采样，输出保持一个周期
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) found <= 1'b0;
        else        found <= (state == S3) && din;
    end
endmodule
`,
      lint: { requireAsyncReset: true, requireFsm: true },
      keyPoints: [
        '不重叠：S3 收到 1 进 S1；若允许重叠应进 S2（"1101" 结尾的 1 可以是新序列的起点）。',
        'S2 收到 1 必须留在 S2，别写成回 S0。',
        'found 用寄存器输出：每拍先按条件赋值，条件不满足时自动为 0，天然就是单周期脉冲。',
      ],
    },
    {
      id: 'fsm_p03',
      title: '找错：状态机缺少 default 的隐患',
      type: 'bug',
      difficulty: 2,
      tags: ['FSM', 'default', '非法状态'],
      brief: '仿真是对的，但工程上有隐患',
      desc: `下面的三段式 FSM 功能看起来正常，但**缺少 default 分支**：一旦状态寄存器受干扰进入非法编码（例如 2'b11），就会永远卡在那里。

请补上 default 分支，使非法状态能回到 IDLE。`,
      files: [
        {
          name: 'fsm_default_bug.v',
          content: `module fsm_default_bug (
    input  wire clk,
    input  wire rst_n,
    input  wire din,
    output reg  busy
);
    localparam IDLE = 2'd0, WORK = 2'd1, DONE = 2'd2;
    reg [1:0] state, next_state;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) state <= IDLE;
        else        state <= next_state;
    end

    always @(*) begin
        next_state = IDLE;
        case (state)
            IDLE: next_state = din ? WORK : IDLE;
            WORK: next_state = din ? DONE : WORK;
            DONE: next_state = IDLE;
        endcase
    end

    always @(*) begin
        busy = (state == WORK) || (state == IDLE);
    end
endmodule
`,
        },
      ],
      tests: [{ tb: 'fsm_default' }],
      solution: `module fsm_default_bug (
    input  wire clk,
    input  wire rst_n,
    input  wire din,
    output reg  busy
);
    localparam IDLE = 2'd0, WORK = 2'd1, DONE = 2'd2;
    reg [1:0] state, next_state;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) state <= IDLE;
        else        state <= next_state;
    end

    always @(*) begin
        next_state = IDLE;
        case (state)
            IDLE: next_state = din ? WORK : IDLE;
            WORK: next_state = din ? DONE : WORK;
            DONE: next_state = IDLE;
            default: next_state = IDLE;    // 非法状态恢复
        endcase
    end

    always @(*) begin
        busy = (state == WORK) || (state == IDLE);
    end
endmodule
`,
      keyPoints: ['case 的 default 既防锁存器，也保证非法状态能自动回到安全状态。'],
    },
    {
      id: 'fsm_p04',
      title: '握手协议状态机（IDLE → WAIT_ACK → DONE）',
      type: 'write',
      difficulty: 3,
      tags: ['FSM', '握手', '单周期脉冲'],
      brief: 'FSM 与外部接口',
      desc: `设计请求-应答握手控制器：

| 状态 | 行为 |
|---|---|
| IDLE | 等 \`start=1\`，然后拉高 \`req\` 进入 WAIT_ACK |
| WAIT_ACK | 保持 \`req=1\`，收到 \`ack=1\` 进入 DONE |
| DONE | 拉低 \`req\`，输出**一个周期**的 \`done=1\`，然后回 IDLE |

**要求**：三段式 + 异步低有效复位；\`req\`、\`done\` 用**寄存器输出**（无毛刺）；\`done\` 严格只有 1 个周期。`,
      files: [
        {
          name: 'handshake.v',
          content: `module handshake (
    input  wire clk,
    input  wire rst_n,
    input  wire start,
    input  wire ack,
    output reg  req,
    output reg  done
);
    localparam IDLE = 2'd0, WAIT_ACK = 2'd1, DONE = 2'd2;
    reg [1:0] state, next_state;

    // TODO: 状态寄存器 + 寄存器输出 + 次态逻辑

endmodule
`,
        },
      ],
      tests: [{ tb: 'handshake' }],
      solution: `module handshake (
    input  wire clk,
    input  wire rst_n,
    input  wire start,
    input  wire ack,
    output reg  req,
    output reg  done
);
    localparam IDLE = 2'd0, WAIT_ACK = 2'd1, DONE = 2'd2;
    reg [1:0] state, next_state;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            state <= IDLE;
            req   <= 1'b0;
            done  <= 1'b0;
        end else begin
            state <= next_state;
            case (state)
                IDLE: begin
                    if (start) req <= 1'b1;
                    done <= 1'b0;
                end
                WAIT_ACK: begin
                    req  <= 1'b1;
                    done <= 1'b0;
                end
                DONE: begin
                    req  <= 1'b0;
                    done <= 1'b1;
                end
                default: begin
                    req  <= 1'b0;
                    done <= 1'b0;
                end
            endcase
        end
    end

    always @(*) begin
        next_state = IDLE;
        case (state)
            IDLE:     next_state = start ? WAIT_ACK : IDLE;
            WAIT_ACK: next_state = ack   ? DONE : WAIT_ACK;
            DONE:     next_state = IDLE;
            default:  next_state = IDLE;
        endcase
    end
endmodule
`,
      lint: { requireAsyncReset: true, requireFsm: true, allowOutputLatch: true },
      wave: () => `
module __vlab_wave;
  reg clk = 1'b0, rst_n = 1'b0, start = 1'b0, ack = 1'b0;
  wire req, done;
  integer k;
  handshake dut (.clk(clk), .rst_n(rst_n), .start(start), .ack(ack), .req(req), .done(done));
  always #5 clk = ~clk;
  initial begin
    repeat (2) @(negedge clk);
    @(negedge clk); rst_n = 1'b1;
    @(negedge clk); start = 1'b1;
    @(negedge clk); start = 1'b0;
    for (k = 0; k < 12; k = k + 1) begin
      @(negedge clk); #1;
      $display("[WAVE]req=%b done=%b", req, done);
      if (k == 1) ack = 1'b1;
      if (k == 2) ack = 1'b0;
    end
    $finish;
  end
endmodule\n`,
      keyPoints: [
        '寄存器输出：在时序块里按当前状态更新 req/done，输出无毛刺。',
        'done 只在 DONE 状态为 1，回 IDLE 后自动变 0 → 单周期脉冲。',
      ],
    },
    {
      id: 'fsm_p05',
      title: '状态编码与输出时机',
      type: 'quiz',
      difficulty: 2,
      tags: ['状态编码', 'Moore', 'Mealy'],
      brief: 'FSM 简答题的判卷点',
      desc: 'FSM 相关的概念判断。',
      quiz: {
        questions: [
          { q: 'Moore 型输出只取决于', options: ['当前状态', '当前状态和输入', '输入', '时钟'], answer: 0, why: 'Moore 输出只由当前状态决定。' },
          { q: 'Mealy 型相对 Moore 的特点', options: ['输出更稳定', '响应快、状态数可能更少，但输入变化可能直接引起输出变化', '一定没有毛刺', '必须用二段式'], answer: 1, why: 'Mealy 输出与输入直接相关。' },
          { q: '独热编码（one-hot）的特点', options: ['寄存器最少', '每个状态用一位表示，寄存器多但译码简单，FPGA 常用', '相邻状态只变一位', '只能用于 Moore'], answer: 1, why: '每状态一位，译码简单、速度快。' },
          { q: 'Gray 编码的优势', options: ['寄存器最少', '相邻状态切换只改变一位，减少翻转', '译码最简单', '没有非法状态'], answer: 1, why: '相邻状态只差一位。' },
          { q: '三段式中状态寄存器应该在哪个块里更新', options: ['组合次态块', '时钟沿触发的时序块', '输出块', 'initial 块'], answer: 1, why: '状态寄存器只在时钟沿更新。' },
          { q: '为了消除输出的组合毛刺，可以', options: ['把输出寄存一拍', '把 case 改成 if', '增加状态数', '把 Moore 改成 Mealy'], answer: 0, why: '寄存器输出时序稳定，代价是延迟一拍。' },
        ],
      },
      keyPoints: ['Moore/Mealy 输出依赖、状态编码、输出寄存化都是简答高频点。'],
    },
    {
      id: 'fsm_p06',
      title: '自动售货机（3 元，1 元/2 元硬币，出货 + 找零脉冲）',
      type: 'write',
      difficulty: 4,
      tags: ['FSM', '综合应用', '脉冲'],
      brief: '综合题：状态表示金额',
      desc: `售货机：商品 3 元，每次投入 1 元（\`coin1\`）或 2 元（\`coin2\`）。同一时刻只投一种硬币（若同时有效，按 2 元处理也可以）。

状态表示累计金额：

| 状态 | 金额 |
|---|---|
| S0 | 0 元 |
| S1 | 1 元 |
| S2 | 2 元 |
| S3 | 3 元（出货）|
| S4 | 4 元（出货 + 找零）|

- 达到 ≥3 元：\`dispense=1\`（**单周期脉冲**）；超过 3 元时 \`change=1\`（同样单周期），随后回到 S0。
- 未达 3 元：累计并保持。

**要求**：三段式；异步低有效复位。`,
      files: [
        {
          name: 'vending.v',
          content: `module vending (
    input  wire clk,
    input  wire rst_n,
    input  wire coin1,   // 投入 1 元
    input  wire coin2,   // 投入 2 元
    output reg  dispense,
    output reg  change
);
    localparam S0 = 3'd0, S1 = 3'd1, S2 = 3'd2, S3 = 3'd3, S4 = 3'd4;
    reg [2:0] state, next_state;

    // TODO: 三段式

endmodule
`,
        },
      ],
      tests: [{ tb: 'vending' }],
      solution: `module vending (
    input  wire clk,
    input  wire rst_n,
    input  wire coin1,
    input  wire coin2,
    output reg  dispense,
    output reg  change
);
    localparam S0 = 3'd0, S1 = 3'd1, S2 = 3'd2, S3 = 3'd3, S4 = 3'd4;
    reg [2:0] state, next_state;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) state <= S0;
        else        state <= next_state;
    end

    always @(*) begin
        next_state = state;
        case (state)
            S0: begin
                if (coin2)      next_state = S2;
                else if (coin1) next_state = S1;
            end
            S1: begin
                if (coin2)      next_state = S3;
                else if (coin1) next_state = S2;
            end
            S2: begin
                if (coin2)      next_state = S4;
                else if (coin1) next_state = S3;
            end
            S3: next_state = S0;
            S4: next_state = S0;
            default: next_state = S0;
        endcase
    end

    always @(*) begin
        dispense = (state == S3) || (state == S4);
        change   = (state == S4);
    end
endmodule
`,
      lint: { requireAsyncReset: true, requireFsm: true },
      wave: () => `
module __vlab_wave;
  reg clk = 1'b0, rst_n = 1'b0, coin1 = 1'b0, coin2 = 1'b0;
  wire dispense, change;
  integer k;
  vending dut (.clk(clk), .rst_n(rst_n), .coin1(coin1), .coin2(coin2), .dispense(dispense), .change(change));
  always #5 clk = ~clk;
  initial begin
    repeat (2) @(negedge clk);
    @(negedge clk); rst_n = 1'b1;
    for (k = 0; k < 12; k = k + 1) begin
      @(negedge clk);
      coin1 = (k == 0 || k == 2 || k == 4);
      coin2 = (k == 6);
      @(negedge clk); #1;
      $display("[WAVE]disp=%b chg=%b", dispense, change);
    end
    $finish;
  end
endmodule\n`,
      keyPoints: [
        '用状态表示累计金额，比另开计数器简单。',
        'S3/S4 停留一个周期再回 S0，就是“出货脉冲一个周期”。',
        '只有 4 元（S4）时需要找零。',
      ],
    },
  ],
};