"""Builds docs/Sample_Chat_Hinglish.pdf (one page) from transcript.json, which capture.ts writes from the REAL bot pipeline."""
import json, os
from xml.sax.saxutils import escape
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

here = os.path.dirname(os.path.abspath(__file__))
data = json.load(open(os.path.join(here, 'transcript.json'), encoding='utf-8'))
out = os.path.join(here, '..', 'Sample_Chat_Hinglish.pdf')
pdfmetrics.registerFont(TTFont('D', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DB', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
INK, GREEN = colors.HexColor('#1e2420'), colors.HexColor('#2f7d4f')
PERSON = {'Aman': colors.HexColor('#b4531c'), 'Raj': colors.HexColor('#1a5fb4'), 'Priya': colors.HexColor('#8e3b8e')}
USER_BG, BOT_BG, PAGE_BG = colors.HexColor('#d9fdd3'), colors.white, colors.HexColor('#efeae2')

def build(fs):
    lead = fs * 1.32
    H1 = ParagraphStyle('h1', fontName='DB', fontSize=17, leading=21, textColor=INK, spaceAfter=2)
    SUB = ParagraphStyle('sub', fontName='D', fontSize=8.6, leading=12, textColor=colors.HexColor('#4a524d'))
    T = ParagraphStyle('t', fontName='D', fontSize=fs, leading=lead, textColor=INK)
    NAME = lambda c: ParagraphStyle('n', fontName='DB', fontSize=fs - 1.3, leading=fs + 1, textColor=c)
    NOTE = ParagraphStyle('note', fontName='D', fontSize=8, leading=11, textColor=colors.HexColor('#4a524d'))

    def para(text):
        return Paragraph('<br/>'.join(escape(l) for l in text.split('\n')), T)

    def bubble(who, content, right):
        inner = [Paragraph(who, NAME(PERSON.get(who, GREEN)) if right else NAME(GREEN)), para(content)]
        t = Table([[inner]], colWidths=[118 * mm])
        t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), USER_BG if right else BOT_BG), ('ROUNDEDCORNERS', [7, 7, 7, 7]),
            ('LEFTPADDING', (0, 0), (-1, -1), 7), ('RIGHTPADDING', (0, 0), (-1, -1), 7), ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 5)]))
        t.hAlign = 'RIGHT' if right else 'LEFT'
        return t

    s = [Paragraph('Shared Living: ek din ka sample chat', H1),
         Paragraph('Ek flat, 3 dost: <b>Aman</b>, <b>Raj</b> aur <b>Priya</b>. Wo WhatsApp par bot se baat karte hain aur bot khana, saman aur paise ka hisaab sambhalta hai. '
                   '<b>Neeche ke saare jawab asli bot ke asli jawab hain</b> (WhatsApp ke bina, test mein chalaya gaya).', SUB), Spacer(1, 7)]
    for o in data:
        s += [bubble(o['who'], o['text'], True), Spacer(1, 2)]
        for b in o['bot']:
            s += [bubble('Bot', b, False), Spacer(1, 5)]
    s += [Spacer(1, 3), Paragraph(
        '<b>Dhyan do:</b> har dost bot se apni <b>private</b> chat mein baat karta hai; yahan sabko ek saath dikhaya gaya hai. '
        'Paise ka hisaab <b>code</b> karta hai, AI nahi. Ye app paisa hold ya transfer nahi karta, sirf likhta hai ki kisne diya aur kisko dena hai. '
        'Recipes aur nutrition abhi draft hain (expert review baaki).', NOTE)]
    return s

for fs in (8.6, 8.2, 7.8, 7.4, 7.0):
    doc = SimpleDocTemplate(out, pagesize=A4, leftMargin=12 * mm, rightMargin=12 * mm, topMargin=11 * mm, bottomMargin=10 * mm,
                            title='Shared Living: sample chat', author='Claude')
    doc.build(build(fs), onFirstPage=lambda c, d: (c.saveState(), c.setFillColor(PAGE_BG), c.rect(0, 0, A4[0], A4[1], stroke=0, fill=1), c.restoreState()),
              onLaterPages=lambda c, d: None)
    from subprocess import run, PIPE
    pages = int([l for l in run(['pdfinfo', out], stdout=PIPE, text=True).stdout.splitlines() if l.startswith('Pages')][0].split()[1])
    if pages == 1:
        print('one page at font size', fs); break
else:
    raise SystemExit('does not fit on one page')
