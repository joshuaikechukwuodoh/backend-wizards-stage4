# Insighta Labs+ Stage 4B Solution

This document outlines the optimization strategy, design decisions, performance impact, and resilience measures implemented for Stage 4B.

## 1. Optimization Approach

### Query Performance
*   **Database Indexing**: Implemented B-tree indexes on filter columns (`age`, `gender`, `country_id`, `age_group`) and compound indexes for frequent query combinations (`gender+age`, `country+gender`). This reduces database search complexity from O(N) to O(log N).
*   **Count Caching**: Total count operations, which were previously executed on every paginated request, are now cached independently. This prevents redundant, heavy scans when a user paginates through a result set.

### Query Normalization
*   **NLP Parsing**: Enhanced the query parser to treat synonyms (e.g., "women" vs "females") and varied phrasing ("between 20 and 45" vs "20-45") as identical.
*   **Deterministic Normalization**: Implemented a canonicalization layer that sorts filter keys and standardizes formats before generating cache keys. This ensures that different phrasing leads to a cache hit rather than a redundant database query.

### CSV Data Ingestion
*   **Streaming Pipeline**: Used `ReadableStream` to process CSV files line-by-line, keeping memory usage constant regardless of file size (supports up to 500k rows).
*   **Batch Processing**: Implemented 1000-row batching to drastically reduce network round-trips to the remote database.

## 2. Design Decisions & Trade-offs

*   **Trade-off (Indexing)**: Added indexes to improve read performance. The trade-off is slightly slower write performance during massive CSV ingests. This was deemed acceptable as read traffic heavily dominates the workload.
*   **Decision (Idempotency)**: Chose `ON CONFLICT DO NOTHING` for CSV inserts. This is faster than checking for existence row-by-row (SELECT before INSERT) and satisfies the requirement for an atomic, high-performance ingestion flow.
*   **Decision (Separate Cache)**: Caching data and counts separately was chosen over a unified cache to maximize the hit rate for pagination requests where the underlying profile result might change faster than the total count of matches.

## 3. Before/After Comparison (Estimated)

| Metric | Before Optimization | After Optimization |
| :--- | :--- | :--- |
| **Search Query (1M records)** | 800ms - 1.5s | 150ms - 300ms |
| **Paginated Count Query** | ~500ms | ~20ms (cached) |
| **Normalization Hit Rate** | Low (semantic misses) | High |
| **CSV Ingestion (10k rows)** | ~60s (O(N) inserts) | ~5s (Batched) |

## 4. Ingestion Resilience & Edge Cases

*   **Partial Failures**: The pipeline tracks `inserted` vs `skipped` counts. It does not stop on error; instead, it logs the reason for every skipped row.
*   **Error Reporting**: We report specific reasons (e.g., `invalid_age`, `missing_fields`, `duplicate_name`, `malformed_row`) in the final JSON response, allowing users to correct their source data.
*   **Malformed Rows**: Lines that do not match the expected column count or contain broken encoding are discarded to protect database integrity.
