`timescale 1ns/1ps
module tb_ha_top;
  integer errors = 0;
  reg  a0, b0, a1, b1;
  wire s0, c0, s1, c1;
  integer k;

  top dut (.a0(a0), .b0(b0), .a1(a1), .b1(b1), .s0(s0), .c0(c0), .s1(s1), .c1(c1));

  initial begin
    for (k = 0; k < 16; k = k + 1) begin
      {a0, b0, a1, b1} = k[3:0];
      #1;
      if (s0 !== (a0 ^ b0) || c0 !== (a0 & b0) || s1 !== (a1 ^ b1) || c1 !== (a1 & b1)) begin
        errors = errors + 1;
        $display("[CHECK]F a0b0a1b1=%b got s0c0s1c1=%b%b%b%b exp=%b%b%b%b", k[3:0], s0, c0, s1, c1, a0^b0, a0&b0, a1^b1, a1&b1);
      end else begin
        $display("[CHECK]P in=%b ok", k[3:0]);
      end
    end
    $display("[ERRORS] %0d", errors);
    $finish;
  end
endmodule