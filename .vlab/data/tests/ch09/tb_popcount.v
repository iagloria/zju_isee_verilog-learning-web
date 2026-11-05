module tb_popcount;
    reg  [7:0] din;
    wire [3:0] cnt;
    reg  [7:0] vectors [0:3];
    integer    fd;
    integer    i;

    popcount8 dut (.din(din), .cnt(cnt));

    initial begin
        fd = $fopen("result.txt", "w");
        if (fd == 0) begin
            $display("ERROR: cannot open result.txt");
            $finish;
        end

        $readmemh("vectors.hex", vectors);

        for (i = 0; i < 4; i = i + 1) begin
            din = vectors[i];
            #2;
            $display("time=%0t din=%h cnt=%0d", $time, din, cnt);
            $fdisplay(fd, "time=%0t din=%h cnt=%0d", $time, din, cnt);
        end

        $fclose(fd);
        #5 $finish;
    end
endmodule