'use strict';
module.exports = {
  chapter: 'ch03',
  testDir: 'ch04',
  title: '层次建模与基本概念',
  tag: '第 2–3 章',
  group: '教材',
  problems: [
    {
      id: 'c03_p01',
      title: '层次化：用 4 个全加器搭 4 位行波加法器',
      type: 'write',
      difficulty: 2,
      tags: ['层次建模', '例化'],
      brief: '基本单元 + 例化多个',
      desc: `已经给出 1 位全加器 \`full_adder\`，端口顺序 \`(a, b, cin, sum, cout)\`。

补全顶层 \`ripple4\`：
1. 声明内部进位线 \`c\`，宽 5 位；\`c[0]\` 接输入 \`cin\`，\`c[4]\` 就是 \`cout\`；
2. 例化 4 个 \`full_adder\`：第 i 位的 \`cin\` 接 \`c[i]\`，\`cout\` 接 \`c[i+1]\`。

> 不要改成 \`assign {cout,sum}=a+b+cin\`，本题考的是层次结构。`,
      files: [
        {
          name: 'ripple4.v',
          content: `// 1 位全加器（已给出，不要修改）
module full_adder (
    input  wire a,
    input  wire b,
    input  wire cin,
    output wire sum,
    output wire cout
);
    assign sum  = a ^ b ^ cin;
    assign cout = (a & b) | (a & cin) | (b & cin);
endmodule

module ripple4 (
    input  wire [3:0] a,
    input  wire [3:0] b,
    input  wire       cin,
    output wire [3:0] sum,
    output wire       cout
);
    // TODO: 声明进位线

    // TODO: 例化 4 个 full_adder


endmodule
`,
        },
      ],
      tests: [{ tb: 'ripple4', data: ['tb_ripple4.v'] }],
      solution: `module full_adder (
    input  wire a,
    input  wire b,
    input  wire cin,
    output wire sum,
    output wire cout
);
    assign sum  = a ^ b ^ cin;
    assign cout = (a & b) | (a & cin) | (b & cin);
endmodule

module ripple4 (
    input  wire [3:0] a,
    input  wire [3:0] b,
    input  wire       cin,
    output wire [3:0] sum,
    output wire       cout
);
    wire [4:0] c;
    assign c[0] = cin;

    full_adder u_fa0 (.a(a[0]), .b(b[0]), .cin(c[0]), .sum(sum[0]), .cout(c[1]));
    full_adder u_fa1 (.a(a[1]), .b(b[1]), .cin(c[1]), .sum(sum[1]), .cout(c[2]));
    full_adder u_fa2 (.a(a[2]), .b(b[2]), .cin(c[2]), .sum(sum[2]), .cout(c[3]));
    full_adder u_fa3 (.a(a[3]), .b(b[3]), .cin(c[3]), .sum(sum[3]), .cout(c[4]));

    assign cout = c[4];
endmodule
`,
      keyPoints: ['进位线宽 = 位宽 + 1。', '第 i 位的 cout 接 c[i+1]，是下一位的 cin。'],
    },
    {
      id: 'c03_p02',
      title: '常量、标识符与四值逻辑',
      type: 'quiz',
      difficulty: 1,
      tags: ['常量', '标识符', 'x/z'],
      brief: '第 3 章选择题',
      desc: '按教材第 3 章的规定作答。',
      quiz: {
        questions: [
          { q: "常量 8'hA5 的二进制是", options: ['1010_0101', '1011_0101', '1010_1010', '0101_1010'], answer: 0, why: 'A=1010，5=0101。' },
          { q: "常量 'b1 不写位宽时，实际位宽是", options: ['1 位', '32 位', '由上下文决定为 1 位', '64 位'], answer: 1, why: "未写位宽的数字默认是 32 位整数，写成 {1'b1, 0} 这种拼接很容易出错。" },
          { q: '下列哪个不是合法标识符', options: ['data_bus', '_start', '4th_bit', 'State1'], answer: 2, why: '标识符不能以数字开头。' },
          { q: 'z 表示', options: ['逻辑 0', '逻辑 1', '未知值', '高阻态'], answer: 3, why: 'z 是高阻，常见于三态总线未被驱动。' },
          { q: '下列哪种情况不会产生 x', options: ['未初始化的寄存器', '多个模块冲突驱动同一 wire', '正常的加减运算', 'case 语句没有覆盖到的分支'], answer: 2, why: '正常运算不会产生 x。' },
        ],
      },
      keyPoints: ['常量必须写位宽', '标识符规则', '0/1/x/z 的含义'],
    },
  ],
};