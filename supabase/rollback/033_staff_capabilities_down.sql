-- Reverse of 033_staff_capabilities.sql. Admin roles granted through approve_capability
-- stay in user_roles (they are ordinary admin rows); review them before running this.
drop function if exists public.revoke_capability(uuid, text);
drop function if exists public.approve_capability(uuid);
drop function if exists public.grant_capability(uuid, text, text, uuid, uuid, timestamptz, text);
drop function if exists public.my_capabilities();
drop function if exists public.has_capability(text, text, uuid, uuid);
drop function if exists public.user_has_capability(uuid, text, text, uuid, uuid);
drop table if exists public.staff_assignment_events;
drop table if exists public.staff_assignments;
