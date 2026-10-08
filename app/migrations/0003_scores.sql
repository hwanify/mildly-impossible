-- The worldwide tally for "Top 18% worldwide" (src/lib/scores.ts): per game, how many goes ended
-- on each score bucket. No people, no times, just counts.
CREATE TABLE IF NOT EXISTS score_tally (
  game TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (game, bucket)
);
