# 有限状态机 FSM 重点专题与变式题

## 说明

FSM 是本门课最需要真正理解的专题。考试不应只背三段式模板，而要能从题意提取状态、画转移、确定 Moore/Mealy、处理复位和非法状态，再写可综合代码。

## 一、FSM 的硬件本质

FSM 由状态寄存器、次态组合逻辑和输出逻辑组成。状态寄存器在时钟沿保存状态；次态逻辑根据当前状态和输入计算下一状态；输出逻辑根据当前状态，或当前状态和输入产生输出。

Moore 输出只依赖当前状态，稳定但可能多一个状态或周期；Mealy 输出依赖当前状态和输入，响应快但输入变化可能直接造成输出变化。

## 二、从题意到状态图

1. 写出系统需要记住的历史信息。
2. 每一种历史情况定义一个状态。
3. 对每个状态分别讨论每种输入的下一状态。
4. 标出输出是在状态中有效，还是在转移条件成立时有效。

状态名应表达含义，例如 IDLE、SEEN_1、SEEN_10、DISPENSE、REFUND、DONE。不要只写 S0/S1 而不解释。

## 三、三段式模板

~~~verilog
module fsm_template(
    input wire clk,rst_n,din,
    output reg flag
);
    localparam IDLE=2'd0,S1=2'd1,S2=2'd2;
    reg [1:0] state,next_state;

    always @(posedge clk or negedge rst_n) begin
        if(!rst_n) state<=IDLE;
        else state<=next_state;
    end

    always @(*) begin
        next_state=IDLE;
        case(state)
            IDLE: if(din) next_state=S1;
                  else next_state=IDLE;
            S1: if(din) next_state=S1;
                else next_state=S2;
            S2: if(din) next_state=S1;
                else next_state=IDLE;
            default: next_state=IDLE;
        endcase
    end

    always @(*) begin
        flag=(state==S2 && din);
    end
endmodule
~~~

三个 always 的职责是：时序块只保存状态，组合块只计算次态，输出块只计算输出。

## 四、序列检测器：从 101 改题

检测 101 可定义：S0 没有匹配前缀，S1 最近匹配了 1，S2 最近匹配了 10，S3 已检测到 101。

~~~verilog
module seq101_moore(
    input wire clk,rst_n,din,
    output reg found
);
    localparam S0=2'd0,S1=2'd1,S2=2'd2,S3=2'd3;
    reg [1:0] state,next_state;

    always @(posedge clk or negedge rst_n) begin
        if(!rst_n) state<=S0;
        else state<=next_state;
    end

    always @(*) begin
        next_state=S0;
        case(state)
            S0: next_state=din ? S1 : S0;
            S1: next_state=din ? S1 : S2;
            S2: next_state=din ? S3 : S0;
            S3: next_state=din ? S1 : S0;
            default: next_state=S0;
        endcase
    end

    always @(*) found=(state==S3);
endmodule
~~~

检测到 101 后，若最后一个 1 可以作为下一次匹配开头，则允许重叠，通常回到 S1；若必须重新开始，则回到 S0。这是高频变题。其他变式：改成 1101；改成 Mealy；检测到后保持 found；改变复位；要求输出只持续一个周期。

## 五、自动售货机 FSM

假设价格为 2.5 元，投入 0.5 元或 1 元。状态可表示累计金额：IDLE、HALF、ONE、ONE5、TWO。达到价格后出货，超额时找零。

~~~verilog
always @(*) begin
    next_state=state;
    case(state)
        IDLE: begin
            if(coin_one) next_state=ONE;
            else if(coin_half) next_state=HALF;
        end
        HALF: begin
            if(coin_one) next_state=ONE5;
            else if(coin_half) next_state=ONE;
        end
        ONE: begin
            if(coin_one) next_state=TWO;
            else if(coin_half) next_state=ONE5;
        end
        ONE5: if(coin_one || coin_half) next_state=IDLE;
        TWO: if(coin_one || coin_half) next_state=IDLE;
        default: next_state=IDLE;
    endcase
end
~~~

