`timescale 1ns/1ps
module tb_ripple4;
  integer errors = 0;
  reg  [3:0] a, b;
  reg        cin;
  wire [3:0] sum;
  wire       cout;
  integer k;

  ripple4 dut (.a(a), .b(b), .cin(cin), .sum(sum), .cout(cout));

  task check;
    input [3:0] aa, bb;
    input       cc;
    reg   [4:0] exp;
    begin
      a = aa; b = bb; cin = cc; #1;
      exp = {1'b0, aa} + {1'b0, bb} + cc;
      if ({cout, sum} !== exp) begin
        errors = errors + 1;
        $display("[CHECK]F a=%h b=%h cin=%b got={%b,%h} exp={%b,%h}", aa, bb, cc, cout, sum, exp[4], exp[3:0]);
      end else begin
        $display("[CHECK]P a=%h b=%h cin=%b -> {%b,%h}", aa, bb, cc, cout, sum);
      end
    end
  endtask

  initial begin
    check(4'hF, 4'h1, 1'b0);
    check(4'hF, 4'hF, 1'b1);
    check(4'h0, 4'h0, 1'b0);
    check(4'h7, 4'h8, 1'b1);
    for (k = 0; k < 300; k = k + 1)
      check($random, $random, $random);
    $display("[ERRORS] %0d", errors);
    $finish;
  end
endmodule