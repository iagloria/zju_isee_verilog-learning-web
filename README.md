# Verilog 闯关训练 · Verilog Practice Lab

一个**本地运行的 LeetCode 式 Verilog 练习网站**：在浏览器里写代码，点「运行」，**真的调用 Icarus Verilog 编译并仿真**，逐条告诉你哪组输入错了、错在哪。

面向《硬件描述语言》（Verilog HDL）期末复习：教材 1–12 章 + 有限状态机专题。

---

## 特性

- **真判题**，不是模式匹配：每次运行都会启动 iverilog 编译 + vvp 仿真 + 逐条比对测试台输出
- **45 道题**：23 道手写代码 / 6 道找错改错 / 2 道补全代码 / 2 道写 Testbench / 12 道概念选择题
- **静态检查**（秒回）：锁存器推断、reg/wire 误用、位宽、敏感表、FSM 缺 default、UDP 格式……
- **波形查看**：时序题把关键信号按拍画出来
- **手写练习区**：题目描述下方有模拟卷面的大文本框，满足"考试是手写"的练习需求
- **自动出卷**：把还没通过的题组成一份可打印的模拟卷，可导出 Word（含参考答案册）
- **进度保存**：浏览器 localStorage + 服务端文件双份
- **零依赖**：Node.js 标准库 + 原生 JS，不需要 npm install

---

## 快速开始

### 1. 前置要求

| 必需 | 说明 |
|---|---|
| **Node.js** ≥ 16 | 服务端与启动器。默认找 `node` 命令，也支持 `D:\node.js\node.exe` |
| **Windows** | 启动脚本是 `.bat`；服务器本身跨平台，可自行用 `node server/app.js` 启动 |

### 2. 下载编译器（一次性）

判题用的 Icarus Verilog 是第三方工具，**不在仓库里**（约 90 MB 二进制）。首次使用请双击：

```
.vlab\tools\fetch-tools.bat
```

它会自动下载 Icarus Verilog 14 并解压到 `.vlab\tools\`。

> 手动方式：安装 [Icarus Verilog for Windows](https://bleyer.org/icarus/)，
> 然后把 `bin`、`lib`、`include` 复制到 `.vlab\tools\`，并把 `bin\iverilog.exe`、
> `bin\vvp.exe` 复制成 `.vlab\tools\icarus\iverilogx.exe`、`vvpx.exe`。

### 3. 启动

双击根目录的 **`启动训练.bat`**（或 `.vlab\启动训练.bat`）。

- 等待窗口出现 `✔ 启动成功！`
- 浏览器会自动打开；没有的话手动访问窗口里显示的地址（默认 `http://127.0.0.1:7826/`）
- **黑窗口可以直接关掉**，服务在后台继续运行

**停止服务**：双击 `停止训练.bat`。

> 端口被占用时会自动改用 7827、7828…，请看窗口里显示的实际地址。

---

## 项目结构

```
.
├─ 启动训练.bat / 停止训练.bat      用户入口
├─ 使用说明.md                      详细使用手册
├─ Verilog手写模拟卷.docx           可打印的题目卷
├─ Verilog参考答案.docx             题目 + 答案 + 考场要点
├─ 教材*.md / 期末复习*.md,pdf      复习参考资料
└─ .vlab/
   ├─ launch.bat / stop.bat         ASCII 启动/停止脚本
   ├─ server/
   │   ├─ app.js                    本地 HTTP 服务（127.0.0.1）
   │   ├─ launch.js                 启动器：选端口、拉服务、开浏览器
   │   ├─ stop.js                   停止服务
   │   ├─ judge.js                  题库加载 + 判题流程
   │   ├─ cli.js / cli_bridge.js    编译-仿真执行器（子进程）
   │   ├─ sim.js                    仿真封装
   │   ├─ proc.js                   子进程工具（含 TMP 重定向）
   │   ├─ lint.js                   静态检查规则
   │   ├─ tbgrade.js                Testbench 题专项评分
   │   ├─ exam.js / docxmaker.js    出卷（HTML / Word）
   │   └─ prebuild.js               测试台预编译
   ├─ web/                          前端（原生 JS + CodeMirror）
   ├─ data/
   │   ├─ problems/                 题库（每章一个 js 文件）
   │   ├─ tests/                    测试台（隐藏，不参与手写评分）
   │   └─ tbjudge.js                Testbench 评分辅助
   └─ tools/
       ├─ fetch-tools.bat           下载 Icarus（不入库）
       └─ icarus/                   编译器（不入库）
```

---

## 自己出题

题库在 `.vlab\data\problems\`，每题一个对象：

```js
{
  id: 'my_p01',
  title: '4 位二进制转格雷码',
  type: 'write',              // write | bug | fill | tb | quiz
  difficulty: 2,
  tags: ['组合逻辑'],
  brief: '一行描述',
  desc: `题目描述（支持 Markdown）`,
  files: [{ name: 'bin2gray.v', content: `module bin2gray (...);\n  // TODO\nendmodule\n` }],
  tests: [{ tb: 'bin2gray' }],   // 对应 data/tests/<章节>/tb_bin2gray.v
  solution: `module bin2gray (...); ... endmodule\n`,
}
```

再写一个测试台 `data/tests/<章节>/tb_bin2gray.v`，测试台用
`$display("[CHECK]P ...")` / `[CHECK]F ...` 输出结果即可被评分。
改完重启服务生效。

---

## 已知限制

1. **FSM 题统一使用寄存器输出**（三段式最后一级 `found <= (state==S3) && din;`）。
   纯组合 Mealy 输出在 Icarus 里会出现"上升沿后组合输出晚 1ns"的仿真差异，
   这也是工程上更推荐的写法。
2. 判题器是 **Icarus Verilog 14**（IEEE-1364-2005 + 部分 SystemVerilog）。
   Vivado 的 `always_ff`、`logic` 等 SystemVerilog 写法不完全支持。
3. **临时目录**：某些机器的用户 `TEMP` 目录不可写，会导致
   `Error opening temporary file ... Please check TMP or TMPDIR.`。
   本项目已强制把子进程的 `TMP/TEMP/TMPDIR` 指向 `.vlab\data\tmp` 规避此问题。
4. 测试台期望值由作者手工编写，若发现"正确答案被判错"，多半是测试台期望值问题，欢迎提 Issue。

---

## 技术说明

- **零 npm 依赖**：服务端只用 Node 标准库；前端是原生 JS + 本地打包的 CodeMirror
- **子进程 stdio 走文件**而非管道，避免某些 Windows 安全策略拦截
- **测试台预编译**：启动时把各题测试台编成快照，加快判题
- **静态检查启发式规则**覆盖教材常见扣分点

---

## 许可

代码部分可自由使用与修改。
`教材*.md`、`期末复习*.pdf` 等为**课程学习资料**，版权归原作者/课程所有，仅供学习参考。
Icarus Verilog 遵循 GPL，由 `tools/fetch-tools.bat` 单独下载，不包含在本仓库中。