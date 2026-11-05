`timescale 1ns/1ps
module tb_mux4_df;
  integer errors = 0;
  reg  [7:0] in0, in1, in2, in3;
  reg  [1:0] sel;
  reg        en_n;
  wire [7:0] y;
  reg  [7:0] exp;
  integer k;

  mux4_df dut (.in0(in0), .in1(in1), .in2(in2), .in3(in3), .sel(sel), .en_n(en_n), .y(y));

  task check;
    input [1:0] s;
    input       e;
    begin
      sel = s; en_n = e; #1;
      case (s)
        2'b00: exp = in0;
        2'b01: exp = in1;
        2'b10: exp = in2;
        default: exp = in3;
      endcase
      if (e) exp = 8'h00;
      if (y !== exp) begin
        errors = errors + 1;
        $display("[CHECK]F sel=%b en_n=%b got=%h exp=%h", s, e, y, exp);
      end else begin
        $display("[CHECK]P sel=%b en_n=%b y=%h", s, e, y);
      end
    end
  endtask

  initial begin
    in0 = 8'h11; in1 = 8'h22; in2 = 8'h33; in3 = 8'h44;
    for (k = 0; k < 8; k = k + 1) check(k[1:0], k[2]);
    in0 = 8'hFF; in1 = 8'h00; in2 = 8'hA5; in3 = 8'h5A;
    for (k = 0; k < 8; k = k + 1) check(k[1:0], k[2]);
    $display("[ERRORS] %0d", errors);
    $finish;
  end
endmodule