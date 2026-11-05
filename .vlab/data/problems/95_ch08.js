'use strict';
module.exports = {
  chapter: 'ch08',
  title: '任务与函数',
  tag: '第 8 章',
  group: '教材',
  problems: [
    {
      id: 'c08_p01',
      title: '用 function 写奇偶校验 + 位反转',
      type: 'write',
      difficulty: 2,
      tags: ['function', '组合计算'],
      brief: 'function 不能有延时',
      desc: `在一个模块里定义两个 function 并在 assign 中调用：

1. \`parity8\`：输入 8 位，返回奇校验位（1 的个数为奇数返回 1）
2. \`reverse8\`：输入 8 位，返回按位翻转后的结果

**要求**：必须真的用 \`function ... endfunction\` 定义并在表达式里调用，function 内**不能出现** \`#\` 或 \`@\`。`,
      files: [
        {
          name: 'func_utils.v',
          content: `module func_utils (
    input  wire [7:0] din,
    output wire       par,
    output wire [7:0] rev
);
    // TODO: function parity8 ... endfunction


    // TODO: function reverse8 ... endfunction


    assign par = parity8(din);
    assign rev = reverse8(din);
endmodule
`,
        },
      ],
      tests: [{ tb: 'func_utils', data: ['tb_func_utils.v'] }],
      solution: `module func_utils (
    input  wire [7:0] din,
    output wire       par,
    output wire [7:0] rev
);
    function parity8;
        input [7:0] x;
        begin
            parity8 = ^x;
        end
    endfunction

    function [7:0] reverse8;
        input [7:0] x;
        integer i;
        begin
            for (i = 0; i < 8; i = i + 1)
                reverse8[i] = x[7 - i];
        end
    endfunction

    assign par = parity8(din);
    assign rev = reverse8(din);
endmodule
`,
      keyPoints: [
        'function 的值通过“函数名赋值”返回。',
        'function 至少一个输入，不能有 output/inout（除非用 SystemVerilog 写法），不能含时间控制。',
        'function 可以出现在 assign 表达式里 —— 这是 task 做不到的。',
      ],
    },
    {
      id: 'c08_p02',
      title: 'task 与 function 的区别',
      type: 'quiz',
      difficulty: 1,
      tags: ['task', 'function'],
      brief: '第 8 章必考简答',
      desc: '判断下列说法。',
      quiz: {
        questions: [
          { q: '能出现在 assign 右侧表达式里的是', options: ['task', 'function', '两者都可以', '两者都不行'], answer: 1, why: 'function 有返回值，可以作为表达式的一部分。' },
          { q: '可以包含 #10 延时的是', options: ['task', 'function', '两者都可以', '两者都不行'], answer: 0, why: 'task 允许时间控制，function 必须在当前仿真时间内完成。' },
          { q: '可以返回多个值的是', options: ['task', 'function', '两者都可以', '两者都不行'], answer: 0, why: 'task 可以通过多个 output/inout 回传结果。' },
          { q: '在可综合代码中，function 通常用于', options: ['封装 Testbench 激励', '封装纯组合计算（编码、校验、比较）', '产生时钟', '等待事件'], answer: 1, why: 'function 无时间副作用，是纯组合函数。' },
        ],
      },
      keyPoints: ['task：可延时、多返回值、独立语句调用；function：无延时、单返回值、可嵌入表达式。'],
    },
  ],
};
