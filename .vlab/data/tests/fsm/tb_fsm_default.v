`timescale 1ns/1ps
module tb_fsm_default_bug;
  integer errors = 0;
  reg clk = 1'b0;
  reg rst_n = 1'b0;
  reg din = 1'b0;
  wire busy;
  integer i;

  fsm_default_bug dut (.clk(clk), .rst_n(rst_n), .din(din), .busy(busy));
  always #5 clk = ~clk;

  // 一个完整周期：先去 negedge 施加输入，再在下一个 posedge 之后采样
  task step;
    input d;
    begin
      @(negedge clk); din = d;
      @(posedge clk); #1;
    end
  endtask

  initial begin
    @(negedge clk); rst_n = 1'b0; din = 1'b0;
    repeat (2) @(negedge clk);
    @(negedge clk); rst_n = 1'b1;
    @(posedge clk); #1;
    if (busy !== 1'b1) begin errors = errors + 1; $display("[CHECK]F IDLE busy=%b exp=1", busy); end
    else $display("[CHECK]P IDLE busy=1");

    step(1'b1);                 // IDLE -> WORK
    if (busy !== 1'b1) begin errors = errors + 1; $display("[CHECK]F WORK busy=%b exp=1", busy); end
    else $display("[CHECK]P WORK busy=1");

    step(1'b1);                 // WORK -> DONE
    if (busy !== 1'b0) begin errors = errors + 1; $display("[CHECK]F DONE busy=%b exp=0", busy); end
    else $display("[CHECK]P DONE busy=0");

    step(1'b0);                 // DONE -> IDLE
    if (busy !== 1'b1) begin errors = errors + 1; $display("[CHECK]F back to IDLE busy=%b exp=1", busy); end
    else $display("[CHECK]P back to IDLE busy=1");

    for (i = 0; i < 40; i = i + 1) begin
      step(i % 3 != 0);
      if (busy === 1'bx) begin
        errors = errors + 1; $display("[CHECK]F busy is x at step %0d", i);
      end
    end
    $display("[CHECK]P ran 40 random steps without hanging");
    @(negedge clk); rst_n = 1'b0; #1;
    if (busy !== 1'b1) begin errors = errors + 1; $display("[CHECK]F reset busy=%b", busy); end
    else $display("[CHECK]P reset busy=1");
    $display("[ERRORS] %0d", errors);
    $finish;
  end
endmodule