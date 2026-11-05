`timescale 1ns/1ps
module tb_add4;
  integer errors = 0;
  reg  [3:0] a, b;
  reg        cin;
  wire [3:0] sum;
  wire       cout;
  integer k;

  add4 dut (.a(a), .b(b), .cin(cin), .sum(sum), .cout(cout));

  task check;
    input [3:0] aa, bb;
    input       cc;
    reg   [4:0] exp;
    begin
      a = aa; b = bb; cin = cc; #1;
      exp = {1'b0, aa} + {1'b0, bb} + cc;
      if ({cout, sum} !== exp) begin
        errors = errors + 1;
        $display("[CHECK]F a=%0d b=%0d cin=%0d got={cout,sum}={%0d,%0d} exp={%0d,%0d}", aa, bb, cc, cout, sum, exp[4], exp[3:0]);
      end else begin
        $display("[CHECK]P a=%0d b=%0d cin=%0d -> {%0d,%0d}", aa, bb, cc, cout, sum);
      end
    end
  endtask

  initial begin
    check(4'd4,  4'd3,  1'b0);
    check(4'd15, 4'd0,  1'b1);
    check(4'd15, 4'd15, 1'b1);
    check(4'd8,  4'd8,  1'b0);
    check(4'd0,  4'd0,  1'b0);
    for (k = 0; k < 200; k = k + 1) begin
      check($random, $random, $random);
    end
    $display("[ERRORS] %0d", errors);
    $finish;
  end
endmodule