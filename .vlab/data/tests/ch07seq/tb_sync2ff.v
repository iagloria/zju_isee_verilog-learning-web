`timescale 1ns/1ps
module tb_sync2ff;
  integer errors = 0;
  reg clk = 1'b0;
  reg rst_n = 1'b0;
  reg async_in = 1'b0;
  wire sync2;
  integer k;

  sync2ff dut (.clk(clk), .rst_n(rst_n), .async_in(async_in), .sync2(sync2));
  always #5 clk = ~clk;

  initial begin
    repeat (2) @(negedge clk);
    if (sync2 !== 1'b0) begin errors = errors + 1; $display("[CHECK]F reset: sync2=%b", sync2); end
    else $display("[CHECK]P reset sync2=0");
    @(negedge clk); rst_n = 1'b1;
    @(negedge clk); async_in = 1'b1;
    @(posedge clk); #1;
    if (sync2 !== 1'b0) begin errors = errors + 1; $display("[CHECK]F 1 clk after input: sync2=%b exp=0", sync2); end
    else $display("[CHECK]P after 1 clk sync2=0");
    @(posedge clk); #1;
    if (sync2 !== 1'b1) begin errors = errors + 1; $display("[CHECK]F 2 clks after input: sync2=%b exp=1", sync2); end
    else $display("[CHECK]P after 2 clks sync2=1");
    @(negedge clk); async_in = 1'b0;
    @(posedge clk); #1;
    if (sync2 !== 1'b1) begin errors = errors + 1; $display("[CHECK]F falling 1 clk: sync2=%b exp=1", sync2); end
    else $display("[CHECK]P falling after 1 clk sync2=1");
    @(posedge clk); #1;
    if (sync2 !== 1'b0) begin errors = errors + 1; $display("[CHECK]F falling 2 clks: sync2=%b exp=0", sync2); end
    else $display("[CHECK]P falling after 2 clks sync2=0");
    @(negedge clk); rst_n = 1'b0; #1;
    if (sync2 !== 1'b0) begin errors = errors + 1; $display("[CHECK]F async reset: sync2=%b", sync2); end
    else $display("[CHECK]P async reset sync2=0");
    $display("[ERRORS] %0d", errors);
    $finish;
  end
endmodule