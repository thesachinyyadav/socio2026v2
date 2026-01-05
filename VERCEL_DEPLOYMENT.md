# 🚀 Vercel Deployment Guide for Socio

## Prerequisites
- GitHub account
- Vercel account (free at vercel.com)
- Supabase project (already created)

---

## Step 1: Set Up Supabase Database

### 1.1 Create Tables
1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/heiutbjodpkteealqumq
2. Click **"SQL Editor"** in the left sidebar
3. Click **"New Query"**
4. Copy and paste the contents of `supabase-schema.sql` (in the server folder)
5. Click **"Run"**

### 1.2 Set Up Authentication (Google OAuth)
1. Go to **Authentication** → **Providers** in Supabase
2. Enable **Google**
3. Go to [Google Cloud Console](https://console.cloud.google.com/)
4. Create a new project or select existing
5. Go to **APIs & Services** → **Credentials**
6. Click **Create Credentials** → **OAuth client ID**
7. Select **Web application**
8. Add authorized redirect URI: `https://heiutbjodpkteealqumq.supabase.co/auth/v1/callback`
9. Copy **Client ID** and **Client Secret**
10. Paste them in Supabase Google provider settings

### 1.3 Get Your API Keys
1. Go to **Settings** → **API** in Supabase
2. Copy these values:
   - **Project URL**: `https://heiutbjodpkteealqumq.supabase.co`
   - **anon public key**: (copy the full key)

---

## Step 2: Push Code to GitHub

Your code is already on GitHub at: https://github.com/ayrus15/socio_innowave

---

## Step 3: Deploy to Vercel

### 3.1 Connect Repository
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New..."** → **"Project"**
3. Click **"Import Git Repository"**
4. Connect your GitHub account if not already connected
5. Find and select **socio_innowave** repository
6. Click **"Import"**

### 3.2 Configure Project
1. **Framework Preset**: Next.js (auto-detected)
2. **Root Directory**: Click "Edit" and set to `client`
3. **Build Command**: `npm run build` (default)
4. **Output Directory**: Leave as default

### 3.3 Add Environment Variables
Click **"Environment Variables"** and add:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://heiutbjodpkteealqumq.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (paste your anon key from Supabase) |

### 3.4 Deploy
1. Click **"Deploy"**
2. Wait for the build to complete (2-3 minutes)
3. Your app will be live at `https://your-project.vercel.app`

---

## Step 4: Update Supabase Redirect URLs

After deployment, update your authentication redirects:

1. Go to Supabase → **Authentication** → **URL Configuration**
2. Add your Vercel URL to **Site URL**: `https://your-project.vercel.app`
3. Add to **Redirect URLs**:
   - `https://your-project.vercel.app/auth/callback`
   - `https://your-project.vercel.app`

4. Go to Google Cloud Console → Your OAuth credentials
5. Add authorized redirect URI: `https://your-project.vercel.app/auth/callback`

---

## Step 5: Verify Deployment

1. Open your Vercel URL
2. Try logging in with Google
3. Create a test event
4. Register for the event

---

## Troubleshooting

### "Invalid API Key" Error
- Make sure environment variables are set correctly in Vercel
- Redeploy after adding environment variables

### Google Login Not Working
- Check redirect URLs in both Supabase and Google Cloud Console
- Make sure the URLs match exactly (with https://)

### Database Errors
- Verify tables were created in Supabase
- Check RLS policies are in place

---

## Environment Variables Reference

### For Vercel (Client)
```
NEXT_PUBLIC_SUPABASE_URL=https://heiutbjodpkteealqumq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

### For Local Development
Create `client/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://heiutbjodpkteealqumq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

---

## 🎉 Done!

Your Socio app is now live on Vercel with Supabase as the backend!
