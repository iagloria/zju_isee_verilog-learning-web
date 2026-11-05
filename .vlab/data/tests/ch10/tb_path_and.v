`timescale 1ns/1ps
module tb_path_and;
  integer errors = 0;
  reg  a, b;
  wire out;
  integer k;

  path_and dut (.a(a), .b(b), .out(out));

  initial begin
    for (k = 0; k < 4; k = k + 1) begin
      {a, b} = k[1:0];
      #10;
      if (out !== (a & b)) begin
        errors = errors + 1;
        $display("[CHECK]F a=%b b=%b out=%b exp=%b", a, b, out, a & b);
      end else begin
        $display("[CHECK]P a=%b b=%b out=%b", a, b, out);
      end
    end
    $display("[ERRORS] %0d", errors);
    $finish;
  end
endmodule