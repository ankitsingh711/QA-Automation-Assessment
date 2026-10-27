-- Test data. Every row exists to prove one rule; the expected outcome is noted beside it.

-- =============================================================================================
-- Scenario 1: transactions
-- =============================================================================================
INSERT INTO accounts (account_id, holder_name) VALUES
    ('ACC01', 'Asha Verma'),   ('ACC02', 'Bilal Qureshi'), ('ACC03', 'Chitra Das'),
    ('ACC04', 'Deepak Joshi'), ('ACC05', 'Esha Kapoor'),   ('ACC06', 'Farhan Ali'),
    ('ACC07', 'Gauri Pillai'), ('ACC08', 'Hari Menon'),    ('ACC09', 'Isha Bose'),
    ('ACC10', 'Jai Thakur'),   ('ACC11', 'Kavya Reddy'),   ('ACC12', 'Lokesh Rao'),
    ('ACC13', 'Meera Shah');

INSERT INTO transactions (txn_id, from_account, to_account, amount, created_at) VALUES
    -- MATCH: returned 9h30m later, 5% less
    (1,  'ACC01', 'ACC02', 10000.00, '2024-03-01 09:00:00'),
    (2,  'ACC02', 'ACC01',  9500.00, '2024-03-01 18:30:00'),

    -- MATCH (boundaries): exactly 24h later and exactly 10% more — both limits are inclusive
    (3,  'ACC03', 'ACC04',  5000.00, '2024-03-02 10:00:00'),
    (4,  'ACC04', 'ACC03',  5500.00, '2024-03-03 10:00:00'),

    -- NO MATCH: identical amount but 24h + 1s later
    (5,  'ACC05', 'ACC06', 20000.00, '2024-03-04 08:00:00'),
    (6,  'ACC06', 'ACC05', 20000.00, '2024-03-05 08:00:01'),

    -- NO MATCH: returned within 2h but 11.25% less
    (7,  'ACC07', 'ACC08',  8000.00, '2024-03-04 12:00:00'),
    (8,  'ACC08', 'ACC07',  7100.00, '2024-03-04 14:00:00'),

    -- NO MATCH: duplicate payment in the SAME direction (A -> B twice) is not a round trip
    (9,  'ACC09', 'ACC01',  3000.00, '2024-03-05 09:00:00'),
    (10, 'ACC09', 'ACC01',  3000.00, '2024-03-05 10:00:00'),

    -- NO MATCH: money moves on to a third party (A -> B -> C), never back to A
    (11, 'ACC02', 'ACC03',  1200.00, '2024-03-05 11:00:00'),
    (12, 'ACC03', 'ACC04',  1200.00, '2024-03-05 11:30:00'),

    -- MATCH: 8% less, 8h later. The extra small transfer back is far outside 10% and must not match.
    (13, 'ACC10', 'ACC11', 50000.00, '2024-03-06 12:00:00'),
    (14, 'ACC11', 'ACC10', 46000.00, '2024-03-06 20:00:00'),
    (15, 'ACC11', 'ACC10',  1000.00, '2024-03-06 21:00:00'),

    -- MATCH x2: one transfer, two qualifying returns — both pairs are reported for investigation
    (16, 'ACC12', 'ACC13',  1000.00, '2024-03-07 09:00:00'),
    (17, 'ACC13', 'ACC12',   950.00, '2024-03-07 10:00:00'),
    (18, 'ACC13', 'ACC12',  1050.00, '2024-03-07 11:00:00');

-- =============================================================================================
-- Scenario 2: IPL-style season (fictional players and fixtures)
-- =============================================================================================
INSERT INTO players (player_id, player_name, team) VALUES
    (1, 'Arjun Mehta',  'MUM'),
    (2, 'Rohan Iyer',   'CHE'),
    (3, 'Sameer Khan',  'CHE'),
    (4, 'Kabir Rao',    'KOL'),
    (5, 'Dev Malhotra', 'DEL'),
    (6, 'Vikram Nair',  'MUM');

