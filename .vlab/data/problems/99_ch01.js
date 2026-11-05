'use strict';
module.exports = {
  chapter: 'ch01',
  title: '概念题速记',
  tag: '第 1–2 章',
  group: '教材',
  problems: [
    {
      id: 'c01_p01',
      title: '三种建模方式与设计流程',
      type: 'quiz',
      difficulty: 1,
      tags: ['建模方式', '设计流程'],
      brief: '简答题的判卷点',
      desc: '教材第 1–2 章概念。',
      quiz: {
        questions: [
          { q: '结构化建模的典型语句是', options: ['assign', 'always', '门原语/模块例化', 'initial'], answer: 2, why: '结构化 = 元件 + 连线。' },
          { q: '同一个功能的三种描述综合后', options: ['功能一定不同', '只要输入输出关系相同，综合后可得到功能等价的硬件', '只有行为级能被综合', '只有门级能被综合'], answer: 1, why: '三种抽象最终都映射到硬件。' },
          { q: 'HDL 与 C 语言最根本的差别', options: ['HDL 更快', 'HDL 描述并发存在的硬件，C 描述按顺序执行的指令', 'HDL 不能写循环', 'C 不能做运算'], answer: 1, why: '并发性是关键。' },
          { q: '下列哪个不能在通用 RTL 中综合', options: ['assign', 'always @(posedge clk)', '在 Verilog 中写 #5 生成延时', '$display'], answer: 3, why: '$display 只是仿真打印，不对应任何硬件。' },
          { q: '层次化设计的主要目的', options: ['让代码更短', '降低复杂度、便于复用、局部验证、并行开发', '减少寄存器', '提高仿真速度'], answer: 1, why: '层次化是工程化方法。' },
          { q: '自顶向下设计的第一步通常是', options: ['写 Testbench', '根据规格确定功能、接口、时钟复位和模块划分', '画版图', '写门级代码'], answer: 1, why: '先从规格和接口开始。' },
        ],
      },
      keyPoints: ['三种建模方式、仿真与综合、层次化 —— 都是简答的模板答案。'],
    },
  ],
};