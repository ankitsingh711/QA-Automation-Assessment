-- Scenario 1: round-trip transfers
--
-- Account A sends money to B, and B sends a similar amount back to A within 24 hours.
--
-- Interpretation (documented assumptions):
--   * "back" means the return leg happens AFTER the original transfer (not before it).
--   * "within 24 hours" is inclusive: a return at exactly +24:00:00 counts, +24:00:01 does not.
--   * "similar amount (within 10%)" is measured against the ORIGINAL amount and is inclusive:
--       |returned - sent| <= 10% of sent.
--   * If one transfer has several qualifying returns, every pair is reported — an analyst
--     investigating reversals wants to see all of them.
--
-- PostgreSQL equivalent of the time window: r.created_at <= o.created_at + INTERVAL '24 hours'

SELECT
    o.txn_id                                                        AS outbound_txn,
    o.from_account                                                  AS account_a,
    o.to_account                                                    AS account_b,
    o.amount                                                        AS sent_amount,
    o.created_at                                                    AS sent_at,
    r.txn_id                                                        AS return_txn,
    r.amount                                                        AS returned_amount,
    r.created_at                                                    AS returned_at,
    ROUND((julianday(r.created_at) - julianday(o.created_at)) * 24, 2) AS hours_between,
    ROUND(100.0 * (r.amount - o.amount) / o.amount, 2)              AS pct_difference
FROM transactions AS o
JOIN transactions AS r
  ON  r.from_account = o.to_account                                 -- B pays ...
  AND r.to_account   = o.from_account                               -- ... back to A
  AND r.created_at   > o.created_at                                 -- after the original
  AND r.created_at  <= datetime(o.created_at, '+24 hours')          -- within 24h (inclusive)
  AND ABS(r.amount - o.amount) * 10 <= o.amount                     -- within 10% (inclusive; avoids 0.1 float error)
ORDER BY o.created_at, r.created_at;
