`timescale 1ns/1ps
module tb_fa_mid;
  integer errors = 0;
  reg  a, b, cin;
  wire sum, cout;
  integer k;

  fa_mid dut (.a(a), .b(b), .cin(cin), .sum(sum), .cout(cout));

  initial begin
    for (k = 0; k < 8; k = k + 1) begin
      {a, b, cin} = k[2:0];
      #1;
      if ({cout, sum} !== (a + b + cin)) begin
        errors = errors + 1;
        $display("[CHECK]F a=%b b=%b cin=%b got={%b,%b} exp={%b,%b}", a, b, cin, cout, sum, (a+b+cin)>>1, (a+b+cin));
      end else begin
        $display("[CHECK]P a=%b b=%b cin=%b -> {%b,%b}", a, b, cin, cout, sum);
      end
    end
    $display("[ERRORS] %0d", errors);
    $finish;
  end
endmodule