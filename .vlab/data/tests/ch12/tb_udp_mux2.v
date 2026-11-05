`timescale 1ns/1ps
module tb_udp_mux2;
  integer errors = 0;
  reg  a, b, sel;
  wire y;
  integer k;

  udp_mux2 dut (.y(y), .a(a), .b(b), .sel(sel));

  initial begin
    for (k = 0; k < 8; k = k + 1) begin
      {a, b, sel} = k[2:0];
      #1;
      if (y !== (sel ? b : a)) begin
        errors = errors + 1;
        $display("[CHECK]F a=%b b=%b sel=%b got=%b exp=%b", a, b, sel, y, sel ? b : a);
      end else begin
        $display("[CHECK]P a=%b b=%b sel=%b y=%b", a, b, sel, y);
      end
    end
    $display("[ERRORS] %0d", errors);
    $finish;
  end
endmodule