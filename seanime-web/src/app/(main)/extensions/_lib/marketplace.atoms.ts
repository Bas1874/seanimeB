import { usePatchSetting } from "@/api/hooks/settings.hooks"
import { useServerStatus } from "@/app/(main)/_hooks/use-server-status"
import React from "react"

// Empty means the server uses the default marketplace
export const DEFAULT_MARKETPLACE_URL = ""

// The URL used to live here, it's now the extensions.marketplaceUrl setting
const LEGACY_MARKETPLACE_URL_KEY = "marketplace-url"

function readLegacyMarketplaceUrl(): string {
    if (typeof window === "undefined") return ""
    try {
        const raw = window.localStorage.getItem(LEGACY_MARKETPLACE_URL_KEY)
        if (!raw) return ""
        // atomWithStorage serializes values as JSON
        const parsed = JSON.parse(raw)
        return typeof parsed === "string" ? parsed.trim() : ""
    }
    catch (e) {
        return ""
    }
}

function clearLegacyMarketplaceUrl() {
    if (typeof window === "undefined") return
    try {
        window.localStorage.removeItem(LEGACY_MARKETPLACE_URL_KEY)
    }
    catch (e) {
    }
}

// Reads/writes the marketplace URL from the settings, migrating the old localStorage value once
export function useMarketplaceUrl() {
    const serverStatus = useServerStatus()
    const { mutateAsync: patchSetting, isPending } = usePatchSetting()

    const marketplaceUrl = serverStatus?.settings?.extensions?.marketplaceUrl || DEFAULT_MARKETPLACE_URL

    const setMarketplaceUrl = React.useCallback(async (url: string) => {
        await patchSetting({ path: "extensions.marketplaceUrl", value: url.trim() })
    }, [patchSetting])

    const hasMigrated = React.useRef(false)

    React.useEffect(() => {
        if (hasMigrated.current || !serverStatus?.settings) return
        hasMigrated.current = true

        const legacyUrl = readLegacyMarketplaceUrl()
        if (!legacyUrl) return

        // The server value wins
        if (marketplaceUrl) {
            clearLegacyMarketplaceUrl()
            return
        }

        patchSetting({ path: "extensions.marketplaceUrl", value: legacyUrl })
            .then(() => clearLegacyMarketplaceUrl())
            .catch(() => {
                // Keep the old value so it can be retried
            })
    }, [serverStatus?.settings, marketplaceUrl, patchSetting])

    return {
        marketplaceUrl,
        setMarketplaceUrl,
        isUpdatingMarketplaceUrl: isPending,
    }
}
