`timescale 1ns/1ps
module tb_add8_bug;
  integer errors = 0;
  reg  [7:0] a, b;
  wire [7:0] sum;
  wire       cout;
  integer k;

  add8_bug dut (.a(a), .b(b), .sum(sum), .cout(cout));

  task check;
    input [7:0] aa, bb;
    reg   [8:0] exp;
    begin
      a = aa; b = bb; #1;
      exp = {1'b0, aa} + {1'b0, bb};
      if ({cout, sum} !== exp) begin
        errors = errors + 1;
        $display("[CHECK]F a=%0d b=%0d got cout=%b sum=%0d exp cout=%b sum=%0d", aa, bb, cout, sum, exp[8], exp[7:0]);
      end else begin
        $display("[CHECK]P a=%0d b=%0d -> cout=%b sum=%0d", aa, bb, cout, sum);
      end
    end
  endtask

  initial begin
    check(8'd100, 8'd100);
    check(8'd200, 8'd100);
    check(8'd255, 8'd1);
    check(8'd1,   8'd1);
    check(8'd0,   8'd0);
    for (k = 0; k < 50; k = k + 1) check({4'd0, $random} , {4'd0, $random});
    $display("[ERRORS] %0d", errors);
    $finish;
  end
endmodule