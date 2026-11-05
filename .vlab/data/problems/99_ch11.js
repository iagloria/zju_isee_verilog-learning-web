'use strict';
module.exports = {
  chapter: 'ch11',
  title: '开关级建模',
  tag: '第 11 章',
  group: '教材',
  problems: [
    {
      id: 'c11_p01',
      title: '用 NMOS/PMOS 搭反相器与传输门',
      type: 'write',
      difficulty: 2,
      tags: ['nmos', 'pmos', 'cmos', '传输门'],
      brief: '开关级基本单元',
      desc: `两个模块：

1. \`cmos_inv\`：用 \`supply1\`、\`supply0\`、\`pmos\`、\`nmos\` 搭 CMOS 反相器（\`out = ~in\`）。
2. \`tg_mux\`：用两个传输门 \`tranif1\` / \`tranif0\` 搭一个二选一开关：\`sel=1\` 时 \`y\` 接 \`b\`，\`sel=0\` 时 \`y\` 接 \`a\`（不驱动时输出高阻）。

**开关原语端口顺序**：
- \`nmos/pMOS(out, data, control)\`：control 为 1（NMOS）/ 0（PMOS）时导通
- \`tranif1/tranif0(inout1, inout2, control)\`：control 为 1 / 0 时双向导通`,
      files: [
        {
          name: 'switches.v',
          content: `module cmos_inv (
    input  wire in,
    output wire out
);
    // TODO: supply1 / supply0 / pmos / nmos

endmodule

module tg_mux (
    input  wire a,
    input  wire b,
    input  wire sel,
    output wire y
);
    // TODO: 两个传输门

endmodule
`,
        },
      ],
      tests: [{ tb: 'switches' }],
      solution: `module cmos_inv (
    input  wire in,
    output wire out
);
    supply1 vdd;
    supply0 gnd;

    pmos p0 (out, vdd, in);
    nmos n0 (out, gnd, in);
endmodule

module tg_mux (
    input  wire a,
    input  wire b,
    input  wire sel,
    output wire y
);
    tranif1 tg_a (y, a, ~sel);
    tranif1 tg_b (y, b, sel);
endmodule
`,
      keyPoints: [
        'in=0：PMOS 导通 → 输出拉到 1；in=1：NMOS 导通 → 输出拉到 0。',
        '传输门是双向的，两端都能作为输入或输出。',
        '开关级建模抽象层次低，通常只用于基本单元和库模型。',
      ],
    },
  ],
};