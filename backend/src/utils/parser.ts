export function parseQuery(query: string) {
  const q = query.toLowerCase().replace(/[–—]/g, "-"); // Normalize dashes
  const filters: Record<string, any> = {};

  // Gender detection with synonyms
  const femalePatterns = /\bfemales?\b|\bwomen\b|\bwoman\b/i;
  const malePatterns = /\bmales?\b|\bmen\b|\bman\b/i;

  if (femalePatterns.test(q) && !malePatterns.test(q)) {
    filters.gender = "female";
  } else if (malePatterns.test(q) && !femalePatterns.test(q)) {
    filters.gender = "male";
  }

  // Handle "young" synonym
  if (/\byoung\b/i.test(q)) {
    filters.min_age = 18;
    filters.max_age = 35;
  }

  // Explicit age ranges: "aged 20-45", "ages 20 to 45", "between 20 and 45"
  const ageRangeMatch = q.match(/(?:aged?|ages?|between)\s+(\d+)\s*(?:-|to|and)\s*(\d+)/i);
  if (ageRangeMatch) {
    filters.min_age = Math.min(Number(ageRangeMatch[1]), Number(ageRangeMatch[2]));
    filters.max_age = Math.max(Number(ageRangeMatch[1]), Number(ageRangeMatch[2]));
  }

  // Handle individual age constraints
  const aboveMatch = q.match(/\b(?:above|over|older than)\s+(\d+)\b/i);
  if (aboveMatch) filters.min_age = Number(aboveMatch[1]);

  const belowMatch = q.match(/\b(?:below|under|younger than)\s+(\d+)\b/i);
  if (belowMatch) filters.max_age = Number(belowMatch[1]);

  // Age group synonyms
  if (/\bteenagers?\b|\bteens?\b/i.test(q)) filters.age_group = "teenager";
  if (/\badults?\b/i.test(q)) filters.age_group = "adult";
  if (/\bseniors?\b|\belderly\b/i.test(q)) filters.age_group = "senior";
  if (/\bchild(?:ren)?\b|\bkids?\b/i.test(q)) filters.age_group = "child";

  // Country detection with demonyms
  const countryMap: Record<string, string> = {
    nigeria: "NG", nigerian: "NG",
    kenya: "KE", kenyan: "KE",
    angola: "AO", angolan: "AO",
    ghana: "GH", ghanaian: "GH",
    "south africa": "ZA", "south african": "ZA",
    ethiopia: "ET", ethiopian: "ET",
    egypt: "EG", egyptian: "EG",
    tanzania: "TZ", tanzanian: "TZ",
    uganda: "UG", ugandan: "UG",
  };

  for (const [pattern, code] of Object.entries(countryMap)) {
    if (new RegExp(`\\b${pattern}\\b`, "i").test(q)) {
      filters.country_id = code;
      break;
    }
  }

  return filters;
}

/**
 * Produces a deterministic canonical form of a filter object.
 * Keys sorted alphabetically; string values lowercased and trimmed.
 * Numbers are kept as numbers for consistent comparison.
 */
export function normalizeFilters(filters: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = {};
  const sortedKeys = Object.keys(filters).sort();
  
  for (const key of sortedKeys) {
    const val = filters[key];
    if (val === undefined || val === null || val === "") continue;
    
    if (typeof val === "string") {
      normalized[key] = val.trim().toLowerCase();
    } else if (typeof val === "number") {
      normalized[key] = val;
    } else {
      normalized[key] = val;
    }
  }
  return normalized;
}

/**
 * Converts a normalized filter object into a stable cache key string.
 */
export function filtersToCacheKey(prefix: string, filters: Record<string, any>): string {
  const normalized = normalizeFilters(filters);
  const parts = Object.entries(normalized)
    .map(([k, v]) => `${k}=${v}`)
    .join(":");
  return parts ? `${prefix}:${parts}` : prefix;
}
