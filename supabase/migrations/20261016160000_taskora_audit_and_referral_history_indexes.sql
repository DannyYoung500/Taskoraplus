-- TaskoraPlus: audit and referral history query indexes.
-- Additive indexes for owner verification timelines and referral reward history.

CREATE INDEX IF NOT EXISTS verification_events_actor_created_idx
  ON public.verification_events (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS referral_challenge_rewards_inviter_created_idx
  ON public.referral_challenge_rewards (inviter_user_id, created_at DESC);
