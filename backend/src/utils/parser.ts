export function parseQuery(query: string) {
  const q = query.toLowerCase();
  const filters: Record<string, string | number> = {};

  // gender detection
  const hasFemale = /females?|women|woman/i.test(q);
  const hasMale = /\bmales?\b|\bmen\b|\bman\b/i.test(q);

  if (hasFemale && !hasMale) {
    filters.gender = "female";
  } else if (hasMale && !hasFemale) {
    filters.gender = "male";
  }

  // age ranges
  if (/young/i.test(q)) {
    filters.min_age = 18;
    filters.max_age = 35;
  }

  // explicit age ranges: "aged 20-45", "ages 20 to 45", "between 20 and 45"
  const ageRangeMatch = q.match(/(?:aged?|ages?|between)\s+(\d+)\s*(?:-|–|to|and)\s*(\d+)/i);
  if (ageRangeMatch) {
    filters.min_age = Number(ageRangeMatch[1]);
    filters.max_age = Number(ageRangeMatch[2]);
  }

  if (/above 30/i.test(q)) filters.min_age = 30;
  else if (/above 17/i.test(q)) filters.min_age = 17;

  if (/below 20/i.test(q)) filters.max_age = 20;

  // age groups
  if (/teenagers?/i.test(q)) filters.age_group = "teenager";
  if (/\badults?\b/i.test(q)) filters.age_group = "adult";
  if (/seniors?|elderly/i.test(q)) filters.age_group = "senior";
  if (/child|children/i.test(q)) filters.age_group = "child";

  // countries — mapped to ISO codes
  const countryMap: Record<string, string> = {
    nigeria: "NG",
    nigerian: "NG",
    kenya: "KE",
    kenyan: "KE",
    angola: "AO",
    angolan: "AO",
    ghana: "GH",
    ghanaian: "GH",
    "south africa": "ZA",
    "south african": "ZA",
    ethiopia: "ET",
    ethiopian: "ET",
    egypt: "EG",
    egyptian: "EG",
    tanzania: "TZ",
    tanzanian: "TZ",
    uganda: "UG",
    ugandan: "UG",
  };

  for (const [pattern, code] of Object.entries(countryMap)) {
    if (q.includes(pattern)) {
      filters.country_id = code;
      break;
    }
  }

  return filters;
}

/**
 * Produces a deterministic canonical form of a filter object.
 * Keys sorted alphabetically; string values lowercased and trimmed.
 * Two queries with identical semantic intent produce identical output.
 */
export function normalizeFilters(filters: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const key of Object.keys(filters).sort()) {
    const val = filters[key];
    normalized[key] = typeof val === "string" ? val.trim().toLowerCase() : val;
  }
  return normalized;
}

/**
 * Converts a normalized filter object into a stable cache key string.
 */
export function filtersToCacheKey(prefix: string, filters: Record<string, unknown>): string {
  const normalized = normalizeFilters(filters);
  const parts = Object.entries(normalized)
    .map(([k, v]) => `${k}=${v}`)
    .join(":");
  return `${prefix}:${parts}`;
}
