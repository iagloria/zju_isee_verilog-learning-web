`timescale 1ns/1ps
module tb_cnt_mod10;
  integer errors = 0;
  reg        clk   = 1'b0;
  reg        rst_n = 1'b0;
  reg        en    = 1'b1;
  wire [3:0] count;
  wire       tick;

  cnt_mod10 dut (.clk(clk), .rst_n(rst_n), .en(en), .count(count), .tick(tick));
  always #5 clk = ~clk;

  reg [3:0] prev;
  reg       armed = 1'b0;
  integer   n = 0;

  // 采样点：时钟低电平后半段（10c+9），本拍寄存器已稳定
  task sample;
    begin
      @(negedge clk); #4;
    end
  endtask

  initial begin
    // 第 0 拍：复位保持
    sample();
    rst_n = 1'b1;            // 10*0+9 释放复位，下一拍开始计数
    sample();                // 第 0 拍结束时的状态
    if (count !== 4'd0 && count !== 4'd1) begin
      errors = errors + 1; $display("[CHECK]F 复位释放后第一拍 count=%0d（应为 0 或 1）", count);
    end else $display("[CHECK]P 复位后 count=%0d", count);
    prev = count; armed = 1'b1;

    for (n = 1; n <= 30; n = n + 1) begin
      sample();
      if (count !== ((prev == 4'd9) ? 4'd0 : prev + 4'd1) || tick !== (prev == 4'd9)) begin
        errors = errors + 1;
        $display("[CHECK]F 第 %0d 拍 count=%0d tick=%b（期望 count=%0d tick=%b）", n, count, tick, (prev == 4'd9) ? 4'd0 : prev + 4'd1, (prev == 4'd9));
      end else begin
        $display("[CHECK]P 第 %0d 拍 count=%0d tick=%b", n, count, tick);
      end
      prev = count;
    end

    // 关使能 5 拍：count 保持、tick=0
    en = 1'b0;
    for (n = 1; n <= 5; n = n + 1) begin
      sample();
      if (count !== prev || tick !== 1'b0) begin
        errors = errors + 1;
        $display("[CHECK]F en=0 第 %0d 拍 count=%0d tick=%b（应保持 %0d / 0）", n, count, tick, prev);
      end else $display("[CHECK]P en=0 保持 count=%0d", count);
    end

    // 恢复使能
    en = 1'b1;
    sample();
    if (count !== ((prev == 4'd9) ? 4'd0 : prev + 4'd1)) begin
      errors = errors + 1; $display("[CHECK]F 恢复使能后 count=%0d（期望 %0d）", count, (prev == 4'd9) ? 4'd0 : prev + 4'd1);
    end else $display("[CHECK]P 恢复使能后 count=%0d", count);

    // 异步复位：不等时钟沿立即清零
    @(negedge clk); rst_n = 1'b0; #1;
    if (count !== 4'd0 || tick !== 1'b0) begin
      errors = errors + 1; $display("[CHECK]F 异步复位：count=%0d tick=%b（应立即为 0/0）", count, tick);
    end else $display("[CHECK]P 异步复位立即清零");

    $display("[ERRORS] %0d", errors);
    $finish;
  end
endmodule
