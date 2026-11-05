#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""把题库转成可打印、可批注的 Word 手写模拟卷。"""
import json
import re
import sys

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor


def set_font(run, name="Microsoft YaHei", size=None, bold=None, color=None):
    run.font.name = name
    run._element.rPr.rFonts.set(qn("w:eastAsia"), name)
    if size:
        run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold
    if color:
        run.font.color.rgb = color


def add_rich(par, text, size=10, base_bold=False):
    """把 **粗体**、`代码` 渲染成 Word run。"""
    text = text.replace("\u00a0", " ")
    tokens = re.split(r"(\*\*[^*]+\*\*|`[^`]+`)", text)
    for tok in tokens:
        if not tok:
            continue
        if tok.startswith("**") and tok.endswith("**"):
            r = par.add_run(tok[2:-2])
            set_font(r, "Microsoft YaHei", size, bold=True)
        elif tok.startswith("`") and tok.endswith("`"):
            r = par.add_run(tok[1:-1])
            set_font(r, "Consolas", size - 0.5)
            r.font.color.rgb = RGBColor(0x1B, 0x4F, 0x8A)
        else:
            r = par.add_run(tok)
            set_font(r, "Microsoft YaHei", size, bold=base_bold)


def md_to_doc(doc, md):
    """把简化 Markdown 转成 Word 段落/表格/代码块。"""
    lines = (md or "").replace("\r", "").split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        s = line.strip()
        if s.startswith("```"):
            buf = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                buf.append(lines[i])
                i += 1
            i += 1
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(6)
            r = p.add_run("\n".join(buf))
            set_font(r, "Consolas", 9)
            r.font.color.rgb = RGBColor(0x22, 0x22, 0x22)
            continue
        if s.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append(lines[i].strip())
                i += 1
            rows = [r for r in rows if not re.match(r"^\|[\s:|-]+\|$", r)]
            if rows:
                ncol = len([c for c in rows[0].strip("|").split("|")])
                table = doc.add_table(rows=0, cols=ncol)
                table.style = "Table Grid"
                table.alignment = WD_TABLE_ALIGNMENT.LEFT
                for ri, row in enumerate(rows):
                    cells = [c.strip() for c in row.strip("|").split("|")]
                    cells += [""] * (ncol - len(cells))
                    trow = table.add_row().cells
                    for ci, cell in enumerate(cells[:ncol]):
                        cp = trow[ci].paragraphs[0]
                        add_rich(cp, cell, size=9, base_bold=(ri == 0))
                doc.add_paragraph()
            continue
        if s.startswith(">"):
            buf = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                buf.append(lines[i].strip().lstrip(">").strip())
                i += 1
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Cm(0.5)
            for b in buf:
                add_rich(p, b, size=9)
            for r in p.runs:
                r.font.color.rgb = RGBColor(0x55, 0x55, 0x55)
            continue
        m = re.match(r"^(#{1,3})\s+(.*)$", s)
        if m:
            p = doc.add_paragraph()
            add_rich(p, m.group(2), size=11 if len(m.group(1)) == 1 else 10, base_bold=True)
            i += 1
            continue
        if re.match(r"^\s*[-*]\s+", line):
            while i < len(lines) and re.match(r"^\s*[-*]\s+", lines[i]):
                p = doc.add_paragraph(style="List Bullet")
                add_rich(p, re.sub(r"^\s*[-*]\s+", "", lines[i]), size=10)
                i += 1
            continue
        if re.match(r"^\s*\d+\.\s+", line):
            while i < len(lines) and re.match(r"^\s*\d+\.\s+", lines[i]):
                p = doc.add_paragraph(style="List Number")
                add_rich(p, re.sub(r"^\s*\d+\.\s+", "", lines[i]), size=10)
                i += 1
            continue
        if not s:
            i += 1
            continue
        buf = [s]
        i += 1
        while i < len(lines) and lines[i].strip() and not re.match(
            r"^(```|\s*\||\s*>|#{1,3}\s|\s*[-*]\s|\s*\d+\.\s)", lines[i]
        ):
            buf.append(lines[i].strip())
            i += 1
        p = doc.add_paragraph()
        add_rich(p, " ".join(buf), size=10)


TYPE_CN = {'write': '手写代码', 'bug': '找错改错', 'fill': '补全代码', 'tb': '写 Testbench', 'quiz': '概念选择'}


def build(data, out):
    doc = Document()
    sec = doc.sections[0]
    sec.top_margin = Cm(1.8)
    sec.bottom_margin = Cm(1.8)
    sec.left_margin = Cm(1.6)
    sec.right_margin = Cm(1.6)
    style = doc.styles["Normal"]
    style.font.name = "Microsoft YaHei"
    style.element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
    style.font.size = Pt(10)

    h = doc.add_paragraph()
    h.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = h.add_run(data.get("title", "硬件描述语言 · 手写模拟卷"))
    set_font(r, "Microsoft YaHei", 16, bold=True)

    sub = doc.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = sub.add_run("共 %d 题 · 建议限时 90 分钟 · 先手写作答，再用「Verilog 闯关训练」验证" % len(data["problems"]))
    set_font(r, "Microsoft YaHei", 9)
    r.font.color.rgb = RGBColor(0x66, 0x66, 0x66)
    doc.add_paragraph()

    for idx, p in enumerate(data["problems"], 1):
        head = doc.add_paragraph()
        r = head.add_run("第 %d 题  " % idx)
        set_font(r, "Microsoft YaHei", 11, bold=True)
        r = head.add_run("【%s · %s · 难度 %s】" % (p.get("tag", ""), TYPE_CN.get(p.get("type", ""), p.get("type", "")), "★" * int(p.get("difficulty", 1))))
        set_font(r, "Microsoft YaHei", 9)
        r.font.color.rgb = RGBColor(0x55, 0x55, 0x55)
        t = doc.add_paragraph()
        r = t.add_run(p.get("title", ""))
        set_font(r, "Microsoft YaHei", 12, bold=True)

        md_to_doc(doc, p.get("desc", ""))

        for f in p.get("files", []):
            fp = doc.add_paragraph()
            r = fp.add_run(f.get("name", ""))
            set_font(r, "Consolas", 8.5)
            r.font.color.rgb = RGBColor(0x66, 0x66, 0x66)
            code = doc.add_paragraph()
            r = code.add_run(f.get("content", ""))
            set_font(r, "Consolas", 9)

        box = doc.add_table(rows=1, cols=1)
        box.style = "Table Grid"
        cell = box.rows[0].cells[0]
        cell.width = Cm(17)
        p0 = cell.paragraphs[0]
        r = p0.add_run("作答区")
        set_font(r, "Microsoft YaHei", 8.5)
        r.font.color.rgb = RGBColor(0x99, 0x99, 0x99)
        for _ in range(9):
            cell.add_paragraph()
        doc.add_paragraph()

    doc.save(out)
    print("saved", out)


if __name__ == "__main__":
    with open(sys.argv[1], "r", encoding="utf-8") as f:
        build(json.load(f), sys.argv[2])