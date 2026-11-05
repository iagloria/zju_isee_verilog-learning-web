`timescale 1ns/1ps
module tb_popcount8;
  integer errors = 0;
  reg  [7:0] din;
  wire [3:0] cnt;
  integer k, j;
  integer n;

  popcount8 dut (.din(din), .cnt(cnt));

  initial begin
    for (k = 0; k < 256; k = k + 1) begin
      din = k[7:0];
      #1;
      n = 0;
      for (j = 0; j < 8; j = j + 1) if (din[j]) n = n + 1;
      if (cnt !== n[3:0]) begin
        errors = errors + 1;
        $display("[CHECK]F din=%b got cnt=%0d exp=%0d", din, cnt, n);
      end else begin
        $display("[CHECK]P din=%b cnt=%0d", din, cnt);
      end
    end
    $display("[ERRORS] %0d", errors);
    $finish;
  end
endmodule