`timescale 1ns/1ps
module tb_rst_style;
  integer errors = 0;
  reg        clk = 1'b0;
  reg        rst_n = 1'b0;
  reg        en = 1'b0;
  reg  [7:0] d = 8'h00;
  wire [7:0] q_s, q_a;
  integer    k;

  rst_sync  dut_s (.clk(clk), .rst_n(rst_n), .en(en), .d(d), .q(q_s));
  rst_async dut_a (.clk(clk), .rst_n(rst_n), .en(en), .d(d), .q(q_a));
  always #5 clk = ~clk;

  initial begin
    // 1) 同步复位：复位保持期间，时钟沿到来才清零
    en = 1'b0; d = 8'h5A;
    repeat (2) @(negedge clk);
    if (q_s !== 8'h00) begin errors = errors + 1; $display("[CHECK]F sync reset: q=%h", q_s); end
    else $display("[CHECK]P sync reset -> q=0 (q_async=%h)", q_a);

    // 2) 释放复位并装载
    @(negedge clk); rst_n = 1'b1; en = 1'b1; d = 8'hA5;
    @(negedge clk); #1;
    if (q_s !== 8'hA5 || q_a !== 8'hA5) begin
      errors = errors + 1; $display("[CHECK]F load: q_s=%h q_a=%h exp=A5", q_s, q_a);
    end else $display("[CHECK]P load -> q_s=%h q_a=%h", q_s, q_a);

    // 3) 第一段结束
    $display("[ERRORS] %0d", errors);
    $finish;
  end
endmodule