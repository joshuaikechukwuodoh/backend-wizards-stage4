export function parseQuery(query: string) {
  const q = query.toLowerCase();
  const filters: any = {};

  // gender detection using Regex
  const hasFemale = /females?/i.test(q);
  const hasMale = /\bmales?\b/i.test(q); // \b ensures we don't match 'female' as 'male'

  if (hasFemale && !hasMale) {
    filters.gender = "female";
  } else if (hasMale && !hasFemale) {
    filters.gender = "male";
  }

  // age ranges
  if (/young/i.test(q)) {
    filters.min_age = 16;
    filters.max_age = 24;
  }

  if (/above 30/i.test(q)) {
    filters.min_age = 30;
  } else if (/above 17/i.test(q)) {
    filters.min_age = 17;
  }

  if (/below 20/i.test(q)) {
    filters.max_age = 20;
  }

  // age groups
  if (/teenagers?/i.test(q)) {
    filters.age_group = "teenager";
  }
  if (/adults?/i.test(q)) {
    filters.age_group = "adult";
  }

  // countries
  if (/nigeria/i.test(q)) filters.country_id = "NG";
  if (/kenya/i.test(q)) filters.country_id = "KE";
  if (/angola/i.test(q)) filters.country_id = "AO";

  return filters;
}