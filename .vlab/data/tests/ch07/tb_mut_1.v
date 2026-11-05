`timescale 1ns/1ps
module tb_mut_1;
  integer errors = 0;
  reg        clk = 1'b0;
  reg        rst_n = 1'b0;
  reg  [3:0] a, b;
  wire [3:0] y;
  reg  [3:0] exp;
  integer k;

  inv_n #(.WIDTH(4)) dut (.a(a), .y(y));

  initial begin
    for (k = 0; k < 16; k = k + 1) begin
      a = k[3:0]; #1;
      exp = ~a;
      if (y !== exp) begin
        errors = errors + 1;
        $display("[CHECK]F WIDTH=4 a=%b got=%b exp=%b", a, y, exp);
      end else begin
        $display("[CHECK]P WIDTH=4 a=%b y=%b", a, y);
      end
    end
    $display("[ERRORS] %0d", errors);
    $finish;
  end
endmodule