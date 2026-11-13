# BLUEPRINT — Google OAuth Setup & Configuration Guide

This guide documents the manual setup required to enable Google OAuth authentication in Supabase for BLUEPRINT.

> **Important:** Do not commit actual OAuth client secrets or service credentials to version control.

---

## 1. Create Google Cloud OAuth Credentials

1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Select or create a project dedicated to BLUEPRINT (e.g. `blueprint-unilag`).
3. Configure the **OAuth consent screen**:
   - **User Type:** External (or Internal if restricted to UNILAG Google Workspace).
   - **App name:** `BLUEPRINT` (Academic organization platform for Civil Engineering).
   - **User support email:** Course representative or project owner email.
   - **Scopes:** Select `.../auth/userinfo.email`, `.../auth/userinfo.profile`, and `openid`.
   - Complete and submit the consent screen details.
4. Create Credentials:
   - Navigate to **APIs & Services** > **Credentials**.
   - Click **Create Credentials** > **OAuth client ID**.
   - **Application type:** *Web application*.
   - **Name:** `BLUEPRINT Supabase Auth`.
   - **Authorized JavaScript origins:**
     - Local development: `http://localhost:3000`
     - Production: `https://<your-production-domain>.vercel.app` (or custom domain)
   - **Authorized redirect URIs:**
     - Supabase OAuth callback URL:
       ```
       https://<your-supabase-project-id>.supabase.co/auth/v1/callback
       ```
       *(You will find your exact Project ID in your Supabase project dashboard).*
5. Click **Create** and safely copy:
   - **Client ID**
   - **Client Secret**

---

## 2. Configure Google Provider in Supabase

1. Open your [Supabase Project Dashboard](https://supabase.com/dashboard).
2. Go to **Authentication** > **Providers**.
3. Locate **Google** and toggle it **ON (Enabled)**.
4. Paste the credentials from step 1:
   - **Client ID:** `<your-google-client-id>.apps.googleusercontent.com`
   - **Client Secret:** `<your-google-client-secret>`
5. Leave "Skip nonce check" unchecked.
6. Click **Save**.

---

## 3. Configure Authorised Redirect & Callback URLs in Supabase

1. In Supabase Dashboard, go to **Authentication** > **URL Configuration**.
2. **Site URL:**
   - For local development: `http://localhost:3000`
   - For production: `https://<your-production-domain>.vercel.app`
3. **Redirect URLs (Allow list):**
   Add the following patterns:
   - `http://localhost:3000/**`
   - `http://localhost:3000/auth/confirm`
   - `http://localhost:3000/auth/callback`
   - `https://<your-production-domain>.vercel.app/**`
   - `https://<your-production-domain>.vercel.app/auth/confirm`
   - `https://<your-production-domain>.vercel.app/auth/callback`
4. Click **Save**.

---

## 4. Environment Variables

Ensure your `.env.local` (and production hosting environment) has the following configured:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

## 5. Security & Verification Policy

1. **Pending Status by Default:**
   Google sign-in automatically sets the student's `verification_status` to `'pending'`. It does **not** grant automatic verification.
2. **Matriculation Details:**
   Google OAuth does not provide a UNILAG matriculation number. Newly registered Google users will see an action banner on the dashboard prompting them to submit their matriculation number.
3. **Immutable Identity:**
   Once submitted, database triggers prevent students from modifying their matriculation number or changing their verification status.
4. **Admin Privileges:**
   Admin status is strictly derived from the `public.user_roles` database table. OAuth claims or metadata never grant administrative privileges.

