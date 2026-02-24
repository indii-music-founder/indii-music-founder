"""
generate_press_release_pdf.py

Generates a professional, branded PDF press release from JSON data.
Part of the Publicist Agent specialist toolset.
"""

import sys
import json
import os
import argparse
from datetime import datetime
from reportlab.lib.pagesizes import LETTER
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Image
from reportlab.lib.enums import TA_CENTER, TA_LEFT

def generate_pdf(data, output_path):
    doc = SimpleDocTemplate(output_path, pagesize=LETTER, 
                            rightMargin=72, leftMargin=72, 
                            topMargin=72, bottomMargin=72)
    
    styles = getSampleStyleSheet()
    story = []

    # 1. FOR IMMEDIATE RELEASE
    fir_style = ParagraphStyle('FIR', parent=styles['Normal'], 
                               spaceAfter=12, fontSize=10, 
                               fontName='Helvetica-Bold')
    story.append(Paragraph("FOR IMMEDIATE RELEASE", fir_style))

    # 2. Headline
    headline_style = ParagraphStyle('Headline', parent=styles['Heading1'], 
                                   fontSize=18, fontName='Helvetica-Bold',
                                   leading=22, spaceAfter=20, alignment=TA_CENTER)
    story.append(Paragraph(data.get('headline', 'TITLE').upper(), headline_style))

    # 3. Dateline
    dateline_text = f"<b>{data.get('dateline', 'CITY, State')}</b> — "
    dateline_style = styles['Normal']
    
    # 4. Introduction & Body
    body_style = ParagraphStyle('Body', parent=styles['Normal'], 
                               spaceAfter=12, leading=14)
    
    intro_text = dateline_text + data.get('introduction', '')
    story.append(Paragraph(intro_text, body_style))

    for para in data.get('body_paragraphs', []):
        story.append(Paragraph(para, body_style))

    # 5. Quotes
    quote_style = ParagraphStyle('Quote', parent=styles['Normal'], 
                                leftIndent=30, rightIndent=30, 
                                italic=True, spaceBefore=10, spaceAfter=10)
    for quote in data.get('quotes', []):
        text = f"\"{quote.get('text', '')}\""
        speaker = f"— {quote.get('speaker', '')}"
        story.append(Paragraph(text, quote_style))
        story.append(Paragraph(speaker, ParagraphStyle('Speaker', parent=quote_style, leftIndent=50)))
        story.append(Spacer(1, 12))

    # 6. Boilerplate
    story.append(Spacer(1, 24))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.lightgrey))
    story.append(Spacer(1, 12))
    story.append(Paragraph("<b>About</b>", styles['Normal']))
    story.append(Paragraph(data.get('boilerplate', ''), body_style))

    # 7. Contact Info
    contact = data.get('contact_info', {})
    contact_text = f"<b>Media Contact:</b><br/>{contact.get('name', '')}<br/>{contact.get('email', '')}<br/>{contact.get('phone', '')}"
    story.append(Spacer(1, 12))
    story.append(Paragraph(contact_text, styles['Normal']))

    # 8. # # # (End of Release)
    story.append(Spacer(1, 24))
    story.append(Paragraph("# # #", ParagraphStyle('End', parent=styles['Normal'], alignment=TA_CENTER)))

    doc.build(story)

def main():
    parser = argparse.ArgumentParser(description='Generate Press Release PDF')
    parser.add_argument('json_data', help='JSON string containing release content')
    parser.add_argument('--output', help='Output path for the PDF')
    
    args = parser.parse_args()
    
    try:
        data = json.loads(args.json_data)
        output_path = args.output or f"press_release_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        
        # Ensure absolute path for output
        if not os.path.isabs(output_path):
            output_path = os.path.abspath(output_path)
            
        generate_pdf(data, output_path)
        
        # Output result for IPC
        result = {
            "success": True,
            "filePath": output_path,
            "message": f"PDF generated successfully at {output_path}"
        }
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()
