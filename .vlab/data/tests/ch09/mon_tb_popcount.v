`timescale 1ns/1ps
module __vlab_mon_popcount8 (
    input wire [7:0] v_din
);
    reg s00, s55, sff, sa5;
    initial begin s00 = 0; s55 = 0; sff = 0; sa5 = 0; end
    always @(v_din) begin
        #0.001;
        if (v_din == 8'h00 && !s00) begin s00 = 1; $display("[SFC] D00 1"); end
        if (v_din == 8'h55 && !s55) begin s55 = 1; $display("[SFC] D55 1"); end
        if (v_din == 8'hFF && !sff) begin sff = 1; $display("[SFC] DFF 1"); end
        if (v_din == 8'hA5 && !sa5) begin sa5 = 1; $display("[SFC] DA5 1"); end
    end
endmodule