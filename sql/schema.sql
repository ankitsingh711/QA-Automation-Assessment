-- Streamhub QA assessment — A4 SQL schema (SQLite 3.25+; window functions required)
-- Timestamps are stored as ISO-8601 UTC text ('YYYY-MM-DD HH:MM:SS'), which sorts chronologically.

PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS batting_scores;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS players;

-- ---------------------------------------------------------------------------------------------
-- Scenario 1: round-trip transfers
-- ---------------------------------------------------------------------------------------------
CREATE TABLE accounts (
    account_id   TEXT PRIMARY KEY,
    holder_name  TEXT NOT NULL
);

CREATE TABLE transactions (
    txn_id        INTEGER PRIMARY KEY,
    from_account  TEXT    NOT NULL REFERENCES accounts (account_id),
    to_account    TEXT    NOT NULL REFERENCES accounts (account_id),
    amount        NUMERIC NOT NULL CHECK (amount > 0),
    created_at    TEXT    NOT NULL,
    CHECK (from_account <> to_account)
);

-- Serves the self-join: "transfers from X to Y after time T".
CREATE INDEX idx_transactions_route_time ON transactions (from_account, to_account, created_at);

-- ---------------------------------------------------------------------------------------------
-- Scenario 2: IPL-style player performance (fictional players)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE players (
    player_id    INTEGER PRIMARY KEY,
    player_name  TEXT NOT NULL,
    team         TEXT NOT NULL            -- team for the 2024 season
);

CREATE TABLE matches (
    match_id     INTEGER PRIMARY KEY,
    season       INTEGER NOT NULL,
    match_date   TEXT    NOT NULL,        -- 'YYYY-MM-DD'
    home_team    TEXT    NOT NULL,
    away_team    TEXT    NOT NULL,
    venue        TEXT
);

-- One row per player per match in which the player batted (did-not-bat = no row).
CREATE TABLE batting_scores (
    match_id     INTEGER NOT NULL REFERENCES matches (match_id),
    player_id    INTEGER NOT NULL REFERENCES players (player_id),
    runs         INTEGER NOT NULL CHECK (runs >= 0),
    balls_faced  INTEGER NOT NULL CHECK (balls_faced >= 0),
    PRIMARY KEY (match_id, player_id)
);

CREATE INDEX idx_matches_season_date ON matches (season, match_date);
