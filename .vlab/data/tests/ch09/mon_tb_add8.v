module __vlab_mon_add8 (input wire [7:0] v_a, input wire [7:0] v_b);
    reg s00, s01, sff1, s807f, s0709;
    initial begin s00 = 0; s01 = 0; sff1 = 0; s807f = 0; s0709 = 0; end
    always @(v_a or v_b) begin
        #0.001;
        if (v_a == 8'd0 && v_b == 8'd0 && !s00) begin s00 = 1; $display("[SFC] A00 1"); end
        if (v_a == 8'd1 && v_b == 8'd1 && !s01) begin s01 = 1; $display("[SFC] A01 1"); end
        if (v_a == 8'd255 && v_b == 8'd1 && !sff1) begin sff1 = 1; $display("[SFC] AFF1 1"); end
        if (v_a == 8'd128 && v_b == 8'd127 && !s807f) begin s807f = 1; $display("[SFC] A807F 1"); end
        if (v_a == 8'd7 && v_b == 8'd9 && !s0709) begin s0709 = 1; $display("[SFC] A0709 1"); end
    end
endmodule