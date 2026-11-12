"""Text extraction for House Periodic Transaction Reports.

The trader-pelosi parser reads ``pdftotext -layout`` output, one transaction per line.
Without poppler, ``pypdf`` returns each transaction wrapped over several lines (asset name,
then ``[ST]`` code, then type and dates, then the second half of the amount) and pads the
small-caps field labels with NUL bytes. ``normalise`` joins the wrapped rows so the skill's
own parser can read them.
"""

import io
import re
from typing import List

_TXN_TAIL = re.compile(r"^(S \(partial\)|P|S|E)\s+\d{2}/\d{2}/\d{4}\s+\d{2}/\d{2}/\d{4}\s+\$")
_TXN_FULL = re.compile(r"\s(S \(partial\)|P|S|E)\s+\d{2}/\d{2}/\d{4}\s+\d{2}/\d{2}/\d{4}\s+\$")
_HEADER_LINES = {
    "ID Owner Asset Transaction", "Type", "Date Notification", "Date", "Amount Cap.", "Gains >", "$200?",
}
_PASS_THROUGH = re.compile(r"^(Name:|Status:|State/District:|Digitally Signed:|Filing ID #)")
_DESC = re.compile(r"^D\s*:")
_LABEL = re.compile(r"^[A-Z](?:\s+[A-Z])?\s*:")      # "F S: New", "S O: Trust", "L: VA, US"
_JUNK = re.compile(r"^(?:[A-Z]\s*){1,12}$")           # letter-spaced section titles
_END = re.compile(r"^(\* For the complete|I CERTIFY|Yes\s+No$)", re.I)
_CLERK = re.compile(r"^Clerk of the House")
_AMOUNT_TAIL = re.compile(r"^\$[\d,]+$")
_OWNER_LINE = re.compile(r"^(SP|JT|DC)\s")
_SUBHOLDING = re.compile(r"\(Owner:\s*\w+\)$")


def normalise(text: str) -> str:
    """Join wrapped transaction rows into the one-line form the skill parser expects."""
    out: List[str] = []
    buf: List[str] = []
    in_desc = False

    def end_block() -> None:
        """Lines buffered after a description label continue that description."""
        nonlocal in_desc
        if in_desc and buf and out:
            out[-1] += " " + " ".join(buf)
        buf.clear()
        in_desc = False

    for raw in text.replace("\x00", "").splitlines():
        s = raw.strip()
        if not s or _CLERK.match(s):
            continue
        if s in _HEADER_LINES:
            buf.clear()
            continue
        if _PASS_THROUGH.match(s):
            end_block()
            out.append(s)
            continue
        if _AMOUNT_TAIL.match(s) and out and out[-1].endswith("-"):
            out[-1] += " " + s
            continue
        if _SUBHOLDING.search(s):
            continue
        if _TXN_TAIL.match(s):
            start = max((i for i, b in enumerate(buf) if _OWNER_LINE.match(b)), default=-1)
            if start < 0 and in_desc:
                # A description ends with a full stop; the asset name is what follows it.
                start = max((i + 1 for i, b in enumerate(buf) if b.endswith(".")), default=0)
            start = max(start, 0)
            head, asset = buf[:start], buf[start:]
            buf[:] = head
            end_block()
            out.append(" ".join(asset + [s]))
            continue
        if _TXN_FULL.search(" " + s):
            end_block()
            out.append(s)
            continue
        if _DESC.match(s):
            end_block()
            out.append(s)
            in_desc = True
            continue
        if _LABEL.match(s):
            end_block()
            out.append(s)
            continue
        if _END.match(s):
            end_block()
            out.append(s)
            continue
        if _JUNK.match(s):
            continue
        buf.append(s)
    buf.clear() if not in_desc else end_block()
    return "\n".join(out)


def pdf_text(data: bytes) -> str:
    """Plain text of every page (pypdf default mode keeps the table rows readable)."""
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    return "\n".join((page.extract_text() or "") for page in reader.pages)
