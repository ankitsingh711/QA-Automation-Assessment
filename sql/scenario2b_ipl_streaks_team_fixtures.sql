-- Scenario 2b (variant): streaks over the TEAM's consecutive fixtures
--
-- Stricter reading of "consecutive matches": every match the player's team played counts, so a
-- match where the player did not bat (or was not picked) breaks the streak.
-- Assumes a player stays with one team for the season (players.team).
--
-- Compared with scenario 2, Sameer Khan drops out: his three 30+ innings straddle a team match
-- (2024-04-03) in which he did not bat.

WITH team_fixtures AS (
    SELECT
        p.player_id,
        m.match_id,
        m.match_date,
        ROW_NUMBER() OVER (PARTITION BY p.player_id ORDER BY m.match_date, m.match_id) AS fixture_no
    FROM players AS p
    JOIN matches AS m ON p.team IN (m.home_team, m.away_team)
    WHERE m.season = 2024
),
scoring_fixtures AS (
    SELECT
        f.player_id,
        f.match_date,
        f.fixture_no - ROW_NUMBER() OVER (PARTITION BY f.player_id ORDER BY f.fixture_no) AS streak_key
    FROM team_fixtures  AS f
    JOIN batting_scores AS b ON b.match_id = f.match_id AND b.player_id = f.player_id
    WHERE b.runs >= 30
),
streaks AS (
    SELECT player_id, MIN(match_date) AS streak_start, MAX(match_date) AS streak_end, COUNT(*) AS matches_in_streak
    FROM scoring_fixtures
    GROUP BY player_id, streak_key
    HAVING COUNT(*) >= 3
)
SELECT p.player_name, s.streak_start, s.streak_end, s.matches_in_streak
FROM streaks AS s
JOIN players AS p ON p.player_id = s.player_id
ORDER BY s.streak_start, p.player_name;
