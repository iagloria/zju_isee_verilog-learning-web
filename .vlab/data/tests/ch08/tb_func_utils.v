`timescale 1ns/1ps
module tb_func_utils;
  integer errors = 0;
  reg  [7:0] din;
  wire       par;
  wire [7:0] rev;
  integer k, j;
  reg  [7:0] exp_rev;
  integer n;

  func_utils dut (.din(din), .par(par), .rev(rev));

  initial begin
    for (k = 0; k < 256; k = k + 1) begin
      din = k[7:0];
      #1;
      for (j = 0; j < 8; j = j + 1) exp_rev[j] = din[7 - j];
      if (par !== (^din) || rev !== exp_rev) begin
        errors = errors + 1;
        $display("[CHECK]F din=%b got par=%b rev=%b exp par=%b rev=%b", din, par, rev, ^din, exp_rev);
      end else begin
        $display("[CHECK]P din=%b par=%b rev=%b", din, par, rev);
      end
    end
    $display("[ERRORS] %0d", errors);
    $finish;
  end
endmodule