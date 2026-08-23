import httpx
import respx

from app.scraper.images import download_images


@respx.mock
def test_download_images_saves_files_in_order(tmp_path, monkeypatch):
    monkeypatch.setattr("app.scraper.images.settings.image_storage_dir", str(tmp_path))

    respx.get("https://example.com/photo0.jpg").mock(return_value=httpx.Response(200, content=b"fake-jpg-0"))
    respx.get("https://example.com/photo1.jpg").mock(return_value=httpx.Response(200, content=b"fake-jpg-1"))

    results = download_images("listing123", ["https://example.com/photo0.jpg", "https://example.com/photo1.jpg"])

    assert len(results) == 2
    assert results[0]["position"] == 0
    assert results[1]["position"] == 1
    assert (tmp_path / "listing123" / "0.jpg").read_bytes() == b"fake-jpg-0"
    assert (tmp_path / "listing123" / "1.jpg").read_bytes() == b"fake-jpg-1"


@respx.mock
def test_download_images_skips_failed_photo_without_aborting(tmp_path, monkeypatch):
    monkeypatch.setattr("app.scraper.images.settings.image_storage_dir", str(tmp_path))

    respx.get("https://example.com/bad.jpg").mock(return_value=httpx.Response(404))
    respx.get("https://example.com/good.jpg").mock(return_value=httpx.Response(200, content=b"fake-jpg"))

    results = download_images("listing456", ["https://example.com/bad.jpg", "https://example.com/good.jpg"])

    # Only the successful download is recorded; its position reflects its original index.
    assert len(results) == 1
    assert results[0]["position"] == 1
    assert (tmp_path / "listing456" / "1.jpg").read_bytes() == b"fake-jpg"
    assert not (tmp_path / "listing456" / "0.jpg").exists()


def test_download_images_no_urls(tmp_path, monkeypatch):
    monkeypatch.setattr("app.scraper.images.settings.image_storage_dir", str(tmp_path))
    assert download_images("listing789", []) == []
