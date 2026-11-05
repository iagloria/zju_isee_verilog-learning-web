`timescale 1ns/1ps
module vlab_tb_add8;
    reg        clk;
    reg  [7:0] a;
    reg  [7:0] b;
    wire [7:0] sum;
    wire       cout;

    vlab_add8_w dut (.a(a), .b(b), .sum(sum), .cout(cout));

    initial begin
        clk = 1'b0;
        forever #5 clk = ~clk;
    end

    initial begin
        a = 8'd0;   b = 8'd0;   #3;
        $display("[VEC] 第 1 组 a=0   b=0   sum=%0d cout=%0d", sum, cout);
        a = 8'd1;   b = 8'd1;   #3;
        $display("[VEC] 第 2 组 a=1   b=1   sum=%0d cout=%0d", sum, cout);
        a = 8'd255; b = 8'd1;   #3;
        $display("[VEC] 第 3 组 a=255 b=1   sum=%0d cout=%0d", sum, cout);
        a = 8'd128; b = 8'd127; #3;
        $display("[VEC] 第 4 组 a=128 b=127 sum=%0d cout=%0d", sum, cout);
        a = 8'd7;   b = 8'd9;   #3;
        $display("[VEC] 第 5 组 a=7   b=9   sum=%0d cout=%0d", sum, cout);
        #2 $finish;
    end
endmodule