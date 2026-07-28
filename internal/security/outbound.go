package security

import (
	"context"
	"fmt"
	"net"
	"net/netip"
	"net/url"
	"strings"
	"time"
)

func ValidateOutboundUrl(rawURL string) error {
	if !IsStrict() {
		return nil
	}

	parsed, err := url.Parse(rawURL)
	if err != nil {
		return err
	}

	host := strings.TrimSpace(parsed.Hostname())
	if host == "" {
		return fmt.Errorf("missing host")
	}

	if strings.EqualFold(host, "localhost") {
		return fmt.Errorf("private network access denied: host '%s' resolves to localhost", host)
	}

	if addr, err := netip.ParseAddr(host); err == nil {
		if isPrivateNetworkAddr(addr) {
			return fmt.Errorf("private network access denied: host '%s' is not reachable from strict mode", host)
		}
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	addrs, err := net.DefaultResolver.LookupNetIP(ctx, "ip", host)
	if err != nil {
		return nil
	}

	for _, addr := range addrs {
		if isPrivateNetworkAddr(addr) {
			return fmt.Errorf("private network access denied: host '%s' resolves to a private address", host)
		}
	}

	return nil
}

// ValidateMarketplaceUrl validates a marketplace URL coming from the client or a plugin.
// The scheme and host checks run even outside strict mode, unlike ValidateOutboundUrl.
func ValidateMarketplaceUrl(rawURL string) error {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return nil
	}

	parsed, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("invalid marketplace URL: %w", err)
	}

	switch strings.ToLower(parsed.Scheme) {
	case "http", "https":
	default:
		return fmt.Errorf("invalid marketplace URL: scheme must be http or https")
	}

	if strings.TrimSpace(parsed.Hostname()) == "" {
		return fmt.Errorf("invalid marketplace URL: missing host")
	}

	return ValidateOutboundUrl(rawURL)
}

func isPrivateNetworkAddr(addr netip.Addr) bool {
	addr = addr.Unmap()
	return addr.IsLoopback() || addr.IsPrivate() || addr.IsLinkLocalUnicast() || addr.IsLinkLocalMulticast() || addr.IsMulticast() || addr.IsUnspecified()
}
