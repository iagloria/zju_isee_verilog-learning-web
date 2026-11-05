`timescale 1ns/1ps
module tb_reduce;
  integer errors = 0;
  reg  [7:0] din;
  wire all_one, parity, any_one;
  integer k;

  reduce dut (.din(din), .all_one(all_one), .parity(parity), .any_one(any_one));

  initial begin
    for (k = 0; k < 256; k = k + 1) begin
      din = k[7:0];
      #1;
      if (all_one !== (din == 8'hFF) ||
          parity  !== (^din) ||
          any_one !== (din != 8'h00)) begin
        errors = errors + 1;
        $display("[CHECK]F din=%h got all_one=%b parity=%b any_one=%b", din, all_one, parity, any_one);
      end else begin
        $display("[CHECK]P din=%h all_one=%b parity=%b any_one=%b", din, all_one, parity, any_one);
      end
    end
    $display("[ERRORS] %0d", errors);
    $finish;
  end
endmodule