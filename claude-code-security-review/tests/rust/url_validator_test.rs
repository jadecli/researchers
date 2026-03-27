//! Tests for the URL validator module.
//!
//! To run: copy this into `scanners/rust/tests/url_validator_test.rs`
//! or run `cargo test` from the scanners/rust directory.

#[cfg(test)]
mod tests {
    // These tests mirror the inline tests in url_validator.rs
    // and add additional edge cases.

    use security_url_validator::url_validator::{
        is_private_ip, is_safe_url, validate_crawl_target, SecurityError,
    };

    // -- is_safe_url tests --

    #[test]
    fn test_safe_public_urls() {
        assert!(is_safe_url("https://example.com"));
        assert!(is_safe_url("https://github.com/user/repo"));
        assert!(is_safe_url("http://8.8.8.8"));
        assert!(is_safe_url("https://www.google.com/search?q=test"));
    }

    #[test]
    fn test_unsafe_loopback() {
        assert!(!is_safe_url("http://127.0.0.1"));
        assert!(!is_safe_url("http://127.0.0.1:8080"));
        assert!(!is_safe_url("http://127.255.255.255"));
        assert!(!is_safe_url("http://localhost"));
        assert!(!is_safe_url("http://localhost:3000"));
    }

    #[test]
    fn test_unsafe_private_class_a() {
        assert!(!is_safe_url("http://10.0.0.1"));
        assert!(!is_safe_url("http://10.255.255.255"));
        assert!(!is_safe_url("http://10.0.0.1:9200"));
    }

    #[test]
    fn test_unsafe_private_class_b() {
        assert!(!is_safe_url("http://172.16.0.1"));
        assert!(!is_safe_url("http://172.31.255.255"));
        // 172.15.x.x is NOT private
        assert!(is_safe_url("http://172.15.0.1"));
        // 172.32.x.x is NOT private
        assert!(is_safe_url("http://172.32.0.1"));
    }

    #[test]
    fn test_unsafe_private_class_c() {
        assert!(!is_safe_url("http://192.168.0.1"));
        assert!(!is_safe_url("http://192.168.1.1"));
        assert!(!is_safe_url("http://192.168.255.255"));
    }

    #[test]
    fn test_unsafe_zero() {
        assert!(!is_safe_url("http://0.0.0.0"));
    }

    #[test]
    fn test_unsafe_internal_domains() {
        assert!(!is_safe_url("http://app.internal.corp"));
        assert!(!is_safe_url("http://db.local"));
        assert!(!is_safe_url("http://service.corp.net"));
    }

    #[test]
    fn test_invalid_schemes() {
        assert!(!is_safe_url("ftp://example.com"));
        assert!(!is_safe_url("file:///etc/passwd"));
        assert!(!is_safe_url("gopher://evil.com"));
        assert!(!is_safe_url("data:text/html,<script>alert(1)</script>"));
    }

    #[test]
    fn test_malformed_urls() {
        assert!(!is_safe_url("not a url"));
        assert!(!is_safe_url(""));
        assert!(!is_safe_url("://missing-scheme"));
    }

    // -- is_private_ip tests --

    #[test]
    fn test_private_ip_loopback() {
        assert!(is_private_ip("127.0.0.1"));
        assert!(is_private_ip("127.0.0.2"));
        assert!(is_private_ip("127.255.255.255"));
    }

    #[test]
    fn test_private_ip_rfc1918() {
        assert!(is_private_ip("10.0.0.1"));
        assert!(is_private_ip("10.255.255.255"));
        assert!(is_private_ip("172.16.0.1"));
        assert!(is_private_ip("172.31.255.255"));
        assert!(is_private_ip("192.168.0.1"));
        assert!(is_private_ip("192.168.255.255"));
    }

    #[test]
    fn test_private_ip_special() {
        assert!(is_private_ip("0.0.0.0"));
        assert!(is_private_ip("localhost"));
        assert!(is_private_ip("::1"));
        assert!(is_private_ip("[::1]"));
        assert!(is_private_ip("169.254.0.1")); // link-local
    }

    #[test]
    fn test_public_ips() {
        assert!(!is_private_ip("8.8.8.8"));
        assert!(!is_private_ip("1.1.1.1"));
        assert!(!is_private_ip("203.0.113.1"));
        assert!(!is_private_ip("172.32.0.1")); // just outside /12
        assert!(!is_private_ip("172.15.255.255")); // just outside /12
        assert!(!is_private_ip("192.167.1.1")); // not 192.168
    }

    #[test]
    fn test_non_ip_strings() {
        assert!(!is_private_ip("example.com"));
        assert!(!is_private_ip("not-an-ip"));
        assert!(!is_private_ip(""));
    }

    // -- validate_crawl_target tests --

    #[test]
    fn test_validate_with_allowlist() {
        let allowlist = vec![
            "example.com".to_string(),
            "github.com".to_string(),
            "anthropic.com".to_string(),
        ];

        assert!(validate_crawl_target("https://example.com/page", &allowlist).is_ok());
        assert!(validate_crawl_target("https://sub.example.com/path", &allowlist).is_ok());
        assert!(validate_crawl_target("https://github.com/repo", &allowlist).is_ok());
        assert!(validate_crawl_target("https://docs.anthropic.com", &allowlist).is_ok());
    }

    #[test]
    fn test_validate_not_in_allowlist() {
        let allowlist = vec!["example.com".to_string()];
        let result = validate_crawl_target("https://evil.com", &allowlist);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), SecurityError::NotAllowed(_)));
    }

    #[test]
    fn test_validate_private_ip_with_allowlist() {
        let allowlist = vec!["example.com".to_string()];
        let result = validate_crawl_target("http://127.0.0.1", &allowlist);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), SecurityError::PrivateIp(_)));
    }

    #[test]
    fn test_validate_bad_scheme() {
        let allowlist: Vec<String> = vec![];
        let result = validate_crawl_target("ftp://example.com", &allowlist);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), SecurityError::InvalidScheme(_)));
    }

    #[test]
    fn test_validate_empty_allowlist_allows_public() {
        let allowlist: Vec<String> = vec![];
        assert!(validate_crawl_target("https://any-public-site.com", &allowlist).is_ok());
    }

    #[test]
    fn test_validate_internal_domain() {
        let allowlist: Vec<String> = vec![];
        let result = validate_crawl_target("http://app.internal.corp", &allowlist);
        assert!(result.is_err());
    }
}
