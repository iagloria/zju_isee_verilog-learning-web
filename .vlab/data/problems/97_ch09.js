'use strict';
/*
 * 第 9 章：实用建模技术 / Testbench
 * 这里的题目是“你写测试台，DUT 已经给好，而且有 bug”——把验证技能也练成肌肉记忆
 */
module.exports = {
  chapter: 'ch09',
  title: 'Testbench 与验证',
  tag: '第 9 章',
  group: '教材',
  problems: [
    {
      id: 'c09_p01',
      title: '手写最小 Testbench（时钟、复位、激励、$finish）',
      type: 'tb',
      difficulty: 2,
      tags: ['Testbench', 'initial', '系统任务'],
      brief: '真正的“考试手写”题型',
      desc: `**DUT 已给出**（8 位加法器 \`add8\`，端口 \`a, b, sum, cout\`），请为它写一个 Testbench：

1. \`clk\` 周期 10ns（5ns 翻转一次），在 \`initial\` 里先初始化；
2. 依次测试 5 组输入：\`(0,0)、(1,1)、(255,1)、(128,127)、(7,9)\`；
3. 每组输入后等待一小段时间再检查；
4. 用 \`$display\` 或 \`$monitor\` 打印每组的输入和输出；
5. 最后调用 \`$finish\`。

**评分不看对错（DUT 是对的），只看你的 TB 是否真的把 5 组数据都施加了、打印出来了、正常结束。**

> 提示：DUT 端口名是 \`a, b, sum, cout\`，你的 TB 里信号名任意，但**输出端口一定要用 wire 接**。`,
      files: [
        {
          name: 'tb_add8.v',
          content: `// DUT 已给出，不要修改
module add8 (
    input  wire [7:0] a,
    input  wire [7:0] b,
    output wire [7:0] sum,
    output wire       cout
);
    assign {cout, sum} = a + b;
endmodule

module tb_add8;
    // TODO: 声明 reg / wire，例化 DUT，产生时钟、复位、激励，打印并 $finish

endmodule
`,
        },
      ],
      tb: 'add8',
      solution: `\`timescale 1ns/1ps

module tb_add8;
    reg        clk;
    reg  [7:0] a;
    reg  [7:0] b;
    wire [7:0] sum;
    wire       cout;

    add8 dut (.a(a), .b(b), .sum(sum), .cout(cout));

    initial begin
        clk = 1'b0;
        forever #5 clk = ~clk;
    end

    initial begin
        a = 8'd0; b = 8'd0;
        #10;
        a = 8'd1;   b = 8'd1;
        #10;
        a = 8'd255; b = 8'd1;
        #10;
        a = 8'd128; b = 8'd127;
        #10;
        a = 8'd7;   b 	= 8'd9;
        #10;
        $display("a=%0d b=%0d sum=%0d cout=%0d", a, b, sum, cout);
        $finish;
    end

    initial $monitor("t=%0t a=%0d b=%0d sum=%0d cout=%0d", $time, a, b, sum, cout);
endmodule
`,
      keyPoints: [
        'TB 没有端口；DUT 输入用 reg、输出用 wire。',
        '时钟：initial 里 clk=0; forever #5 clk=~clk;',
        '$finish 结束仿真，$monitor 自动打印变化。',
      ],
    },
    {
      id: 'c09_p02',
      title: '用 $readmemh 读取测试向量',
      type: 'tb',
      difficulty: 3,
      tags: ['readmemh', '文件操作', '$fopen'],
      brief: '期末 PDF 明确要求的文件操作题',
      desc: `**DUT 已给出**：\`popcount8\`（8 位输入，4 位输出“1 的个数”）。

要求你的 Testbench：

1. 用 \`$readmemh\` 从文件 **\`vectors.hex\`** 读入 8 位测试向量（服务器会自动把该文件放在仿真目录里；你自己的调试也可以点“运行”自动生成）；
2. 逐条把向量驱动到 \`din\`，等待 DUT 输出稳定后，打印 \`$time\`、\`din\`、\`cnt\`；
3. 用 \`$fopen("result.txt","w")\` 打开结果文件，用 \`$fdisplay\` 写入结果，最后 \`$fclose\`；
4. \`$finish\` 结束。

**判分**：只检查你是否正确读取了 4 条向量、打印了每一组、闭合并结束（不检查 $fopen 是否成功，但建议检查返回值）。`,
      files: [
        {
          name: 'tb_popcount.v',
          content: `// DUT 已给出，不要修改
module popcount8 (
    input  wire [7:0] din,
    output wire [3:0] cnt
);
    integer i;
    reg [3:0] c;
    always @(*) begin
        c = 4'd0;
        for (i = 0; i < 8; i = i + 1)
            if (din[i]) c = c + 1'b1;
    end
    assign cnt = c;
endmodule

module tb_popcount;
    // TODO: 读取 vectors.hex 并驱动 din

endmodule
`,
        },
      ],
      tb: 'popcount8',
      solution: `\`timescale 1ns/1ps

module tb_popcount;
    reg  [7:0] din;
    wire [3:0] cnt;
    reg  [7:0] vectors [0:3];
    integer    fd;
    integer    i;

    popcount8 dut (.din(din), .cnt(cnt));

    initial begin
        fd = $fopen("result.txt", "w");
        if (fd == 0) begin
            $display("ERROR: cannot open result.txt");
            $finish;
        end

        $readmemh("vectors.hex", vectors);

        for (i = 0; i < 4; i = i + 1) begin
            din = vectors[i];
            #2;
            $display("time=%0t din=%h cnt=%0d", $time, din, cnt);
            $fdisplay(fd, "time=%0t din=%h cnt=%0d", $time, din, cnt);
        end

        $fclose(fd);
        #5 $finish;
    end
endmodule
`,
      keyPoints: [
        '$readmemh 读取十六进制文本，$readmemb 读二进制。',
        '$fopen 返回句柄，0 表示失败；$fdisplay 要带句柄；$fclose 关闭。',
        '文件操作只用于仿真，综合工具不支持。',
      ],
    },
    {
      id: 'c09_p03',
      title: '系统任务的含义',
      type: 'quiz',
      difficulty: 1,
      tags: ['$display', '$strobe', '$monitor'],
      brief: '第 9 章系统任务',
      desc: '选择每个系统任务的正确描述。',
      quiz: {
        questions: [
          { q: '$display 的作用', options: ['执行到就打印一次并换行', '检测到信号变化时打印', '在当前时间步更新后打印', '结束仿真'], answer: 0, why: '立即打印。' },
          { q: '$strobe 与本时间步的非阻塞赋值的关系', options: ['在多余的时间步结束、NBA 更新完成后再打印', '在 NBA 之前打印', '不打印', '只打印一次'], answer: 0, why: '$strobe 在当前时间步所有事件处理完（含 NBA）后打印，能拿到最终值。' },
          { q: '$monitor 的特点', options: ['只在调用处打印一次', '监视参数，一旦变化就自动打印', '必须写在 always 里', '只能打印时间'], answer: 1, why: '$monitor 会监听多个参数，任一变化就打印整个字符串。' },
          { q: '$finish 和 $stop 的区别', options: ['一样', '$finish 结束仿真，$stop 暂停进入交互调试', '$stop 结束仿真', '$finish 只停时钟'], answer: 1, why: '一个是结束，一个是打断点。' },
          { q: '下列哪个不是系统任务', options: ['$display', '$time', 'assign', '$readmemh'], answer: 2, why: 'assign 是关键字，不是系统任务。' },
          { q: '`timescale 1ns/1ps 表示', options: ['时间单位 1ns，时间精度 1ps', '时间精度 1ns，单位 1ps', '时钟周期 1ns', '仿真运行 1ns'], answer: 0, why: '前一个是单位（unit），后一个是精度（precision）。' },
        ],
      },
      keyPoints: ['$display / $strobe / $monitor 的区别是简答高频点。'],
    },
  ],
};