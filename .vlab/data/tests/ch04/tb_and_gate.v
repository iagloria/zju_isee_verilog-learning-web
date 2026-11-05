`timescale 1ns/1ps
module tb_and_gate;
  integer errors = 0;
  reg  a, b;
  wire y;
  integer k;

  and_gate dut (.a(a), .b(b), .y(y));

  initial begin
    for (k = 0; k < 4; k = k + 1) begin
      {a, b} = k[1:0];
      #1;
      if (y !== (a & b)) begin
        errors = errors + 1;
        $display("[CHECK]F a=%b b=%b y=%b exp=%b", a, b, y, a & b);
      end else begin
        $display("[CHECK]P a=%b b=%b y=%b", a, b, y);
      end
    end
    $display("[ERRORS] %0d", errors);
    $finish;
  end
endmodule