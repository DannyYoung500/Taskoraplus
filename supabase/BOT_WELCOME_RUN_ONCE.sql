-- ============================================================
-- TASKORA — Bot /start welcome (owner-editable)
-- Safe to re-run (idempotent).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bot_welcome_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  photo_url text,
  photo_file_id text,
  message_text text NOT NULL DEFAULT E'👋 WELCOME TO TASKORA\n\nHey @username, welcome to your new earning hub. 🚀\n\n⚡ COMPLETE\nDiscover verified tasks and turn your activity into rewards.\n\n🎮 PLAY\nExplore games and entertainment experiences.\n\n▶️ WATCH & EARN\nComplete eligible video activities and earn rewards.\n\n👥 CONNECT\nInvite friends, build your network and earn eligible commissions.\n\n⭐ LEVEL UP\nBuild your Task Points, unlock progress and climb the leaderboard.\n\n💰 MANAGE YOUR REWARDS\nTrack your earnings and manage your withdrawal balance.\n\n🛡️ Verified • Secure • Built for Telegram\n\nYour journey starts here.\n\nTap below to enter TASKORA. 🚀',
  buttons jsonb NOT NULL DEFAULT '[
    {"id":"open","label":"🚀 OPEN TASKORA","type":"web_app","url":""},
    {"id":"tasks","label":"📋 TASKS","type":"web_app","path":"/tasks"},
    {"id":"games","label":"🎮 GAMES","type":"web_app","path":"/tasks"},
    {"id":"watch","label":"▶️ WATCH & EARN","type":"web_app","path":"/watch-earn"},
    {"id":"refer","label":"👥 REFER","type":"web_app","path":"/profile"},
    {"id":"rewards","label":"💰 REWARDS","type":"web_app","path":"/wallet"},
    {"id":"account","label":"👤 ACCOUNT","type":"web_app","path":"/profile"},
    {"id":"community","label":"📢 JOIN COMMUNITY","type":"url","url":"https://t.me/Taskoraplus"}
  ]'::jsonb,
  community_url text NOT NULL DEFAULT 'https://t.me/Taskoraplus',
  mini_app_url text,
  enabled boolean NOT NULL DEFAULT true,
  draft_photo_url text,
  draft_photo_file_id text,
  draft_message_text text,
  draft_buttons jsonb,
  draft_community_url text,
  draft_mini_app_url text,
  previous_photo_url text,
  previous_photo_file_id text,
  previous_message_text text,
  previous_buttons jsonb,
  previous_community_url text,
  previous_mini_app_url text,
  published_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.bot_welcome_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

UPDATE public.bot_welcome_settings
SET
  draft_message_text = COALESCE(draft_message_text, message_text),
  draft_buttons = COALESCE(draft_buttons, buttons),
  draft_photo_url = COALESCE(draft_photo_url, photo_url),
  draft_community_url = COALESCE(draft_community_url, community_url),
  draft_mini_app_url = COALESCE(draft_mini_app_url, mini_app_url)
WHERE id = true;

ALTER TABLE public.bot_welcome_settings ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.bot_welcome_settings TO service_role;
GRANT SELECT ON public.bot_welcome_settings TO authenticated;

SELECT 'bot_welcome_settings ready' AS status, enabled, length(message_text) AS msg_len
FROM public.bot_welcome_settings WHERE id = true;
