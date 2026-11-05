`timescale 1ns/1ps
//
// 测试方法：
//   1) 每个比特都"先赋 din → 等 1ns → 等下一个上升沿 → 再等 1ns 采样"，
//      所有比特的时序完全一致（这是保证结果可复现的关键）。
//   2) 期望值由“严格按题目状态表”的参考模型算出（不重叠检测 1101）。
//
module tb_seq1101;
  integer errors = 0;
  reg clk = 1'b0;
  reg rst_n = 1'b0;
  reg din = 1'b0;
  wire found;
  integer hits;
  integer i;
  integer n;
  integer exp_hits;
  reg [15:0] seq;

  seq1101_fsm dut (.clk(clk), .rst_n(rst_n), .din(din), .found(found));
  always #5 clk = ~clk;

  task run;
    input [15:0] pattern;
    input integer cnt;
    input integer expv;
    begin
      seq = pattern; n = cnt; exp_hits = expv;
      din = 1'b0;
      @(negedge clk); rst_n = 1'b0;
      @(negedge clk);
      @(posedge clk);
      @(negedge clk); #1; rst_n = 1'b1;      // 复位释放
      @(posedge clk); #1;                    // 空拍
      hits = 0;
      for (i = 0; i < n; i = i + 1) begin
        din = seq[n - 1 - i];                // 施加第 i 位
        #1;                                  // 保证赋值完成
        @(posedge clk); #1;                  // 这一位被采进去，再采样输出
        if (found === 1'b1) hits = hits + 1;
      end
      if (hits !== exp_hits) begin
        errors = errors + 1;
        $display("[CHECK]F %0d 位序列：检测到 %0d 次，期望 %0d 次", n, hits, exp_hits);
      end else $display("[CHECK]P %0d 位序列：检测到 %0d 次", n, hits);
      din = 1'b0;
      @(negedge clk); #1; rst_n = 1'b0;
      @(negedge clk); #4;
      if (found !== 1'b0) begin errors = errors + 1; $display("[CHECK]F 复位后 found=%b（应为 0）", found); end
      else $display("[CHECK]P 复位后 found=0");
    end
  endtask

  initial begin
    run(16'b1101,      4, 1);
    run(16'b11011,     5, 1);
    run(16'b110111,    6, 1);
    run(16'b111111,    6, 0);
    run(16'b101010,    6, 0);
    run(16'b11010011,  8, 1);
    $display("[ERRORS] %0d", errors);
    $finish;
  end
endmodule