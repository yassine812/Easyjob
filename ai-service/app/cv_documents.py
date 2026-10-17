"""Bounded document inspection and factual CV PDF rendering. No network resources."""
import base64
from html import escape
import re
import pymupdf


def inspect_pdf(data: bytes) -> dict:
    if len(data) > 15 * 1024 * 1024 or not data.startswith(b'%PDF-'):
        raise ValueError('A PDF under 15 MB is required')
    with pymupdf.open(stream=data, filetype='pdf') as doc:
        if doc.needs_pass or len(doc) > 30:
            raise ValueError('Use an unencrypted CV with at most 30 pages')
        pages, texts = [], []
        for number, page in enumerate(doc):
            blocks = [b for b in page.get_text('blocks') if b[6] == 0 and b[4].strip()]
            text = page.get_text('text')
            texts.append(text)
            left = [b for b in blocks if b[2] < page.rect.width * .52]
            right = [b for b in blocks if b[0] > page.rect.width * .38]
            paired = any(abs(a[1] - b[1]) < 45 and a[2] < b[0] for a in left for b in right)
            pages.append({'page': number + 1, 'characters': len(text.strip()), 'imageCount': len(page.get_images()),
                          'possibleColumns': paired, 'possibleTables': len(page.get_drawings()) > 20,
                          'headerText': [b[4].strip() for b in blocks if b[1] < page.rect.height * .08],
                          'footerText': [b[4].strip() for b in blocks if b[3] > page.rect.height * .92],
                          'readingOrderNeedsReview': any(blocks[i][1] + 30 < blocks[i-1][1] for i in range(1, len(blocks))),
                          'textBlocks': [{'box': list(b[:4]), 'quote': b[4].strip()[:500]} for b in blocks[:80]]})
        return {'method': 'pdf_geometry_v1', 'pageCount': len(doc), 'text': '\n'.join(texts), 'pages': pages,
                'limitations': ['Column, table and reading-order flags are geometric indications for review, not ATS rejection predictions.',
                                'Text inside images is not OCR-verified. Sparse extraction requires an accessible text PDF.']}


