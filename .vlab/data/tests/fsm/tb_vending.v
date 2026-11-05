`timescale 1ns/1ps
module tb_vending;
  integer errors = 0;
  reg clk = 1'b0;
  reg rst_n = 1'b0;
  reg coin1 = 1'b0;
  reg coin2 = 1'b0;
  wire dispense, change;

  vending dut (.clk(clk), .rst_n(rst_n), .coin1(coin1), .coin2(coin2), .dispense(dispense), .change(change));
  always #5 clk = ~clk;

  reg saw_disp;
  reg saw_chg;

  task reset_machine;
    begin
      @(negedge clk); #4;
      rst_n = 1'b0; coin1 = 1'b0; coin2 = 1'b0;
      repeat (2) begin @(negedge clk); #4; end
      rst_n = 1'b1;
      @(negedge clk); #4;
      saw_disp = 1'b0; saw_chg = 1'b0;
    end
  endtask

  // 投一次硬币：输入在整个低电平期间稳定，下一个上升沿生效；之后在低电平后半段观察输出
  task insert;
    input c1, c2;
    begin
      @(negedge clk); #4;
      coin1 = c1; coin2 = c2;
      @(negedge clk); #4;         // 已经过一个上升沿：状态和输出都已更新
      if (dispense === 1'b1) saw_disp = 1'b1;
      if (change === 1'b1) saw_chg = 1'b1;
      if (dispense === 1'bx || change === 1'bx) begin
        errors = errors + 1; $display("[CHECK]F 输出出现 x");
      end
      coin1 = 1'b0; coin2 = 1'b0;
    end
  endtask

  task check;
    input exp_disp, exp_chg;
    input [8*28:1] name;
    begin
      if (saw_disp !== exp_disp || saw_chg !== exp_chg) begin
        errors = errors + 1;
        $display("[CHECK]F %0s：dispense=%b change=%b（期望 %b / %b）", name, saw_disp, saw_chg, exp_disp, exp_chg);
      end else $display("[CHECK]P %0s：dispense=%b change=%b", name, saw_disp, saw_chg);
    end
  endtask

  initial begin
    reset_machine;
    insert(1'b1, 1'b0); insert(1'b1, 1'b0); insert(1'b1, 1'b0);
    check(1'b1, 1'b0, "1+1+1 出货");
    insert(1'b0, 1'b0);
    if (dispense !== 1'b0 || change !== 1'b0) begin errors = errors + 1; $display("[CHECK]F 出货后应回到空闲"); end
    else $display("[CHECK]P 出货后回到空闲");

    reset_machine;
    insert(1'b0, 1'b1); insert(1'b1, 1'b0);
    check(1'b1, 1'b0, "2+1 出货");

    reset_machine;
    insert(1'b1, 1'b0); insert(1'b0, 1'b1);
    check(1'b1, 1'b0, "1+2 出货");

    reset_machine;
    insert(1'b1, 1'b0); insert(1'b1, 1'b0); insert(1'b0, 1'b1);
    check(1'b1, 1'b1, "1+1+2 出货+找零");

    reset_machine;
    insert(1'b0, 1'b1); insert(1'b0, 1'b1);
    check(1'b1, 1'b1, "2+2 出货+找零");

    reset_machine;
    repeat (5) insert(1'b0, 1'b0);
    check(1'b0, 1'b0, "不投币不出货");

    reset_machine;
    insert(1'b1, 1'b0); insert(1'b1, 1'b0); insert(1'b1, 1'b0); insert(1'b0, 1'b0); insert(1'b0, 1'b0);
    saw_disp = 1'b0; saw_chg = 1'b0;
    insert(1'b1, 1'b0);
    check(1'b0, 1'b0, "出货后金额清零");

    $display("[ERRORS] %0d", errors);
    $finish;
  end
endmodule
