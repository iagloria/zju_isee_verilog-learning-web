`timescale 1ns/1ps
module tb_shift3_bug;
  integer errors = 0;
  reg  clk = 1'b0;
  reg  din = 1'b0;
  wire q2;
  integer k;

  shift3_bug dut (.clk(clk), .din(din), .q2(q2));
  always #5 clk = ~clk;

  // 检查 q2 相对 din 的延迟拍数：在 posedge 之后一个单位采样
  reg [3:0] hist;
  integer   delay_seen;

  initial begin
    @(negedge clk); din = 1'b0;
    repeat (2) @(negedge clk);
    @(negedge clk); din = 1'b1;
    // 记录 3 个时钟沿后的 q2
    for (k = 1; k <= 3; k = k + 1) begin
      @(posedge clk); #1;
      if (q2 !== (k >= 3)) begin
        errors = errors + 1;
        $display("[CHECK]F after %0d clk: q2=%b exp=%b（应延迟 3 拍）", k, q2, (k >= 3));
      end else begin
        $display("[CHECK]P after %0d clk q2=%b", k, q2);
      end
    end
    $display("[ERRORS] %0d", errors);
    $finish;
  end
endmodule