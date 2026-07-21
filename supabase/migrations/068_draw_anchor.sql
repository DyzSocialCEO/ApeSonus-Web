-- ════════════════════════════════════════════════════════════════════
-- 068: ANCHOR THE DRAW
-- ════════════════════════════════════════════════════════════════════
-- Gives pit_draw_days somewhere to record its on-chain proof. Each settled
-- draw's { seed, pool, five anon winners } is hashed and posted to Solana
-- (SPL Memo) by the admin anchor cron; these columns hold the hash, the exact
-- canonical preimage, the tx signature, and the cluster. Same shape the Read
-- settlement already uses on read_seasons, so /verify can re-hash the preimage
-- in the browser and match it against the chain.
--
-- DDL only. Idempotent. Safe to run anytime — run this BEFORE the code deploy
-- so the columns exist the first time the cron writes to them.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.pit_draw_days
  ADD COLUMN IF NOT EXISTS settle_commit_hash text,
  ADD COLUMN IF NOT EXISTS settle_canonical   text,
  ADD COLUMN IF NOT EXISTS settle_signature   text,
  ADD COLUMN IF NOT EXISTS settle_cluster     text;

-- ── Verification (single statement so the editor shows it) ──────────
SELECT
  count(*) FILTER (WHERE column_name = 'settle_commit_hash') AS has_commit_hash,
  count(*) FILTER (WHERE column_name = 'settle_canonical')   AS has_canonical,
  count(*) FILTER (WHERE column_name = 'settle_signature')   AS has_signature,
  count(*) FILTER (WHERE column_name = 'settle_cluster')     AS has_cluster
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'pit_draw_days';
