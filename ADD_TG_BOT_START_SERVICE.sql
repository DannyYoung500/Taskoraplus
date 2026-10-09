-- Optional: add Telegram Bot Starts to DB catalog (if you use advertise_service_catalog)
insert into public.advertise_service_catalog (
  service_id, platform, service_name, task_type, active,
  min_quantity, max_quantity, customer_unit_price, tasker_unit_reward, taskora_unit_margin, pricing_model
) values (
  'tg_bot_start', 'telegram', 'Telegram Bot Starts', 'join', true,
  50, 10000, 0.02, 0.014, 0.006, 'per_action'
) on conflict (service_id) do nothing;
