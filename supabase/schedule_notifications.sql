-- Run once in the Supabase SQL Editor after setting these secrets in Vault:
--   notifications_app_url: https://<your-production-host>/api/cron/notifications
--   notifications_cron_secret: the same random value configured as CRON_SECRET
--
-- Supabase Cron uses UTC. This job runs every minute; activity dates and quiet
-- hours are converted/evaluated by the server in Africa/Lagos.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'blueprint-notification-dispatch',
  '* * * * *',
  $$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'notifications_app_url'
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'notifications_cron_secret'
        )
      ),
      body := '{}'::jsonb
    );
  $$
);
