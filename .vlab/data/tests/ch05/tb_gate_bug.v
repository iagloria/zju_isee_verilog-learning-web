`timescale 1ns/1ps
module tb_gate_bug;
  integer errors = 0;
  reg  a, b;
  wire y, yn;
  integer k;

  gate_bug dut (.a(a), .b(b), .y(y), .yn(yn));

  initial begin
    for (k = 0; k < 4; k = k + 1) begin
      {a, b} = k[1:0];
      #1;
      if (y !== (a & b) || yn !== ~(a & b)) begin
        errors = errors + 1;
        $display("[CHECK]F a=%b b=%b got y=%b yn=%b exp y=%b yn=%b", a, b, y, yn, a & b, ~(a & b));
      end else begin
        $display("[CHECK]P a=%b b=%b y=%b yn=%b", a, b, y, yn);
      end
    end
    $display("[ERRORS] %0d", errors);
    $finish;
  end
endmodule