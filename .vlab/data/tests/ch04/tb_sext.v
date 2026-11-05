`timescale 1ns/1ps
module tb_sext;
  integer errors = 0;
  reg  [3:0] a;
  reg        signed_mode;
  wire [7:0] y;
  reg  [7:0] exp;
  integer k;

  sext dut (.a(a), .signed_mode(signed_mode), .y(y));

  task check;
    input [3:0] aa;
    input       sm;
    begin
      a = aa; signed_mode = sm; #1;
      if (sm) exp = {{4{aa[3]}}, aa};
      else    exp = {4'b0000, aa};
      if (y !== exp) begin
        errors = errors + 1;
        $display("[CHECK]F a=%b signed=%0d got=%b exp=%b", aa, sm, y, exp);
      end else begin
        $display("[CHECK]P a=%b signed=%0d y=%b", aa, sm, y);
      end
    end
  endtask

  initial begin
    for (k = 0; k < 16; k = k + 1) begin
      check(k[3:0], 1'b1);
      check(k[3:0], 1'b0);
    end
    $display("[ERRORS] %0d", errors);
    $finish;
  end
endmodule