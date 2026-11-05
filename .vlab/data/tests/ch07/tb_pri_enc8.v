`timescale 1ns/1ps
module tb_pri_enc8;
  integer errors = 0;
  reg  [7:0] in;
  wire [2:0] code;
  wire       valid;
  integer k;
  integer j;
  reg  [2:0] exp_code;
  reg        exp_valid;

  pri_enc8 dut (.in(in), .code(code), .valid(valid));

  initial begin
    for (k = 0; k < 256; k = k + 1) begin
      in = k[7:0];
      exp_code = 3'd0;
      exp_valid = 1'b0;
      for (j = 7; j >= 0; j = j - 1) begin
        if (in[j]) begin
          if (!exp_valid) begin
            exp_code = j[2:0];
            exp_valid = 1'b1;
          end
        end
      end
      #1;
      if (code !== exp_code || valid !== exp_valid) begin
        errors = errors + 1;
        $display("[CHECK]F in=%b got code=%0d valid=%b exp code=%0d valid=%b", in, code, valid, exp_code, exp_valid);
      end else begin
        $display("[CHECK]P in=%b code=%0d valid=%b", in, code, valid);
      end
    end
    $display("[ERRORS] %0d", errors);
    $finish;
  end
endmodule