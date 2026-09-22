-- Guarded: V1 already includes created_at on some environments.
SET @exist := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'task_comments'
    AND COLUMN_NAME = 'created_at'
);
SET @sqlstmt := IF(
  @exist = 0,
  'ALTER TABLE task_comments ADD COLUMN created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP',
  'SELECT 1'
);
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
