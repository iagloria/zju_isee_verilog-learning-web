`timescale 1ns/1ps
module tb_bus8;
  integer errors = 0;
  reg  en1, en2;
  reg  [7:0] data1, data2;
  wire [7:0] bus;
  integer k;

  bus8 dut (.en1(en1), .en2(en2), .data1(data1), .data2(data2), .bus(bus));

  task check;
    input       e1, e2;
    input [7:0] d1, d2;
    begin
      en1 = e1; en2 = e2; data1 = d1; data2 = d2; #1;
      if (e1 && !e2) begin
        if (bus !== d1) begin errors = errors + 1; $display("[CHECK]F en1 only: bus=%b exp=%b", bus, d1); end
        else $display("[CHECK]P en1 only bus=%b", bus);
      end else if (!e1 && e2) begin
        if (bus !== d2) begin errors = errors + 1; $display("[CHECK]F en2 only: bus=%b exp=%b", bus, d2); end
        else $display("[CHECK]P en2 only bus=%b", bus);
      end else if (!e1 && !e2) begin
        if (bus !== 8'hzz) begin errors = errors + 1; $display("[CHECK]F none: bus=%b exp=zz", bus); end
        else $display("[CHECK]P none -> high-Z");
      end
    end
  endtask

  initial begin
    check(1'b1, 1'b0, 8'hA5, 8'h5A);
    check(1'b0, 1'b1, 8'hA5, 8'h5A);
    check(1'b0, 1'b0, 8'hA5, 8'h5A);
    check(1'b1, 1'b0, 8'h00, 8'hFF);
    check(1'b0, 1'b1, 8'h00, 8'hFF);
    check(1'b0, 1'b0, 8'hFF, 8'hFF);
    $display("[ERRORS] %0d", errors);
    $finish;
  end
endmodule