/**
 * Supported Israeli gift card networks.
 *
 * Only networks listed here are shown in the wallet add-card dropdown.
 * Names are matched case-insensitively against GiftCardNetwork.name from the DB.
 *
 * Add entries here when the backend gains support for a new network.
 */
export const SUPPORTED_NETWORK_NAMES: readonly string[] = [
  // Hebrew gift card networks / multi-store gift cards
  "BuyMe",
  "HTZone",
  "HZone",
  "Hever",
  "חבר",
  "Ashmoret",
  "אשמורת",
  "Pais Plus",
  "פייס פלוס",
  "Nofeshit",
  "נופשית",
  "Max",
  "מקס",
  "Isracard",
  "ישראכרט",
  // Retail chains with their own gift cards
  "KSP",
  "Bug",
  "באג",
];

/** True if the network name (from DB) matches any supported network. */
export function isNetworkSupported(networkName: string): boolean {
  const lower = networkName.toLowerCase().trim();
  return SUPPORTED_NETWORK_NAMES.some(
    (n) => lower === n.toLowerCase() || lower.includes(n.toLowerCase()) || n.toLowerCase().includes(lower)
  );
}
