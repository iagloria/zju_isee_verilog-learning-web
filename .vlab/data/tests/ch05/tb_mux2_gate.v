`timescale 1ns/1ps
module tb_mux2_gate;
  integer errors = 0;
  reg  a, b, s;
  wire y;
  integer k;

  mux2_gate dut (.a(a), .b(b), .s(s), .y(y));

  initial begin
    for (k = 0; k < 8; k = k + 1) begin
      {a, b, s} = k[2:0];
      #1;
      if (y !== (s ? b : a)) begin
        errors = errors + 1;
        $display("[CHECK]F a=%b b=%b s=%b got=%b exp=%b", a, b, s, y, s ? b : a);
      end else begin
        $display("[CHECK]P a=%b b=%b s=%b y=%b", a, b, s, y);
      end
    end
    $display("[ERRORS] %0d", errors);
    $finish;
  end
endmodule