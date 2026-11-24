-- Weekly tutorial link-health check (P9). Run once per environment AFTER the
-- CRON_SECRET rotation is recorded (docs/ops/SECRETS_ROTATION.md), using the same Vault
-- secrets as schedule_notifications.sql (notifications_app_url = the full /api/cron/notifications URL, notifications_cron_secret).
-- Mondays 04:17 Africa/Lagos (03:17 UTC).
select cron.unschedule('blueprint-tutorial-links') where exists (select 1 from cron.job where jobname = 'blueprint-tutorial-links');
select cron.schedule(
  'blueprint-tutorial-links',
  '17 3 * * 1',
  $$
  select net.http_post(
    url := replace((select decrypted_secret from vault.decrypted_secrets where name = 'notifications_app_url'), '/api/cron/notifications', '/api/cron/tutorial-links'),
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'notifications_cron_secret')),
    body := '{}'::jsonb
  );
  $$
);
