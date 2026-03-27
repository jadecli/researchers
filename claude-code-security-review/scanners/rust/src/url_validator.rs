//! URL validation module for crawl target safety checks.

use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use url::Url;

/// Errors that can occur during security validation.
#[derive(Debug, Clone, PartialEq)]
pub enum SecurityError {
    /// The URL targets a private/internal IP address.
    PrivateIp(String),
    /// The URL is not in the allowlist.
    NotAllowed(String),
    /// The URL has an invalid or disallowed scheme.
    InvalidScheme(String),
    /// The URL could not be parsed.
    ParseError(String),
    /// The hostname is an internal/corporate domain.
    InternalDomain(String),
}

impl std::fmt::Display for SecurityError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SecurityError::PrivateIp(ip) => write!(f, "URL targets private IP: {}", ip),
            SecurityError::NotAllowed(url) => write!(f, "URL not in allowlist: {}", url),
            SecurityError::InvalidScheme(scheme) => write!(f, "Invalid scheme: {}", scheme),
            SecurityError::ParseError(msg) => write!(f, "URL parse error: {}", msg),
            SecurityError::InternalDomain(domain) => {
                write!(f, "URL targets internal domain: {}", domain)
            }
        }
    }
}

impl std::error::Error for SecurityError {}

/// Blocked internal domain suffixes.
const INTERNAL_SUFFIXES: &[&str] = &[
    ".internal.",
    ".local",
    ".corp.",
    ".intranet.",
    ".private.",
    ".home.",
    ".lan",
];

/// Check if a URL is safe (not targeting internal/private networks).
///
/// Returns `true` if the URL is safe to access, `false` otherwise.
///
/// # Examples
/// ```
/// use security_url_validator::url_validator::is_safe_url;
/// assert!(is_safe_url("https://example.com"));
/// assert!(!is_safe_url("http://127.0.0.1"));
/// assert!(!is_safe_url("http://192.168.1.1"));
/// ```
pub fn is_safe_url(url: &str) -> bool {
    let parsed = match Url::parse(url) {
        Ok(u) => u,
        Err(_) => return false,
    };

    // Only allow http and https schemes
    match parsed.scheme() {
        "http" | "https" => {}
        _ => return false,
    }

    let host = match parsed.host_str() {
        Some(h) => h,
        None => return false,
    };

    // Check for private IPs
    if is_private_ip(host) {
        return false;
    }

    // Check for internal domain patterns
    let host_lower = host.to_lowercase();
    for suffix in INTERNAL_SUFFIXES {
        if host_lower.contains(suffix) || host_lower.ends_with(suffix.trim_start_matches('.')) {
            return false;
        }
    }

    // Block localhost variants
    if host_lower == "localhost"
        || host_lower == "0.0.0.0"
        || host_lower == "::1"
        || host_lower == "[::1]"
    {
        return false;
    }

    true
}

/// Validate a crawl target URL against a domain allowlist.
///
/// Returns `Ok(())` if the URL is safe and allowed, or a `SecurityError` otherwise.
pub fn validate_crawl_target(url: &str, allowlist: &[String]) -> Result<(), SecurityError> {
    let parsed =
        Url::parse(url).map_err(|e| SecurityError::ParseError(format!("{}: {}", url, e)))?;

    // Validate scheme
    match parsed.scheme() {
        "http" | "https" => {}
        other => return Err(SecurityError::InvalidScheme(other.to_string())),
    }

    let host = parsed
        .host_str()
        .ok_or_else(|| SecurityError::ParseError("No host in URL".to_string()))?;

    // Check for private IPs
    if is_private_ip(host) {
        return Err(SecurityError::PrivateIp(host.to_string()));
    }

    // Check for internal domains
    let host_lower = host.to_lowercase();
    if host_lower == "localhost" || host_lower == "0.0.0.0" || host_lower == "::1" {
        return Err(SecurityError::PrivateIp(host.to_string()));
    }

    for suffix in INTERNAL_SUFFIXES {
        if host_lower.contains(suffix) || host_lower.ends_with(suffix.trim_start_matches('.')) {
            return Err(SecurityError::InternalDomain(host.to_string()));
        }
    }

    // Check against allowlist if non-empty
    if !allowlist.is_empty() {
        let allowed = allowlist.iter().any(|domain| {
            let domain_lower = domain.to_lowercase();
            host_lower == domain_lower || host_lower.ends_with(&format!(".{}", domain_lower))
        });
        if !allowed {
            return Err(SecurityError::NotAllowed(url.to_string()));
        }
    }

    Ok(())
}

