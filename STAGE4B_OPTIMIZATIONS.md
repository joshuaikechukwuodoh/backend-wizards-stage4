# Insighta Labs+ Stage 4B Optimization Summary

Optimizations implemented across the project to improve performance, normalization, and ingestion efficiency.

## 1. Database & Schema Optimization (`backend/src/db/schema.ts`)
*   **Added B-tree Indexes**: Created indexes for single-column filters (`age`, `gender`, `country_id`, `age_group`) to eliminate full table scans.
*   **Added Compound Indexes**: Implemented compound indexes for common query combinations (`(gender, age)` and `(country_id, gender)`) to speed up multi-parameter filter queries.

## 2. Query Performance Route (`backend/src/routes/profiles.ts`)
*   **Optimized Count Queries**: Separated the `COUNT(*)` database call from the main result retrieval. Total counts are now cached with an independent key, preventing heavy recalculations for every page of a paginated request.
*   **Refined Filtering**: Streamlined the `where` clause construction to ensure all filters correctly leverage the new database indexes.

## 3. Query Parsing & Normalization (`backend/src/utils/parser.ts`)
*   **Robust NLP Parsing**: Updated `parseQuery` to handle:
    *   Synonyms for gender (e.g., "women" → "female").
    *   Flexible phrasing for age ranges (e.g., "above X", "below Y", "between X and Y").
    *   Normalization of special dash characters ("–", "—" → "-").
    *   Demonym-to-ISO country code mapping.
*   **Deterministic Normalization**: Updated `normalizeFilters` and `filtersToCacheKey` to:
    *   Alphabetically sort filter keys.
    *   Trim and lowercase all string values.
    *   Maintain consistent data types for numbers to ensure exact cache matches.

## 4. Streaming CSV Ingestion (`backend/src/routes/ingest.ts`)
*   **Memory-Efficient Streaming**: Implemented an `AsyncGenerator` with `ReadableStream` to process incoming CSV data line-by-line, preventing memory overflows for large files (up to 500,000 rows).
*   **Batch Processing**: Introduced `BATCH_SIZE = 1000` to process and insert rows in bulk, reducing network overhead to the remote PostgreSQL database.
*   **Idempotency**: Utilized `.onConflictDoNothing({ target: profiles.name })` to safely handle duplicate profile names without blocking the upload.
*   **Detailed Reporting**: Added strict validation logic that tracks the number of skipped rows and the specific reasons (e.g., `invalid_age`, `missing_fields`, `malformed_row`), providing a summary as required by the spec.
