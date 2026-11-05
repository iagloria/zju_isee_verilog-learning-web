#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""生成 Word 版答案册：题目 + 参考答案 + 考场要点。"""
import json
import re
import sys

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

TYPE_CN = {"write": "手写代码", "bug": "找错改错", "fill": "补全代码", "tb": "写 Testbench", "quiz": "概念选择"}


def set_font(run, name="Microsoft YaHei", size=None, bold=None):
    run.font.name = name
    run._element.rPr.rFonts.set(qn("w:eastAsia"), name)
    if size:
        run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold


def add_rich(par, text, size=10, bold=False):
    for tok in re.split(r"(\*\*[^*]+\*\*|`[^`]+`)", text or ""):
        if not tok:
            continue
        if tok.startswith("**") and tok.endswith("**"):
            r = par.add_run(tok[2:-2])
            set_font(r, "Microsoft YaHei", size, True)
        elif tok.startswith("`") and tok.endswith("`"):
            r = par.add_run(tok[1:-1])
            set_font(r, "Consolas", size - 0.5)
            r.font.color.rgb = RGBColor(0x1B, 0x4F, 0x8A)
        else:
            r = par.add_run(tok)
            set_font(r, "Microsoft YaHei", size, bold)


def md_to_doc(doc, md, size=9.5):
    lines = (md or "").replace("\r", "").split("\n")
    i = 0
    while i < len(lines):
        s = lines[i].strip()
        if s.startswith("```"):
            buf = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                buf.append(lines[i])
                i += 1
            i += 1
            p = doc.add_paragraph()
            r = p.add_run("\n".join(buf))
            set_font(r, "Consolas", 8.5)
            continue
        if s.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append(lines[i].strip())
                i += 1
            rows = [r for r in rows if not re.match(r"^\|[\s:|-]+\|$", r)]
            if rows:
                ncol = len(rows[0].strip("|").split("|"))
                table = doc.add_table(rows=0, cols=ncol)
                table.style = "Table Grid"
                for ri, row in enumerate(rows):
                    cells = [c.strip() for c in row.strip("|").split("|")] + [""] * ncol
                    trow = table.add_row().cells
                    for ci in range(ncol):
                        add_rich(trow[ci].paragraphs[0], cells[ci], 8.5, ri == 0)
            continue
        if s.startswith(">"):
            buf = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                buf.append(lines[i].strip().lstrip(">").strip())
                i += 1
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Cm(0.4)
            for b in buf:
                add_rich(p, b, 8.5)
            continue
        m = re.match(r"^(#{1,4})\s+(.*)$", s)
        if m:
            add_rich(doc.add_paragraph(), m.group(2), 10, True)
            i += 1
            continue
        if re.match(r"^\s*[-*]\s+", lines[i]):
            while i < len(lines) and re.match(r"^\s*[-*]\s+", lines[i]):
                add_rich(doc.add_paragraph(style="List Bullet"), re.sub(r"^\s*[-*]\s+", "", lines[i]), size)
                i += 1
            continue
        if not s:
            i += 1
            continue
        buf = [s]
        i += 1
        while i < len(lines) and lines[i].strip() and not re.match(r"^(```|\s*\||\s*>|#{1,4}\s|\s*[-*]\s)", lines[i]):
            buf.append(lines[i].strip())
            i += 1
        add_rich(doc.add_paragraph(), " ".join(buf), size)


def build(data, out):
    doc = Document()
    sec = doc.sections[0]
    sec.top_margin = Cm(1.6)
    sec.bottom_margin = Cm(1.6)
    sec.left_margin = Cm(1.5)
    sec.right_margin = Cm(1.5)
    style = doc.styles["Normal"]
    style.font.name = "Microsoft YaHei"
    style.element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
    style.font.size = Pt(9.5)

    h = doc.add_paragraph()
    h.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = h.add_run(data.get("title", "Verilog 参考答案册"))
    set_font(r, "Microsoft YaHei", 16, True)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("题目 + 参考答案 + 考场提醒 · 共 %d 题" % len(data["problems"]))
    set_font(r, "Microsoft YaHei", 9)
    r.font.color.rgb = RGBColor(0x66, 0x66, 0x66)
    doc.add_paragraph()

    for idx, prob in enumerate(data["problems"], 1):
        p = doc.add_paragraph()
        r = p.add_run("第 %d 题  %s" % (idx, prob.get("title", "")))
        set_font(r, "Microsoft YaHei", 12, True)
        p = doc.add_paragraph()
        r = p.add_run("【%s · %s · 难度 %s】" % (prob.get("chapterTitle", ""), TYPE_CN.get(prob.get("type"), prob.get("type")), "★" * int(prob.get("difficulty", 1))))
        set_font(r, "Microsoft YaHei", 8.5)
        r.font.color.rgb = RGBColor(0x55, 0x55, 0x55)

        md_to_doc(doc, prob.get("desc", ""))
        doc.add_paragraph()
        p = doc.add_paragraph()
        r = p.add_run("参考答案")
        set_font(r, "Microsoft YaHei", 10, True)
        if prob.get("solution"):
            c = doc.add_paragraph()
            r = c.add_run(prob["solution"])
            set_font(r, "Consolas", 8.5)
            c.paragraph_format.space_after = Pt(6)
        elif prob.get("quiz"):
            for qi, q in enumerate(prob["quiz"]["questions"], 1):
                p = doc.add_paragraph()
                r = p.add_run("%d. %s → %s。%s" % (qi, q["q"], "ABCD"[q["answer"]], q.get("why", "")))
                set_font(r, "Microsoft YaHei", 9)
        for k in prob.get("keyPoints", []) or []:
            p = doc.add_paragraph(style="List Bullet")
            add_rich(p, k, 9)
        doc.add_paragraph()

    doc.save(out)
    print("saved", out)


if __name__ == "__main__":
    with open(sys.argv[1], "r", encoding="utf-8") as f:
        build(json.load(f), sys.argv[2])