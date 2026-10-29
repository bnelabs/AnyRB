"""Build PDF deliverables from the Markdown research dossier and HTML report.

Uses python-markdown for conversion and headless Chrome for print-to-PDF
(no pandoc/LaTeX dependency).  Run from the project root:

    .venv/bin/python demo/build_pdf.py
"""
from __future__ import annotations

import base64
import os
import subprocess
import sys

import markdown

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPORTS = os.path.join(ROOT, "reports")
SHOTS = os.path.join(ROOT, "demo", "screenshots")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

CSS = """
@page { size: A4; margin: 18mm 16mm 18mm 16mm; }
* { box-sizing: border-box; }
body { font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif;
       color: #1d2733; font-size: 10.2pt; line-height: 1.48; }
h1 { font-size: 21pt; line-height: 1.15; margin: 0 0 10px; letter-spacing: -0.3px; color:#0E7C66; }
h2 { font-size: 14pt; margin: 26px 0 8px; padding-bottom: 5px; border-bottom: 2px solid #dde3e8;
     page-break-after: avoid; }
h3 { font-size: 11.5pt; margin: 18px 0 5px; page-break-after: avoid; }
p { margin: 7px 0; text-align: justify; }
ul, ol { margin: 6px 0 10px; padding-left: 20px; }
li { margin: 3px 0; }
table { border-collapse: collapse; width: 100%; margin: 10px 0 14px; font-size: 8.6pt;
        page-break-inside: auto; }
thead { display: table-header-group; }
th, td { border: 1px solid #dde3e8; padding: 4px 6px; text-align: left; vertical-align: top; }
th { background: #f2f5f7; font-size: 8pt; text-transform: uppercase; letter-spacing: .04em; }
tr { page-break-inside: avoid; }
code { font-family: "SF Mono", Menlo, monospace; font-size: 8.6pt; background: #eef2f5;
       padding: 0 3px; border-radius: 3px; }
pre { background: #f4f6f8; border: 1px solid #e2e7eb; border-radius: 5px; padding: 8px 10px;
      overflow-wrap: break-word; white-space: pre-wrap; font-size: 8.4pt; page-break-inside: avoid; }
blockquote { border-left: 3px solid #0E7C66; margin: 10px 0; padding: 4px 12px; color: #3c4a53;
             background: #f2fbf8; }
a { color: #0E7C66; text-decoration: none; }
.chapter { page-break-before: always; }
.cover { height: 245mm; display: flex; flex-direction: column; justify-content: center;
         page-break-after: always; }
.cover .kicker { color:#0E7C66; font-size: 10pt; letter-spacing: .14em; text-transform: uppercase; }
.cover h1 { font-size: 31pt; margin: 12px 0 6px; color:#1d2733; }
.cover .sub { font-size: 13pt; color: #3c4a53; max-width: 150mm; }
.cover .meta { margin-top: 26px; font-size: 9pt; color: #5b6770; }
.cover .note { margin-top: 30px; border-left: 3px solid #B23A48; background:#fdf0ef;
               padding: 10px 14px; font-size: 9pt; max-width: 160mm; }
.toc { page-break-after: always; }
.toc ul { list-style: none; padding-left: 0; }
.toc li { margin: 4px 0; font-size: 10pt; }
.small { font-size: 8.4pt; color: #5b6770; }
figure { margin: 14px 0; page-break-inside: avoid; }
figure img { width: 100%; border: 1px solid #dde3e8; border-radius: 4px; }
figcaption { font-size: 8pt; color:#5b6770; margin-top: 3px; }
"""


def md_to_html(md_text: str) -> str:
    return markdown.markdown(md_text, extensions=["tables", "fenced_code", "toc", "sane_lists"])


def build_html(title: str, subtitle: str, chapters: list[tuple[str, str]],
               appendix_html: str = "") -> str:
    parts = [f"""<!doctype html><html><head><meta charset="utf-8"><title>{title}</title>
<style>{CSS}</style></head><body>
<div class="cover">
  <div class="kicker">AnyRB · research synthesis</div>
  <h1>{title}</h1>
  <div class="sub">{subtitle}</div>
  <div class="meta">Prepared 2026-10-29 · prototype v0.1 · project: AnyRB<br>
  Python reference engine + independent JS demo + research dossiers 00–05</div>
  <div class="note"><strong>In-silico only — not a certification document.</strong> No physical testing was
  performed. Material distributions are literature-derived and provisional; the mechanics is a linear-elastic
  2-D plane-frame idealisation. Claim level: L0–L1 verified, L2 partial, L4–L6 absent
  (see research/05 for the claim ladder and minimum validation programme).</div>
</div>"""]
    # simple table of contents
    toc = "<div class='toc'><h2>Contents</h2><ul>"
    for i, (chap_title, _) in enumerate(chapters, 1):
        toc += f"<li>{i}. {chap_title}</li>"
    toc += "</ul></div>"
    parts.append(toc)
    for i, (chap_title, html) in enumerate(chapters, 1):
        cls = "chapter" if i > 1 else ""
        parts.append(f"<div class='{cls}'>{html}</div>")
    if appendix_html:
        parts.append(f"<div class='chapter'>{appendix_html}</div>")
    parts.append("</body></html>")
    return "\n".join(parts)


