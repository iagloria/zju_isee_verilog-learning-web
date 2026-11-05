module tb_add8;
    reg        clk;
    reg  [7:0] a;
    reg  [7:0] b;
    wire [7:0] sum;
    wire       cout;

    add8 dut (.a(a), .b(b), .sum(sum), .cout(cout));

    initial begin
        clk = 1'b0;
        forever #5 clk = ~clk;
    end

    initial begin
        a = 8'd0;   b = 8'd0;   #10;
        a = 8'd1;   b = 8'd1;   #10;
        a = 8'd255; b = 8'd1;   #10;
        a = 8'd128; b = 8'd127; #10;
        a = 8'd7;   b = 8'd9;   #10;
        $display("a=%0d b=%0d sum=%0d cout=%0d", a, b, sum, cout);
        $finish;
    end

    initial $monitor("t=%0t a=%0d b=%0d sum=%0d cout=%0d", $time, a, b, sum, cout);
endmodule