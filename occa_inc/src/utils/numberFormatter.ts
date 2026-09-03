/**
 * Formats a number to a compact string representation with suffixes (e.g., K, M, B).
 * Examples: 1200 -> '1.2K', 5100000 -> '5.1M'
 */
export function formatCompactNumber(num: number): string {
  if (num === undefined || num === null || isNaN(num)) return '0';
  
  if (num >= 1000000) {
    const formatted = (num / 1000000).toFixed(1);
    return formatted.endsWith('.0') ? `${Math.floor(num / 1000000)}M` : `${formatted}M`;
  }
  
  if (num >= 1000) {
    const formatted = (num / 1000).toFixed(1);
    return formatted.endsWith('.0') ? `${Math.floor(num / 1000)}K` : `${formatted}K`;
  }
  
  return num.toString();
}

/**
 * Generates a stable, reproducible OVERALL CLIENT CEILING for a company, based on its name.
 * This is not the live number shown to users — it's the ceiling that
 * src/utils/organicGrowth.ts's time-driven simulation grows toward over time. Keeping this
 * function name/behavior stable means every company's general "scale" stays consistent.
 */
export function getCompanyClientsCount(companyName: string): number {
  if (!companyName) return 120;
  
  let hash = 0;
  for (let i = 0; i < companyName.length; i++) {
    hash = companyName.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Generate a number between 150 and 8500
  return Math.abs(hash % 8350) + 150;
}
