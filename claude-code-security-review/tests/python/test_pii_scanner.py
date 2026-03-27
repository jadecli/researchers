"""Tests for the PII Scanner."""

import pytest

from scanners.python.pii_scanner import PIIScanner, PIIMatch


@pytest.fixture
def scanner():
    return PIIScanner()


class TestPIIScanner:
    def test_detects_email(self, scanner):
        content = "Contact us at user@example.com for more info."
        matches = scanner.scan_content(content)
        email_matches = [m for m in matches if m.type == "email"]
        assert len(email_matches) >= 1
        assert email_matches[0].confidence >= 0.9

    def test_detects_phone_us(self, scanner):
        content = "Call us at (555) 123-4567 or 555-987-6543."
        matches = scanner.scan_content(content)
        phone_matches = [m for m in matches if m.type in ("phone_us", "phone_intl")]
        assert len(phone_matches) >= 1

    def test_detects_ssn(self, scanner):
        content = "SSN: 123-45-6789"
        matches = scanner.scan_content(content)
        ssn_matches = [m for m in matches if m.type == "ssn"]
        assert len(ssn_matches) >= 1
        assert ssn_matches[0].confidence >= 0.85

    def test_detects_credit_card(self, scanner):
        # Valid Visa test number
        content = "Card: 4111111111111111"
        matches = scanner.scan_content(content)
        cc_matches = [m for m in matches if m.type == "credit_card"]
        assert len(cc_matches) >= 1

    def test_detects_api_key(self, scanner):
        content = 'api_key = "sk_test_FAKE_KEY_FOR_UNIT_TEST_0000"'
        matches = scanner.scan_content(content)
        api_matches = [m for m in matches if m.type == "api_key"]
        assert len(api_matches) >= 1

    def test_detects_aws_key(self, scanner):
        content = "aws_access_key_id = AKIAIOSFODNN7EXAMPLE"
        matches = scanner.scan_content(content)
        aws_matches = [m for m in matches if m.type == "aws_access_key"]
        assert len(aws_matches) >= 1
        assert aws_matches[0].confidence >= 0.9

    def test_detects_jwt(self, scanner):
        content = "token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"
        matches = scanner.scan_content(content)
        jwt_matches = [m for m in matches if m.type == "jwt_token"]
        assert len(jwt_matches) >= 1

    def test_ignores_false_positive_ssn(self, scanner):
        # 000-xx-xxxx and 666-xx-xxxx are invalid SSNs
        content = "Code: 000-12-3456"
        matches = scanner.scan_content(content)
        ssn_matches = [m for m in matches if m.type == "ssn"]
        assert len(ssn_matches) == 0

    def test_ignores_false_positive_credit_card(self, scanner):
        # Not a valid Luhn number
        content = "Number: 1234567890123456"
        matches = scanner.scan_content(content)
        cc_matches = [m for m in matches if m.type == "credit_card"]
        assert len(cc_matches) == 0

    def test_scan_file(self, scanner, tmp_path):
        f = tmp_path / "data.txt"
        f.write_text("Email: test@example.com\nPhone: 555-123-4567\n")
        matches = scanner.scan_file(str(f))
        assert len(matches) >= 1

    def test_scan_directory(self, scanner, tmp_path):
        (tmp_path / "file1.txt").write_text("user@test.com")
        (tmp_path / "file2.json").write_text('{"email": "admin@corp.net"}')
        matches = scanner.scan_directory(str(tmp_path))
        assert len(matches) >= 2

    def test_redaction(self, scanner):
        content = "SSN: 123-45-6789"
        matches = scanner.scan_content(content)
        ssn_matches = [m for m in matches if m.type == "ssn"]
        if ssn_matches:
            # Value should be partially redacted
            assert "*" in ssn_matches[0].value

    def test_empty_content(self, scanner):
        matches = scanner.scan_content("")
        assert matches == []

    def test_nonexistent_file(self, scanner):
        matches = scanner.scan_file("/nonexistent/file.txt")
        assert matches == []