/// Check if a hostname string represents a private/internal IP address.
///
/// Handles IPv4, IPv6, and common private address names.
///
/// # Examples
/// ```
/// use security_url_validator::url_validator::is_private_ip;
/// assert!(is_private_ip("127.0.0.1"));
/// assert!(is_private_ip("10.0.0.1"));
/// assert!(is_private_ip("192.168.1.1"));
/// assert!(!is_private_ip("8.8.8.8"));
/// ```
pub fn is_private_ip(ip: &str) -> bool {
    // Strip brackets for IPv6
    let cleaned = ip.trim_start_matches('[').trim_end_matches(']');

    // Check common names
    if cleaned == "localhost" || cleaned == "0.0.0.0" {
        return true;
    }

    // Try parsing as IP address
    if let Ok(addr) = cleaned.parse::<IpAddr>() {
        return match addr {
            IpAddr::V4(ipv4) => is_private_ipv4(ipv4),
            IpAddr::V6(ipv6) => is_private_ipv6(ipv6),
        };
    }

    false
}

/// Check if an IPv4 address is in a private/reserved range.
fn is_private_ipv4(ip: Ipv4Addr) -> bool {
    let octets = ip.octets();

    // 127.0.0.0/8 (loopback)
    if octets[0] == 127 {
        return true;
    }
    // 10.0.0.0/8 (private class A)
    if octets[0] == 10 {
        return true;
    }
    // 172.16.0.0/12 (private class B)
    if octets[0] == 172 && (16..=31).contains(&octets[1]) {
        return true;
    }
    // 192.168.0.0/16 (private class C)
    if octets[0] == 192 && octets[1] == 168 {
        return true;
    }
    // 169.254.0.0/16 (link-local)
    if octets[0] == 169 && octets[1] == 254 {
        return true;
    }
    // 0.0.0.0/8
    if octets[0] == 0 {
        return true;
    }

    false
}

/// Check if an IPv6 address is in a private/reserved range.
fn is_private_ipv6(ip: Ipv6Addr) -> bool {
    // ::1 (loopback)
    if ip == Ipv6Addr::LOCALHOST {
        return true;
    }
    // :: (unspecified)
    if ip == Ipv6Addr::UNSPECIFIED {
        return true;
    }

    let segments = ip.segments();

    // fc00::/7 (unique local)
    if (segments[0] & 0xfe00) == 0xfc00 {
        return true;
    }
    // fe80::/10 (link-local)
    if (segments[0] & 0xffc0) == 0xfe80 {
        return true;
    }

    // IPv4-mapped IPv6: ::ffff:x.x.x.x
    if segments[0..5] == [0, 0, 0, 0, 0] && segments[5] == 0xffff {
        let ipv4 = Ipv4Addr::new(
            (segments[6] >> 8) as u8,
            (segments[6] & 0xff) as u8,
            (segments[7] >> 8) as u8,
            (segments[7] & 0xff) as u8,
        );
        return is_private_ipv4(ipv4);
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_safe_public_urls() {
        assert!(is_safe_url("https://example.com"));
        assert!(is_safe_url("https://github.com/user/repo"));
        assert!(is_safe_url("http://8.8.8.8"));
    }

    #[test]
    fn test_unsafe_private_urls() {
        assert!(!is_safe_url("http://127.0.0.1"));
        assert!(!is_safe_url("http://10.0.0.1"));
        assert!(!is_safe_url("http://172.16.0.1"));
        assert!(!is_safe_url("http://192.168.1.1"));
        assert!(!is_safe_url("http://localhost"));
        assert!(!is_safe_url("http://0.0.0.0"));
    }

    #[test]
    fn test_private_ip_detection() {
        assert!(is_private_ip("127.0.0.1"));
        assert!(is_private_ip("10.255.0.1"));
        assert!(is_private_ip("172.16.0.1"));
        assert!(is_private_ip("172.31.255.255"));
        assert!(is_private_ip("192.168.0.1"));
        assert!(is_private_ip("0.0.0.0"));
        assert!(is_private_ip("::1"));

        assert!(!is_private_ip("8.8.8.8"));
        assert!(!is_private_ip("1.1.1.1"));
        assert!(!is_private_ip("203.0.113.1"));
    }

    #[test]
    fn test_validate_crawl_target_allowlist() {
        let allowlist = vec![
            "example.com".to_string(),
            "github.com".to_string(),
        ];
        assert!(validate_crawl_target("https://example.com/page", &allowlist).is_ok());
        assert!(validate_crawl_target("https://sub.example.com", &allowlist).is_ok());
        assert!(validate_crawl_target("https://github.com/repo", &allowlist).is_ok());
        assert!(validate_crawl_target("https://evil.com", &allowlist).is_err());
    }

    #[test]
    fn test_invalid_schemes() {
        assert!(!is_safe_url("ftp://example.com"));
        assert!(!is_safe_url("file:///etc/passwd"));
        assert!(!is_safe_url("gopher://example.com"));
    }
}
