'use strict';
module.exports = {
  chapter: 'ch10',
  title: '时序与延迟',
  tag: '第 10 章',
  group: '教材',
  problems: [
    {
      id: 'c10_p01',
      title: '用 specify 描述路径延迟',
      type: 'fill',
      difficulty: 2,
      tags: ['specify', '路径延迟'],
      brief: '教材第 10 章模板',
      desc: `写一个二输入与门模块，并在 \`specify\` 块中描述**输入到输出的路径延迟**：

- \`a\` 到 \`out\` 的延迟为 3；
- \`b\` 到 \`out\` 的延迟为 3；
- 使用 \`specparam\` 定义 \`tDLY = 3\`，再在路径中引用它。

> 注意 \`specify\` 是模块中的独立结构，不能写在 \`always\` / \`initial\` 里。`,
      files: [
        {
          name: 'path_and.v',
          content: `module path_and (
    input  wire a,
    input  wire b,
    output wire out
);
    and u_and (out, a, b);

    specify
        specparam tDLY = 3;
        // TODO: 写两条路径延迟，格式 (a *> out) = tDLY;
    endspecify
endmodule
`,
        },
      ],
      tests: [{ tb: 'path_and', lint: { requireSpecify: true } }],
      solution: `module path_and (
    input  wire a,
    input  wire b,
    output wire out
);
    and u_and (out, a, b);

    specify
        specparam tDLY = 3;
        (a *> out) = tDLY;
        (b *> out) = tDLY;
    endspecify
endmodule
`,
      lint: { isSwitchLevel: false },
      keyPoints: ['(输入 *> 输出) = 延迟; 是并行路径写法。', 'specify 块只影响仿真时序，不改变功能。'],
    },
    {
      id: 'c10_p02',
      title: '惯性延时与传输延时',
      type: 'quiz',
      difficulty: 3,
      tags: ['惯性延时', '传输延时'],
      brief: '教材第 10 章概念题',
      desc: `已知 \`assign #10 y = a;\`，\`a\` 在 t=0 为 0，t=5 变 1，t=10 变回 0。`,
      quiz: {
        questions: [
          { q: 'continuous assign 的 #10 属于哪种延迟模型', options: ['惯性延时', '传输延时', '混合', '不是延时'], answer: 0, why: 'assign 上的 # 是惯性延时（inertial），比 10 短的脉冲被滤除。' },
          { q: 'y 会不会出现脉冲', options: ['会，在 t=0 就变 0，之后一直是 0', '不会，宽度 5 < 10 的脉冲被滤掉，y 一直为 0', '会，在 t=10 变 1', '会，在 t=15 变 0'], answer: 1, why: '惯性延时滤除短于延迟的窄脉冲。' },
          { q: '若要保留窄脉冲，应使用', options: ['门级惯性延时', '传输延时模型（例如 specify 中的传输路径，或传输门建模）', '加 $display', '改用 while'], answer: 1, why: '传输延时会把输入变化全部按延迟搬到输出。' },
          { q: '实际实现的时序信息来自', options: ['代码里的 #10', '综合、布局布线后的延时（可用 SDF 反标）', '仿真器随机生成', '时序约束里手写的 #'], answer: 1, why: '# 只是仿真模型，真实延时要靠 SDF 反标。' },
        ],
      },
      keyPoints: ['惯性延时滤窄脉冲；传输延时全搬。'],
    },
  ],
};