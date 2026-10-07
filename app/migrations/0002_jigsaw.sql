-- The shared jigsaw (chores/jigsaw/api.ts). Which puzzle is out and when it was finished, every
-- piece people have put in (the starting bits aren't stored, they're worked out from the puzzle
-- number), and the one piece each visitor is holding.
CREATE TABLE IF NOT EXISTS jigsaw_state (
  id INTEGER PRIMARY KEY,
  no INTEGER NOT NULL,
  done_at INTEGER
);
CREATE TABLE IF NOT EXISTS jigsaw_pieces (
  no INTEGER NOT NULL,
  cell INTEGER NOT NULL,
  placed_at INTEGER NOT NULL,
  PRIMARY KEY (no, cell)
);
CREATE TABLE IF NOT EXISTS jigsaw_holds (
  who TEXT PRIMARY KEY,
  no INTEGER NOT NULL,
  cell INTEGER NOT NULL,
  until INTEGER NOT NULL
);
