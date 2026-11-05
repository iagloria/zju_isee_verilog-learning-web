`timescale 1ns/1ps
module tb_reg8;
  integer errors = 0;
  reg        clk = 1'b0;
  reg        rst_n = 1'b0;
  reg        en;
  reg  [7:0] d;
  wire [7:0] q;
  integer k;

  reg8 dut (.clk(clk), .rst_n(rst_n), .en(en), .d(d), .q(q));
  always #5 clk = ~clk;

  task tick;
    begin
      @(negedge clk);
    end
  endtask

  initial begin
    en = 1'b1; d = 8'h00;
    // 复位期间：任意时钟沿后 q 都要为 0
    repeat (2) begin
      @(negedge clk); d = $random;
      if (q !== 8'h00) begin errors = errors + 1; $display("[CHECK]F reset: q=%h exp=00", q); end
      else $display("[CHECK]P reset keeps q=0");
    end
    // 复位释放
    @(negedge clk); rst_n = 1'b1; en = 1'b1; d = 8'hA5;
    @(negedge clk);
    if (q !== 8'hA5) begin errors = errors + 1; $display("[CHECK]F load: q=%h exp=A5", q); end
    else $display("[CHECK]P load en=1 -> q=%h", q);
    // 保持
    @(negedge clk); en = 1'b0; d = 8'h3C;
    @(negedge clk); @(negedge clk);
    if (q !== 8'hA5) begin errors = errors + 1; $display("[CHECK]F hold: q=%h exp=A5", q); end
    else $display("[CHECK]P hold en=0 -> q=%h", q);
    // 再装载
    @(negedge clk); en = 1'b1; d = 8'h5A;
    @(negedge clk);
    if (q !== 8'h5A) begin errors = errors + 1; $display("[CHECK]F load2: q=%h exp=5A", q); end
    else $display("[CHECK]P load2 -> q=%h", q);
    // 随机 20 次
    for (k = 0; k < 20; k = k + 1) begin
      @(negedge clk); en = $random; d = $random;
      @(negedge clk);
      if (en && q !== d) begin errors = errors + 1; $display("[CHECK]F rand en=%b d=%h q=%h", en, d, q); end
      else $display("[CHECK]P rand en=%b d=%h q=%h", en, d, q);
    end
    // 异步复位：不等时钟沿，立即清零
    @(negedge clk); rst_n = 1'b0; #1;
    if (q !== 8'h00) begin errors = errors + 1; $display("[CHECK]F async reset: q=%h exp=00", q); end
    else $display("[CHECK]P async reset -> q=0");
    $display("[ERRORS] %0d", errors);
    $finish;
  end
endmodule