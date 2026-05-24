WITH table_sizes AS (
  SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    pg_total_relation_size(c.oid) AS total_bytes,
    pg_relation_size(c.oid) AS table_bytes,
    pg_indexes_size(c.oid) AS index_bytes,
    COALESCE(s.n_live_tup, 0) AS estimated_rows
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
  WHERE c.relkind IN ('r', 'p')
    AND n.nspname NOT IN ('pg_catalog', 'information_schema')
)
SELECT
  schema_name,
  table_name,
  pg_size_pretty(total_bytes) AS total_size,
  pg_size_pretty(table_bytes) AS table_size,
  pg_size_pretty(index_bytes) AS index_size,
  estimated_rows
FROM table_sizes
ORDER BY total_bytes DESC
LIMIT 30;
