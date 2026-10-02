from trigo_supply import normalize


def test_phone_formats_to_e164():
    assert normalize.phone("+91 98765 43210") == "+919876543210"
    assert normalize.phone("098765-43210") == "+919876543210"
    assert normalize.phone("junk; 98765 43210") == "+919876543210"
    assert normalize.phone("12345") is None
    assert normalize.phone(None) is None


def test_website_drops_platforms():
    assert normalize.website("https://www.DiveShop.example/contact") == "diveshop.example"
    assert normalize.website("diveshop.example") == "diveshop.example"
    assert normalize.website("https://www.facebook.com/diveshop") is None
    assert normalize.website("https://m.facebook.com/diveshop") is None
    assert normalize.website("https://diveshop.business.site") is None


def test_instagram_handles():
    assert normalize.instagram("@Lagoon.Kayak") == "lagoon.kayak"
    assert normalize.instagram("https://instagram.com/lagoonkayak/") == "lagoonkayak"
    assert normalize.instagram("https://www.instagram.com/p/Cxyz/") is None


def test_email():
    assert normalize.email("Mail: Hello@Dive.Example ") == "hello@dive.example"
    assert normalize.email("n/a") is None


def test_name_key_folds_legal_suffixes():
    assert normalize.name_key("Coral Garden Divers Pvt. Ltd.") == "coral garden divers"
    assert normalize.name_key("Sea & Sand") == "sea and sand"
