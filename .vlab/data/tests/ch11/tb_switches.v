`timescale 1ns/1ps
module tb_switches;
  integer errors = 0;
  reg  in;
  reg  a, b, sel;
  wire inv_out, mux_out;
  integer k;

  cmos_inv dut_inv (.in(in), .out(inv_out));
  tg_mux   dut_mux (.a(a), .b(b), .sel(sel), .y(mux_out));

  initial begin
    for (k = 0; k < 2; k = k + 1) begin
      in = k[0]; #1;
      if (inv_out !== ~in) begin errors = errors + 1; $display("[CHECK]F inv in=%b got=%b exp=%b", in, inv_out, ~in); end
      else $display("[CHECK]P inv in=%b out=%b", in, inv_out);
    end
    for (k = 0; k < 8; k = k + 1) begin
      {a, b, sel} = k[2:0];
      #1;
      if (mux_out !== (sel ? b : a)) begin
        errors = errors + 1;
        $display("[CHECK]F mux a=%b b=%b sel=%b got=%b exp=%b", a, b, sel, mux_out, sel ? b : a);
      end else begin
        $display("[CHECK]P mux a=%b b=%b sel=%b y=%b", a, b, sel, mux_out);
      end
    end
    $display("[ERRORS] %0d", errors);
    $finish;
  end
endmodule