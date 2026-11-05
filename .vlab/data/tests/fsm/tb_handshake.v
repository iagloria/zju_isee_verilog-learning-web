`timescale 1ns/1ps
module tb_handshake;
  integer errors = 0;
  reg clk = 1'b0;
  reg rst_n = 1'b0;
  reg start = 1'b0;
  reg ack = 1'b0;
  wire req, done;
  integer i;
  integer done_cycles;

  handshake dut (.clk(clk), .rst_n(rst_n), .start(start), .ack(ack), .req(req), .done(done));
  always #5 clk = ~clk;

  // 一个时钟周期：negedge 施加输入，posedge 后采样
  task step;
    begin
      @(negedge clk);
      @(posedge clk); #1;
    end
  endtask

  initial begin
    @(negedge clk); rst_n = 1'b0; start = 1'b0; ack = 1'b0;
    repeat (2) @(negedge clk);
    if (req !== 1'b0 || done !== 1'b0) begin errors = errors + 1; $display("[CHECK]F reset: req=%b done=%b", req, done); end
    else $display("[CHECK]P reset req=0 done=0");

    @(negedge clk); rst_n = 1'b1;

    // IDLE，done 应为 0
    @(negedge clk); #1;
    if (done !== 1'b0) begin errors = errors + 1; $display("[CHECK]F idle done=%b", done); end
    else $display("[CHECK]P idle done=0");

    // start 有效后进入 WAIT_ACK，req 拉高
    @(negedge clk); start = 1'b1;
    step(); step();
    if (req !== 1'b1) begin errors = errors + 1; $display("[CHECK]F after start: req=%b exp=1", req); end
    else $display("[CHECK]P after start req=1");

    // 释放 start，req 保持
    @(negedge clk); start = 1'b0;
    step(); step();
    if (req !== 1'b1) begin errors = errors + 1; $display("[CHECK]F waiting: req=%b exp=1", req); end
    else $display("[CHECK]P waiting req stays 1");
    if (done !== 1'b0) begin errors = errors + 1; $display("[CHECK]F waiting: done=%b", done); end
    else $display("[CHECK]P waiting done=0");

    // ack 有效 -> DONE，done=1，req=0
    @(negedge clk); ack = 1'b1;
    step();
    if (done !== 1'b1) begin errors = errors + 1; $display("[CHECK]F after ack: done=%b exp=1", done); end
    else $display("[CHECK]P after ack done=1");
    if (req !== 1'b0) begin errors = errors + 1; $display("[CHECK]F after ack: req=%b exp=0", req); end
    else $display("[CHECK]P after ack req=0");

    // done 必须是单周期：之后 10 拍不能再出现
    @(negedge clk); ack = 1'b0;
    done_cycles = 0;
    for (i = 0; i < 10; i = i + 1) begin
      @(posedge clk); #1;
      if (done === 1'b1) done_cycles = done_cycles + 1;
    end
    if (done_cycles !== 0) begin errors = errors + 1; $display("[CHECK]F done stayed high %0d more cycles", done_cycles); end
    else $display("[CHECK]P done is single-cycle pulse");

    // 复位随时生效
    @(negedge clk); start = 1'b1;
    step(); step();
    @(negedge clk); rst_n = 1'b0; start = 1'b0; #1;
    if (req !== 1'b0 || done !== 1'b0) begin errors = errors + 1; $display("[CHECK]F async reset: req=%b done=%b", req, done); end
    else $display("[CHECK]P async reset req=0 done=0");
    $display("[ERRORS] %0d", errors);
    $finish;
  end
endmodule