INSERT INTO matches (match_id, season, match_date, home_team, away_team, venue) VALUES
    -- 2023 season (must be ignored)
    (201, 2023, '2023-05-10', 'MUM', 'CHE', 'Wankhede'),
    (202, 2023, '2023-05-14', 'DEL', 'MUM', 'Kotla'),
    -- 2024 season
    (101, 2024, '2024-03-22', 'MUM', 'CHE', 'Wankhede'),
    (102, 2024, '2024-03-24', 'KOL', 'DEL', 'Eden Gardens'),
    (103, 2024, '2024-03-27', 'CHE', 'KOL', 'Chepauk'),
    (104, 2024, '2024-03-29', 'DEL', 'MUM', 'Kotla'),
    (105, 2024, '2024-04-01', 'MUM', 'KOL', 'Wankhede'),
    (106, 2024, '2024-04-03', 'CHE', 'DEL', 'Chepauk'),
    (107, 2024, '2024-04-06', 'KOL', 'MUM', 'Eden Gardens'),
    (108, 2024, '2024-04-09', 'DEL', 'CHE', 'Kotla'),
    (109, 2024, '2024-04-12', 'MUM', 'DEL', 'Wankhede'),
    (110, 2024, '2024-04-15', 'CHE', 'MUM', 'Chepauk'),
    (111, 2024, '2024-04-18', 'KOL', 'CHE', 'Eden Gardens'),
    (112, 2024, '2024-04-21', 'DEL', 'KOL', 'Kotla'),
    (113, 2024, '2024-04-24', 'MUM', 'CHE', 'Wankhede'),
    (114, 2024, '2024-04-27', 'KOL', 'DEL', 'Eden Gardens');

INSERT INTO batting_scores (match_id, player_id, runs, balls_faced) VALUES
    -- Arjun Mehta: TWO streaks — 45, 32, 67 | 12 | 30, 31, 55 (exactly 30 counts)
    (101, 1, 45, 31), (104, 1, 32, 25), (105, 1, 67, 40), (107, 1, 12, 14),
    (109, 1, 30, 24), (110, 1, 31, 22), (113, 1, 55, 33),

    -- Rohan Iyer: 29 just misses, then 30, 88, 41 -> streak starts 2024-03-27
    (101, 2, 29, 27), (103, 2, 30, 26), (106, 2, 88, 50), (108, 2, 41, 30),
    (110, 2,  5,  7), (111, 2, 12, 10), (113, 2,  8,  9),

    -- Sameer Khan: 40, 30, (did not bat in match 106), 45.
    -- Streak of 3 *innings*; NOT a streak of 3 *team matches* (see scenario 2b).
    (101, 3, 40, 28), (103, 3, 30, 22), (108, 3, 45, 29),
    (110, 3,  3,  5), (111, 3, 22, 18), (113, 3, 19, 15),

    -- Kabir Rao: big scores but never three in a row -> no streak
    (102, 4, 50, 35), (103, 4, 60, 38), (105, 4, 10, 12), (107, 4, 70, 41),
    (111, 4, 80, 45), (112, 4,  4,  6), (114, 4,  9,  8),

    -- Dev Malhotra: one streak of FIVE -> reported once, starting 2024-03-24
    (102, 5, 33, 25), (104, 5, 34, 26), (106, 5, 35, 27), (108, 5, 36, 28),
    (109, 5, 37, 29), (112, 5,  2,  4), (114, 5,  1,  3),

    -- Vikram Nair: 40, 50 at the end of 2023 + 35 in the 2024 opener -> must NOT chain across seasons
    (201, 6, 40, 30), (202, 6, 50, 33),
    (101, 6, 35, 26), (104, 6, 10, 11), (105, 6,  8,  9), (107, 6, 44, 30),
    (109, 6, 12, 13), (110, 6,  0,  2), (113, 6,  7,  8);
