SELECT pg_size_pretty(pg_database_size(current_database())) AS database_size;

SELECT
  schemaname,
  relname AS table_name,
  indexrelname AS index_name,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
  pg_relation_size(indexrelid) AS index_bytes
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND relname IN ('catalogo', 'catalogo_item_naturezas')
ORDER BY index_bytes DESC;