def render_cv(content: str, template: str = 'modern', font_size: int = 14, document_html: str | None = None, document_css: str | None = None, margin: int = 42) -> dict:
    if not 20 <= len(content) <= 50000 or not 11 <= font_size <= 17:
        raise ValueError('Invalid CV content or font size')
    palettes = {'classic': '#243449', 'technology': '#193e4e', 'executive': '#126a58', 'academic': '#333333',
                'creative': '#984631', 'modern': '#24546c', 'precision': '#334b70', 'signature': '#80523d',
                'canadian-fr': '#243449', 'canadian-en': '#243449', 'french-cv': '#24546c',
                'us-resume': '#243449', 'uk-cv': '#334b70', 'international': '#24546c',
                'tech-ats': '#193e4e', 'corporate': '#344154', 'minimal-ats': '#243449',
                'modern-professional': '#63435f'}
    if template not in palettes:
        raise ValueError('Unknown CV template')
    if document_html is not None:
        return render_structured_cv(content, document_html, document_css or '', margin)
    lines, html = [], []
    for raw in content.splitlines():
        line = raw.strip()
        # Rejoin obvious extraction wraps, preserving every word and punctuation mark.
        # Contact/header lines and bullets remain separate.
        if lines and len(lines) > 2 and line[:1].islower() and '@' not in line and not re.match(r'^(?:https?://|www\.)', line) and lines[-1] and not lines[-1].startswith('#') and not lines[-1].isupper():
            lines[-1] += ' ' + line
        else:
            lines.append(line)
    previous_role, protected = False, {}
    for index, raw in enumerate(lines):
        line = raw.strip()
        if not line:
            continue
        clean = escape(re.sub(r'^#{1,6}\s+', '', line))
        role = not re.match(r'^[-*•●▪◦‣∙#]', line) and bool(re.search(r'\b(?:19|20)\d{2}\b.*(?:\b(?:19|20)\d{2}|Présent|Present)\s*$', line, re.I))
        if index == 0:
            html.append(f'<h1>{clean}</h1>')
        elif line.startswith('### '):
            html.append(f'<h3>{clean}</h3>')
            protected[len(html) - 1] = re.sub(r'^#{1,6}\s+', '', line)
        elif line.startswith('## ') or (len(line) < 75 and line.isupper()):
            html.append(f'<h2>{clean}</h2>')
            protected[len(html) - 1] = re.sub(r'^#{1,6}\s+', '', line)
        else:
            style = 'role' if role else 'company' if previous_role else ''
            html.append(f'<p class="{style}">{clean}</p>')
            if role:
                protected[len(html) - 1] = line
        previous_role = role
    accent = palettes[template]
    # A single reading column is intentional for the application artifact.
    css = f'body {{font-family: sans-serif; font-size:{font_size * .75}pt; color:#243449; line-height:1.3}} h1 {{font-size:25pt;color:{accent};margin:0 0 12pt}} h2 {{font-size:11pt;color:{accent};border-bottom:1px solid {accent};padding-bottom:4pt;margin:16pt 0 7pt;page-break-after:avoid}} h3 {{font-size:10.5pt;page-break-after:avoid}} p {{margin:0 0 3pt}}'
    if template in ('classic', 'academic', 'signature'):
        css += 'h1,h2 {font-family:serif} h1 {text-align:center}'
    css += 'p.role {font-weight:bold; margin-top:8pt; page-break-after:avoid} p.company {page-break-after:avoid}'
    def rectangle(number, filled):
        if number >= 30:
            raise ValueError('Rendered CV exceeds 30 pages')
        return pymupdf.Rect(0, 0, 595, 842), pymupdf.Rect(42, 40, 553, 802), None
    # MuPDF does not enforce CSS `avoid`. Inspect the actual layout and move
    # orphaned section/role headings, rather than pretending that rule worked.
    forced = set()
    doc = None
    for _ in range(5):
        if doc is not None:
            doc.close()
        flow = [block.replace('>', ' style="page-break-before:always">', 1) if i in forced else block for i, block in enumerate(html)]
        doc = pymupdf.Story(html=''.join(flow), user_css=css).write_with_links(rectangle)
        orphans = {i for i, label in protected.items() if i not in forced and any(rect.y0 > 725 for page in doc for rect in page.search_for(label))}
        if not orphans:
            break
        forced |= orphans
    try:
        data = doc.tobytes(garbage=4, deflate=True)
    finally:
        doc.close()
    inspected = inspect_pdf(data)
    # Refuse silent character loss; whitespace and bullet glyph changes are harmless.
    words = lambda s: re.findall(r'[^\W_]+', s.casefold())
    source_words = words(content)
    extracted_words = words(inspected['text'])
    if source_words != extracted_words:
        raise ValueError('PDF text differs from the approved CV; export cancelled')
    return {'pdfBase64': base64.b64encode(data).decode('ascii'), 'inspection': inspected, 'layout': 'ATS_SINGLE_COLUMN'}


def render_structured_cv(content: str, html: str, css: str, margin: int) -> dict:
    """Render the server-validated structured CV markup; no external assets or scripts."""
    if len(html) > 350000 or len(css) > 15000 or margin not in (32, 42, 54):
        raise ValueError('Invalid document layout')
    if re.search(r'<\s*(?:script|iframe|img|object|embed|link|style)\b|\bon\w+\s*=|javascript:', html, re.I) or re.search(r'url\s*\(|@import', css, re.I):
        raise ValueError('External or active document content is not supported')

    def rectangle(number, filled):
        if number >= 30:
            raise ValueError('Rendered CV exceeds 30 pages')
        return pymupdf.Rect(0, 0, 595.276, 841.89), pymupdf.Rect(margin, margin, 595.276-margin, 841.89-margin), None

    doc = pymupdf.Story(html=html, user_css=css).write_with_links(rectangle)
    try:
        data = doc.tobytes(garbage=4, deflate=True)
    finally:
        doc.close()
    inspected = inspect_pdf(data)
    words = lambda text: re.findall(r'[^\W_]+', text.casefold())
    if words(content) != words(inspected['text']):
        raise ValueError('PDF text differs from the approved CV; export cancelled')
    return {'pdfBase64': base64.b64encode(data).decode('ascii'), 'inspection': inspected, 'layout': 'STRUCTURED_A4'}
