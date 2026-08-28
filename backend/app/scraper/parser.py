import re
from datetime import datetime
from typing import Any

# "2003 Ford Crown Victoria · LX Sedan 4D" -> year=2003, make=Ford, model="Crown Victoria"
_TITLE_RE = re.compile(r"^\s*(\d{4})\s+(\S+)\s+(.+?)\s*(?:·.*)?$")

# "215K miles" / "2K miles" -> 215000 / 2000. Also handles plain "128,000 miles".
_MILEAGE_K_RE = re.compile(r"([\d.]+)\s*K\s*miles", re.IGNORECASE)
_MILEAGE_PLAIN_RE = re.compile(r"([\d,]+)\s*miles", re.IGNORECASE)

# Non-Apify providers (Bright Data, ScrapeCreators) don't carry a separate
# subtitle field — mileage rides inline in the title, e.g. "2018 Mercedes-Benz
# C 300 Convertible 27k miles". Strip it before year/make/model parsing so it
# doesn't get swallowed into `model`.
_TRAILING_MILEAGE_RE = re.compile(r"\s*[\d,.]+\s*k?\s*miles\s*$", re.IGNORECASE)


def parse_mileage_from_text(text: str | None) -> int | None:
    if not text:
        return None
    k_match = _MILEAGE_K_RE.search(text)
    if k_match:
        return int(float(k_match.group(1)) * 1000)
    plain_match = _MILEAGE_PLAIN_RE.search(text)
    if plain_match:
        return int(plain_match.group(1).replace(",", ""))
    return None


def parse_year_make_model(title: str) -> tuple[int | None, str | None, str | None]:
    if not title:
        return None, None, None
    cleaned = _TRAILING_MILEAGE_RE.sub("", title).strip()
    match = _TITLE_RE.match(cleaned)
    if not match:
        return None, None, None
    year_str, make, model = match.groups()
    year = int(year_str)
    if not (1980 <= year <= datetime.now().year + 1):
        return None, None, None
    return year, make, model.strip()


def parse_mileage(subtitles: list[dict[str, Any]] | None, title: str | None = None) -> int | None:
    """Apify carries mileage in a separate subtitle list; providers without one
    (Bright Data, ScrapeCreators) embed it directly in the title, so fall back
    to scanning that when no subtitle yields a match."""
    if subtitles:
        for entry in subtitles:
            mileage = parse_mileage_from_text(entry.get("subtitle", ""))
            if mileage is not None:
                return mileage
    return parse_mileage_from_text(title)


def parse_vehicle_specs(title: str, subtitles: list[dict[str, Any]] | None) -> dict[str, Any]:
    year, make, model = parse_year_make_model(title)
    mileage = parse_mileage(subtitles, title)
    return {"year": year, "make": make, "model": model, "mileage": mileage}
