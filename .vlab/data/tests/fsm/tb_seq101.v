`timescale 1ns/1ps
module tb_seq101;
  integer errors = 0;
  reg clk = 1'b0;
  reg rst_n = 1'b0;
  reg din = 1'b0;
  wire found;
  integer hits;
  integer i;
  integer n;
  integer exp_hits;
  reg [15:0] s;

  seq101_moore dut (.clk(clk), .rst_n(rst_n), .din(din), .found(found));
  always #5 clk = ~clk;

  task run;
    input [15:0] seq;
    input integer cnt;
    input integer expv;
    begin
      s = seq; n = cnt; exp_hits = expv;
      din = 1'b0;
      @(negedge clk); rst_n = 1'b0;
      @(negedge clk);
      @(posedge clk);
      @(negedge clk); #1; rst_n = 1'b1;
      @(posedge clk); #1;
      hits = 0;
      if (found === 1'b1) hits = hits + 1;
      for (i = 0; i < n; i = i + 1) begin
        din = s[n - 1 - i] == 1'b1;
        @(posedge clk); #1;
        if (found === 1'b1) hits = hits + 1;
      end
      if (hits !== exp_hits) begin
        errors = errors + 1;
        $display("[CHECK]F 序列 %0d 位：检测到 %0d 次，期望 %0d 次", n, hits, exp_hits);
      end else $display("[CHECK]P 序列 %0d 位：检测到 %0d 次", n, hits);
      din = 1'b0;
      @(negedge clk); #1; rst_n = 1'b0;
      @(posedge clk); #1;
      if (found !== 1'b0) begin errors = errors + 1; $display("[CHECK]F 复位后 found=%b（应为 0）", found); end
      else $display("[CHECK]P 复位后 found=0");
    end
  endtask

  initial begin
    run(16'b01101011, 8, 1);
    run(16'b000,      3, 0);
    run(16'b01010101, 8, 2);
    run(16'b111111,   6, 0);
    run(16'b00101,    5, 1);
    run(16'b101101,   6, 2);
    $display("[ERRORS] %0d", errors);
    $finish;
  end
endmodule