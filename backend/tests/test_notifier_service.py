from app.models import CriteriaProfile, Listing, NotificationLog, Score
from app.notifier.service import notify_if_above_threshold


def _seed(db, match_score=85):
    listing = Listing(fb_listing_id="1", url="https://example.com/1", title="2014 Impala", price_amount=2500.0, raw_apify_data={})
    profile = CriteriaProfile(name="default", prompt_text="Score this car.")
    db.add_all([listing, profile])
    db.commit()
    db.refresh(listing)
    db.refresh(profile)

    score = Score(
        listing_id=listing.id,
        criteria_profile_id=profile.id,
        match_score=match_score,
        summary="Good deal.",
        pros=[],
        cons=[],
        dealbreaker_flags=[],
        model_used="claude-haiku-4-5",
    )
    db.add(score)
    db.commit()
    db.refresh(score)
    return listing, score


def test_notify_sends_to_all_channels_above_threshold(db, mocker):
    _, score = _seed(db, match_score=85)
    mock_notifier = mocker.Mock()
    mocker.patch("app.notifier.service.get_notifier", return_value=mock_notifier)

    logs = notify_if_above_threshold(db, score, threshold=70)

    assert len(logs) == 2  # discord + telegram
    assert {log.channel for log in logs} == {"discord", "telegram"}
    assert all(log.status == "sent" for log in logs)
    assert mock_notifier.call_count == 2
    assert db.query(NotificationLog).count() == 2


def test_notify_skips_below_threshold(db, mocker):
    _, score = _seed(db, match_score=50)
    mock_notifier = mocker.Mock()
    mocker.patch("app.notifier.service.get_notifier", return_value=mock_notifier)

    logs = notify_if_above_threshold(db, score, threshold=70)

    assert logs == []
    mock_notifier.assert_not_called()
    assert db.query(NotificationLog).count() == 0


def test_notify_is_idempotent_per_listing_and_channel(db, mocker):
    _, score = _seed(db, match_score=85)
    mock_notifier = mocker.Mock()
    mocker.patch("app.notifier.service.get_notifier", return_value=mock_notifier)

    notify_if_above_threshold(db, score, threshold=70)
    logs_second_call = notify_if_above_threshold(db, score, threshold=70)

    assert logs_second_call == []  # already notified on both channels
    assert mock_notifier.call_count == 2  # no additional sends
    assert db.query(NotificationLog).count() == 2


def test_notify_logs_failed_status_without_blocking_other_channels(db, mocker):
    _, score = _seed(db, match_score=85)

    def fake_get_notifier(channel):
        if channel == "discord":
            return mocker.Mock(side_effect=RuntimeError("webhook down"))
        return mocker.Mock()  # telegram succeeds

    mocker.patch("app.notifier.service.get_notifier", side_effect=fake_get_notifier)

    logs = notify_if_above_threshold(db, score, threshold=70)

    statuses = {log.channel: log.status for log in logs}
    assert statuses == {"discord": "failed", "telegram": "sent"}


def test_notify_respects_explicit_channel_subset(db, mocker):
    _, score = _seed(db, match_score=85)
    mock_notifier = mocker.Mock()
    mocker.patch("app.notifier.service.get_notifier", return_value=mock_notifier)

    logs = notify_if_above_threshold(db, score, threshold=70, channels=("discord",))

    assert len(logs) == 1
    assert logs[0].channel == "discord"


def test_notify_uses_default_threshold_from_settings(db, mocker):
    _, score = _seed(db, match_score=50)  # below the default threshold (70)
    mock_notifier = mocker.Mock()
    mocker.patch("app.notifier.service.get_notifier", return_value=mock_notifier)

    logs = notify_if_above_threshold(db, score)  # no threshold passed

    assert logs == []
    mock_notifier.assert_not_called()
