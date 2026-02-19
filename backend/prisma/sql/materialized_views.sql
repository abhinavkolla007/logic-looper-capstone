-- Future scale prep: materialized daily leaderboard.
-- Refresh cadence can be every 1-5 minutes depending on traffic.

CREATE MATERIALIZED VIEW IF NOT EXISTS daily_leaderboard_mv AS
SELECT
  ds."date",
  ds."userId",
  u."name",
  u."email",
  ds."score",
  ds."timeTaken",
  ROW_NUMBER() OVER (PARTITION BY ds."date" ORDER BY ds."score" DESC, ds."timeTaken" ASC) AS rank
FROM "DailyScore" ds
JOIN "User" u ON u."id" = ds."userId"
WHERE ds."solved" = true;

CREATE INDEX IF NOT EXISTS idx_daily_leaderboard_mv_date_rank
  ON daily_leaderboard_mv (date, rank);

-- Example refresh:
-- REFRESH MATERIALIZED VIEW CONCURRENTLY daily_leaderboard_mv;
