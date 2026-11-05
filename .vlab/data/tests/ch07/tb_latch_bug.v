`timescale 1ns/1ps
module tb_latch_bug;
  integer errors = 0;
  reg  en;
  reg  [7:0] d;
  wire [7:0] q;
  reg  [7:0] exp;

  latch_bug dut (.en(en), .d(d), .q(q));

  task check;
    input       e;
    input [7:0] dd;
    begin
      en = e; d = dd; #1;
      exp = e ? dd : 8'h00;
      if (q !== exp) begin
        errors = errors + 1;
        $display("[CHECK]F en=%0d d=%h got q=%h exp=%h", e, dd, q, exp);
      end else begin
        $display("[CHECK]P en=%0d d=%h q=%h", e, dd, q);
      end
    end
  endtask

  initial begin
    check(1'b1, 8'h5A);
    check(1'b0, 8'h5A);
    check(1'b1, 8'hA5);
    check(1'b0, 8'hA5);
    check(1'b1, 8'h00);
    check(1'b0, 8'hFF);
    $display("[ERRORS] %0d", errors);
    $finish;
  end
endmodule