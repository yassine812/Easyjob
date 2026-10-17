import base64
import pytest
import pymupdf
from app.cv_documents import render_cv, inspect_pdf

@pytest.mark.parametrize('template', ['classic', 'technology', 'executive', 'academic', 'creative', 'modern', 'precision', 'signature'])
def test_pdf_preserves_facts_and_paginates(template):
    source = '# Candidate\nDéveloppeur Python\nc@example.com\n## Expérience\n' + '\n'.join(f'• Développement de {n} modules Python pour la gestion interne.' for n in range(80))
    result = render_cv(source, template, 14)
    data = base64.b64decode(result['pdfBase64'])
    assert data.startswith(b'%PDF-')
    assert result['inspection']['pageCount'] >= 2
    assert '79 modules' in result['inspection']['text']
    with pymupdf.open(stream=data, filetype='pdf') as doc:
        assert all(page.rect.width == 595 for page in doc)
        assert all(b[0] >= 40 and b[2] <= 555 for page in doc for b in page.get_text('blocks') if b[6] == 0)

def test_pdf_rejects_invalid_input():
    with pytest.raises(ValueError): inspect_pdf(b'not a PDF')
    with pytest.raises(ValueError): render_cv('Too short')
    with pytest.raises(ValueError): render_cv('Candidate experience description', 'missing')

def test_html_in_cv_is_literal_text_not_markup():
    result = render_cv('# Candidate\n## Projects\n<script>alert(1)</script>\nExperience with Python')
    assert '<script>alert(1)</script>' in result['inspection']['text']

def test_structured_pdf_uses_canonical_layout_and_preserves_links():
    source = 'Candidate Example\nPortfolio\nExpérience\nDéveloppement de services API.'
    markup = '<h1>Candidate Example</h1><p><a href="https://example.test">Portfolio</a></p><h2>Expérience</h2><p>Développement de services API.</p>'
    result = render_cv(source, 'modern', 14, markup, 'body{font-size:10.5pt}h1{color:#234e68;font-size:25pt}', 42)
    assert result['layout'] == 'STRUCTURED_A4'
    with pymupdf.open(stream=base64.b64decode(result['pdfBase64']), filetype='pdf') as pdf:
        assert abs(pdf[0].rect.width - 595.276) < .01
        assert pdf[0].get_links()[0]['uri'] == 'https://example.test'
        assert 'Développement de services API.' in pdf[0].get_text()

def test_structured_pdf_rejects_active_markup_and_silent_text_loss():
    with pytest.raises(ValueError): render_cv('Example Candidate experience', document_html='<img src="https://example.test/x">')
    with pytest.raises(ValueError): render_cv('Example Candidate experience', document_html='<p>Different information</p>')
