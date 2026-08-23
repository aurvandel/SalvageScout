import re
from datetime import datetime
from typing import Any

# "2003 Ford Crown Victoria · LX Sedan 4D" -> year=2003, make=Ford, model="Crown Victoria"
_TITLE_RE = re.compile(r"^\s*(\d{4})\s+(\S+)\s+(.+?)\s*(?:·.*)?$")

# "215K miles" / "2K miles" -> 215000 / 2000. Also handles plain "128,000 miles".
_MILEAGE_K_RE = re.compile(r"([\d.]+)\s*K\s*miles", re.IGNORECASE)
_MILEAGE_PLAIN_RE = re.compile(r"([\d,]+)\s*miles", re.IGNORECASE)


def parse_year_make_model(title: str) -> tuple[int | None, str | None, str | None]:
    if not title:
        return None, None, None
    match = _TITLE_RE.match(title)
    if not match:
        return None, None, None
    year_str, make, model = match.groups()
    year = int(year_str)
    if not (1980 <= year <= datetime.now().year + 1):
        return None, None, None
    return year, make, model.strip()


def parse_mileage(subtitles: list[dict[str, Any]] | None) -> int | None:
    if not subtitles:
        return None
    for entry in subtitles:
        text = entry.get("subtitle", "")
        k_match = _MILEAGE_K_RE.search(text)
        if k_match:
            return int(float(k_match.group(1)) * 1000)
        plain_match = _MILEAGE_PLAIN_RE.search(text)
        if plain_match:
            return int(plain_match.group(1).replace(",", ""))
    return None


def parse_vehicle_specs(title: str, subtitles: list[dict[str, Any]] | None) -> dict[str, Any]:
    year, make, model = parse_year_make_model(title)
    mileage = parse_mileage(subtitles)
    return {"year": year, "make": make, "model": model, "mileage": mileage}