def chrome_pdf(html_path: str, pdf_path: str) -> None:
    cmd = [CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
           f"--print-to-pdf={pdf_path}", "file://" + os.path.abspath(html_path)]
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    if not os.path.exists(pdf_path):
        raise RuntimeError("chrome PDF failed:\n" + (res.stderr or res.stdout)[-2000:])
    print(f"  {os.path.basename(pdf_path)}  {os.path.getsize(pdf_path)//1024} KB")


def read(path: str) -> str:
    with open(path, encoding="utf-8") as f:
        return f.read()


def shot_figure(name: str, caption: str) -> str:
    path = os.path.join(SHOTS, name)
    if not os.path.exists(path):
        return ""
    b64 = base64.b64encode(open(path, "rb").read()).decode()
    return (f"<figure><img src='data:image/png;base64,{b64}' alt='{caption}'>"
            f"<figcaption>{caption}</figcaption></figure>")


def main() -> int:
    os.makedirs(REPORTS, exist_ok=True)
    tmpdir = os.path.join(ROOT, "demo", "_pdf_tmp")
    os.makedirs(tmpdir, exist_ok=True)

    report_md = read(os.path.join(ROOT, "REPORT.md"))
    report_html = md_to_html(report_md)

    shots = "".join([
        shot_figure("v2/live/01-brief.png", "Brief step: natural-language brief, AI understanding and lot passport (live Meta models)."),
        shot_figure("v2/live/02-design.png", "Design step: AI proposes three priors; the verified engine optimises/ranks them."),
        shot_figure("v2/live/03-prove.png", "Prove step: batch acceptance, passport decision validation checklist and exports."),
        shot_figure("v2/offline/02-design.png", "Offline mode: identical flow with deterministic fallbacks, clearly badged."),
    ])
    appendix = ("<h1>Appendix — the interactive prototype</h1>"
                "<p class='small'>Screenshots from <code>anyrb/index.html</code> (standalone, offline). "
                "The live app computes every number in the browser from the same verified physics contract "
                "as the Python engine.</p>" + shots)

    # 1) synthesis PDF
    html1 = build_html(
        "Reliable products from variable recyclate, without physical testing",
        "Extensive research synthesis and working in-silico prototype: batch variability → material "
        "demands → AI-designed internal geometry → virtual qualification.",
        [("Research synthesis", report_html)], appendix)
    p1 = os.path.join(tmpdir, "synthesis.html"); open(p1, "w").write(html1)
    print("synthesis PDF:")
    chrome_pdf(p1, os.path.join(REPORTS, "AnyRB_Research_Synthesis.pdf"))

    # 2) full dossier PDF
    chapters = [("Research synthesis", report_html)]
    for f, title in [
        ("00-executive-evidence-map.md", "00 · Executive evidence map"),
        ("01-recyclate-variability.md", "01 · Recyclate variability: quantified evidence"),
        ("02-design-for-variability.md", "02 · Design for variability: levers & limits"),
        ("03-computational-methods.md", "03 · Computational methods"),
        ("04-software-landscape-and-gap.md", "04 · Software landscape and gap"),
        ("05-validation-without-physical-testing.md", "05 · Credibility without physical testing"),
    ]:
        path = os.path.join(ROOT, "research", f)
        if os.path.exists(path):
            chapters.append((title, md_to_html(read(path))))
    html2 = build_html(
        "AnyRB — full research dossier",
        "Five cited research dossiers plus the synthesis, the software specification, and the prototype results.",
        chapters, appendix)
    p2 = os.path.join(tmpdir, "dossier.html"); open(p2, "w").write(html2)
    print("full dossier PDF:")
    chrome_pdf(p2, os.path.join(REPORTS, "AnyRB_Full_Research_Dossier.pdf"))

    # 3) qualification report PDF (already styled HTML)
    q = os.path.join(REPORTS, "qualification_report.html")
    if os.path.exists(q):
        print("qualification report PDF:")
        chrome_pdf(q, os.path.join(REPORTS, "AnyRB_Qualification_Report.pdf"))

    import shutil
    shutil.rmtree(tmpdir, ignore_errors=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
