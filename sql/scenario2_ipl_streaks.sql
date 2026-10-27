-- Scenario 2: IPL player performance streaks (2024 season)
--
-- Players who scored 30+ runs in at least 3 consecutive matches; return the player and the
-- date the streak began.
--
-- Technique: "gaps and islands".
--   1. Number each player's 2024 innings in date order            -> appearance_no  (1,2,3,4,5,...)
--   2. Keep only 30+ innings and number those again               -> scoring_no     (1,2,3,...)
--   3. appearance_no - scoring_no is constant within an unbroken run of 30+ innings, and changes
--      every time a sub-30 innings interrupts it, so it identifies each streak ("island").
--   4. Group by that key and keep islands of 3 or more.
--
-- Assumptions:
--   * "Consecutive matches" = consecutive matches in which the player batted. A did-not-bat does
--     not break a streak. (scenario2b_ipl_streaks_team_fixtures.sql shows the stricter reading.)
--   * 30 runs exactly qualifies ("30+").
--   * A streak longer than 3 is reported once, from its first match; a player with two separate
--     streaks appears twice.
--   * Only 2024 matches are considered, so a streak cannot carry over from 2023.

WITH season_innings AS (
    SELECT
        b.player_id,
        m.match_date,
        b.runs,
        ROW_NUMBER() OVER (PARTITION BY b.player_id ORDER BY m.match_date, m.match_id) AS appearance_no
    FROM batting_scores AS b
    JOIN matches        AS m ON m.match_id = b.match_id
    WHERE m.season = 2024
),
scoring_innings AS (
    SELECT
        player_id,
        match_date,
        appearance_no - ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY appearance_no) AS streak_key
    FROM season_innings
    WHERE runs >= 30
),
streaks AS (
    SELECT
        player_id,
        MIN(match_date) AS streak_start,
        MAX(match_date) AS streak_end,
        COUNT(*)        AS matches_in_streak
    FROM scoring_innings
    GROUP BY player_id, streak_key
    HAVING COUNT(*) >= 3
)
SELECT
    p.player_name,
    s.streak_start,
    s.streak_end,
    s.matches_in_streak
FROM streaks AS s
JOIN players AS p ON p.player_id = s.player_id
ORDER BY s.streak_start, p.player_name;
