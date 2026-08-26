import pytest

from app.scraper.parser import parse_mileage, parse_mileage_from_text, parse_vehicle_specs, parse_year_make_model


@pytest.mark.parametrize(
    "title,expected",
    [
        (" 2003 Ford Crown Victoria · LX Sedan 4D", (2003, "Ford", "Crown Victoria")),
        ("2011 Mitsubishi Lancer · ES Sedan 4D", (2011, "Mitsubishi", "Lancer")),
        ("2014 Infiniti Q50 · S 3.7 Sedan 4D", (2014, "Infiniti", "Q50")),
        ("2004 Honda Accord · LX Sedan 4D", (2004, "Honda", "Accord")),
        ("2014 Chevrolet Impala · LT Sedan 4D", (2014, "Chevrolet", "Impala")),
    ],
)
def test_parse_year_make_model_real_titles(title, expected):
    assert parse_year_make_model(title) == expected


def test_parse_year_make_model_no_separator():
    # No "·" — still extracts year/make, model falls back to the rest of the string.
    year, make, model = parse_year_make_model("2015 Toyota Camry SE")
    assert (year, make) == (2015, "Toyota")
    assert model  # non-empty, exact contents aren't load-bearing without a separator


def test_parse_year_make_model_empty_string():
    assert parse_year_make_model("") == (None, None, None)


def test_parse_year_make_model_none():
    assert parse_year_make_model(None) == (None, None, None)


def test_parse_year_make_model_no_leading_year():
    assert parse_year_make_model("Great car for sale") == (None, None, None)


@pytest.mark.parametrize("bad_year", ["1899 Ford Model T · A", "2099 Ford Future · X"])
def test_parse_year_make_model_rejects_implausible_years(bad_year):
    assert parse_year_make_model(bad_year) == (None, None, None)


def test_parse_mileage_k_suffix():
    assert parse_mileage([{"subtitle": "215K miles"}]) == 215000


def test_parse_mileage_small_k_value():
    assert parse_mileage([{"subtitle": "2K miles"}]) == 2000


def test_parse_mileage_plain_comma_format():
    assert parse_mileage([{"subtitle": "128,000 miles"}]) == 128000


def test_parse_mileage_no_subtitles():
    assert parse_mileage(None) is None
    assert parse_mileage([]) is None


def test_parse_mileage_no_mileage_subtitle():
    assert parse_mileage([{"subtitle": "Automatic transmission"}]) is None


def test_parse_vehicle_specs_combines_both():
    specs = parse_vehicle_specs("2014 Chevrolet Impala · LT Sedan 4D", [{"subtitle": "2K miles"}])
    assert specs == {"year": 2014, "make": "Chevrolet", "model": "Impala", "mileage": 2000}


def test_parse_vehicle_specs_missing_data():
    specs = parse_vehicle_specs("", None)
    assert specs == {"year": None, "make": None, "model": None, "mileage": None}


# Bright Data / ScrapeCreators titles have no separate subtitle field — mileage
# rides inline in the title itself, e.g. "2018 Mercedes-Benz C 300 Convertible 27k miles".


def test_parse_year_make_model_strips_inline_mileage():
    year, make, model = parse_year_make_model("2018 Mercedes-Benz C 300 Convertible 27k miles")
    assert (year, make) == (2018, "Mercedes-Benz")
    assert "miles" not in model.lower()


def test_parse_mileage_falls_back_to_title_when_no_subtitles():
    assert parse_mileage(None, "2018 Mercedes-Benz C 300 Convertible 27k miles") == 27000
    assert parse_mileage([], "2018 Mercedes-Benz C 300 Convertible 27k miles") == 27000


def test_parse_mileage_prefers_subtitle_over_title():
    assert parse_mileage([{"subtitle": "215K miles"}], "2003 Ford Crown Victoria 999k miles") == 215000


def test_parse_mileage_from_text_variants():
    assert parse_mileage_from_text("27k miles") == 27000
    assert parse_mileage_from_text("128,000 miles") == 128000
    assert parse_mileage_from_text(None) is None
    assert parse_mileage_from_text("no mileage here") is None


def test_parse_vehicle_specs_inline_mileage_title():
    specs = parse_vehicle_specs("2018 Mercedes-Benz C 300 Convertible 27k miles", None)
    assert specs["year"] == 2018
    assert specs["make"] == "Mercedes-Benz"
    assert specs["mileage"] == 27000
    assert "miles" not in specs["model"].lower()
