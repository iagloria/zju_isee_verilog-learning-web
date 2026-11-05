`timescale 1ns/1ps
module tb_alu8;
  integer errors = 0;
  reg  [7:0] a, b;
  reg  [1:0] op;
  wire [7:0] y;
  reg  [7:0] exp;
  integer o;
  integer k;

  alu8 dut (.a(a), .b(b), .op(op), .y(y));

  initial begin
    for (o = 0; o < 4; o = o + 1) begin
      for (k = 0; k < 8; k = k + 1) begin
        case (k)
          0: begin a = 8'h00; b = 8'hFF; end
          1: begin a = 8'hFF; b = 8'h01; end
          2: begin a = 8'h80; b = 8'h80; end
          3: begin a = 8'h55; b = 8'hAA; end
          4: begin a = 8'h0F; b = 8'hF0; end
          5: begin a = 8'hFF; b = 8'hFF; end
          6: begin a = 8'h00; b = 8'h00; end
          default: begin a = $random; b = $random; end
        endcase
        op = o[1:0];
        #1;
        case (op)
          2'b00: exp = a + b;
          2'b01: exp = a - b;
          2'b10: exp = a & b;
          default: exp = a | b;
        endcase
        if (y !== exp) begin
          errors = errors + 1;
          $display("[CHECK]F op=%b a=%h b=%h got=%h exp=%h", op, a, b, y, exp);
        end else begin
          $display("[CHECK]P op=%b a=%h b=%h y=%h", op, a, b, y);
        end
      end
    end
    $display("[ERRORS] %0d", errors);
    $finish;
  end
endmodule