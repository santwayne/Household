"""Builds docs/Work_Status_Hinglish.pdf from work_log.json. Run: python3 docs/work_status/make_pdf.py
After every finished kaam: add it to work_log.json (tasks), bump update_no/date/last_completed, run this, and share the PDF."""
import json, os, sys
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

here = os.path.dirname(os.path.abspath(__file__))
data = json.load(open(os.path.join(here, 'work_log.json'), encoding='utf-8'))
out = os.path.join(here, '..', 'Work_Status_Hinglish.pdf')
pdfmetrics.registerFont(TTFont('D', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DB', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
GREEN, AMBER, RED, INK, LINE = colors.HexColor('#2f7d4f'), colors.HexColor('#b4531c'), colors.HexColor('#b3261e'), colors.HexColor('#1e2420'), colors.HexColor('#d8d6cc')
H1 = ParagraphStyle('h1', fontName='DB', fontSize=19, leading=24, textColor=INK, spaceAfter=3)
H2 = ParagraphStyle('h2', fontName='DB', fontSize=12.5, leading=16, textColor=GREEN, spaceBefore=12, spaceAfter=6)
P = ParagraphStyle('p', fontName='D', fontSize=9.5, leading=13.5, textColor=INK)
C = ParagraphStyle('c', fontName='D', fontSize=8.2, leading=11, textColor=INK)
CB = ParagraphStyle('cb', parent=C, fontName='DB')
TH = ParagraphStyle('th', parent=CB, textColor=colors.white)
SM = ParagraphStyle('sm', fontName='D', fontSize=8, leading=11, textColor=colors.HexColor('#66706a'))
COL = {'Ho gaya': GREEN, 'Code ho gaya': AMBER, 'Baaki': RED}
hexc = lambda c: '#%02x%02x%02x' % (int(c.red * 255), int(c.green * 255), int(c.blue * 255))

def tbl(header, rows, widths, bold0=True):
    d = [[Paragraph(h, TH) for h in header]] + rows
    t = Table(d, colWidths=[w * 1.27 * mm for w in widths], repeatRows=1)
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), GREEN), ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('GRID', (0, 0), (-1, -1), 0.4, LINE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f6f5f1')]), ('LEFTPADDING', (0, 0), (-1, -1), 4), ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]))
    return t

tasks, fixes, pending = data['tasks'], data['fixes'], data['pending']
cnt = {k: sum(1 for t in tasks if t['status'] == k) for k in COL}
s = [Paragraph(data['title'], H1),
     Paragraph(f"Update #{data['update_no']} · {data['date']} · Last kaam: {data['last_completed']}", SM), Spacer(1, 6),
     Paragraph(f"Ab tak <b>{len(tasks)} kaam</b> hue: <font color='{hexc(GREEN)}'><b>{cnt['Ho gaya']} Ho gaya</b></font>, <font color='{hexc(AMBER)}'><b>{cnt['Code ho gaya']} Code ho gaya</b></font> (bahar ka kaam baaki), aur {len(pending)} kaam aage baaki hain.", P),
     Spacer(1, 4),
     Paragraph("<b>Ho gaya</b> = code poora aur tests mein verify. <b>Code ho gaya</b> = code poora aur test hua, par asli credentials ya kisi insaan (expert, lawyer, native speaker) ki zaroorat hai. <b>Baaki</b> = bana hi nahi.", SM),
     Paragraph('1. Kaam ke hisaab se (ek ke baad ek)', H2)]
rows = []
for t in tasks:
    col = hexc(COL.get(t['status'], INK))
    rows.append([Paragraph(str(t['no']), CB), Paragraph(t['kaam'], CB), Paragraph(t['kiya'], C),
                 Paragraph(f"<font color='{col}'><b>{t['status']}</b></font>", C), Paragraph(t['proof'], C), Paragraph(t['aage'], C)])
s.append(tbl(['#', 'Kaam', 'Kya kiya', 'Status', 'Proof (kaise verify hua)', 'Aage kya karna hai'], rows, [8, 30, 62, 20, 50, 40]))
s += [Paragraph('2. Galtiyan jo mili aur theek ki', H2),
      tbl(['Galti', 'Kaise theek hui'], [[Paragraph(f['galti'], C), Paragraph(f['theek'], C)] for f in fixes], [110, 100])]
s += [Paragraph('3. Aage ke kaam', H2),
      tbl(['Kaam', 'Kaun karega', 'Kab'], [[Paragraph(p['kaam'], CB), Paragraph(p['kaun'], C), Paragraph(p['kab'], C)] for p in pending], [110, 55, 45])]
s += [Spacer(1, 8), Paragraph('Files ke detail: STATUS.md, PILOT_DECISION.md, README.md (repo mein). Numbers, prices aur competitor claims assumptions/secondary sources par hain.', SM)]
doc = SimpleDocTemplate(out, pagesize=landscape(A4), leftMargin=12*mm, rightMargin=12*mm, topMargin=12*mm, bottomMargin=12*mm, title=data['title'], author='Claude')
doc.build(s)
print('wrote', os.path.abspath(out))