考试中先画转移图，再决定出货和找零是 Moore 还是 Mealy。变式包括改变价格、退币、同时投入两种硬币、出货/找零单周期、busy/valid、错误和超时状态。

## 六、状态编码

二进制编码寄存器少、面积小，但译码可能复杂。Gray 编码相邻状态尽量只变一位，可减少切换。独热编码每个状态一位，寄存器多但译码简单、速度快，FPGA 中常见。

~~~verilog
localparam IDLE=4'b0001;
localparam S1=4'b0010;
localparam S2=4'b0100;
localparam DONE=4'b1000;
~~~

## 七、FSM 输出和时序

组合输出响应快但可能有毛刺；寄存器输出在时钟沿更新，稳定但可能延迟一个周期。题目要求固定脉冲或无毛刺时，考虑寄存器输出。

~~~verilog
always @(posedge clk or negedge rst_n) begin
    if(!rst_n) done<=1'b0;
    else begin
        done<=1'b0;
        if(state==WORK && last_count) done<=1'b1;
    end
end
~~~

## 八、FSM 代码审查清单

- 状态寄存器只在时钟块中更新。
- 时序块使用非阻塞赋值。
- 组合次态块有默认值。
- 每个状态对每个输入有明确转移。
- 有 default 非法状态恢复。
- 复位后的状态明确。
- Moore/Mealy 输出符合题意。
- 输出是否需要寄存、保持或单周期脉冲。
- 状态数量变化后编码位宽同步修改。
- 同时有效输入有明确优先级。
- 没有死循环、不可达状态或无法恢复状态。

## 九、FSM 编程训练

### 训练 1：序列检测

设计检测 1101 的 FSM，分别写允许重叠和禁止重叠两种版本。先画状态图，再写三段式代码。

### 训练 2：售货机

设计价格为 3 元、支持 1 元和 2 元输入的售货机。要求出货脉冲一个周期，超额时产生找零脉冲。

### 训练 3：握手协议

设计 IDLE、WAIT_ACK、DONE：收到 start 后发送 req，等待 ack，收到 ack 后产生一个周期 done。

### 训练 4：带超时握手

在 WAIT_ACK 增加计数器，超过若干周期仍未收到 ack 就进入 TIMEOUT。这是 FSM 与数据通路协作的典型题。

### 训练 5：非法状态恢复

在 Testbench 中验证非法状态是否回到 IDLE。可以使用 force 做仿真调试，但要说明它不是普通综合 RTL。

## 十、FSM 简答练习

1. 什么是 FSM？必须出现状态寄存器、次态逻辑、输出逻辑和时钟沿。
2. 比较 Moore 和 Mealy，必须出现输出依赖、响应速度、状态数量、毛刺和稳定性。
3. 为什么推荐三段式？必须出现职责分离、易读、易验证、时序与组合分开。
4. 为什么需要 default？必须出现非法状态恢复、避免卡死和安全性。
5. 比较二进制、Gray、独热编码，必须出现寄存器数量、译码复杂度、速度和适用场景。
6. 为什么状态输出有时需要寄存？必须出现减少毛刺、满足接口时序、固定脉冲宽度和可能增加延迟。

## 十一、考场写 FSM 的固定流程

1. 圈出输入、输出、时钟、复位和动作。
2. 列状态含义表。
3. 画每个状态对每个输入的转移。
4. 判断 Moore 或 Mealy。
5. 选编码并写 localparam。
6. 写状态寄存器。
7. 写次态逻辑，先给 next_state 默认值。
8. 写输出逻辑，先给输出默认值。
9. 加 default 和非法状态恢复。
10. 检查输出是否需要寄存、保持或单周期脉冲。

## 十二、最容易丢分

状态图没有覆盖输入组合；把输入发生时的输出误写成当前状态输出；序列检测器没有考虑重叠；default 缺失；次态逻辑不完整导致锁存器；时序块使用阻塞赋值；复位有效电平和敏感表不一致；出货、完成、找零输出没有按题目要求持续一个周期；状态数量变化后忘记修改编码位宽；把 FSM 当成软件流程，忽略状态寄存器只在时钟沿更新。

