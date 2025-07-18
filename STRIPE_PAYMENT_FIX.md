# Stripe Payment Fix - Quick Start Guide

## The Issue
Your Stripe payments are working, but the webhook that updates your database isn't being received because the webhook forwarding isn't running.

## Quick Fix - Run These Commands

### Step 1: Open 3 Terminal Windows

**Terminal 1 - Frontend (already running at localhost:3000):**
```bash
npm run dev
```

**Terminal 2 - Backend API Server:**
```bash
npm run dev:api
```

**Terminal 3 - Stripe Webhook Forwarding:**
```bash
# First make it executable (only need to do this once)
chmod +x scripts/stripe-listen.sh

# Then run it
./scripts/stripe-listen.sh
```

### Step 2: Update Webhook Secret (if needed)

When you run the stripe-listen.sh script, it will show a webhook secret like:
```
Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
```

If this is different from what's in your `.env.local` file, update the `STRIPE_WEBHOOK_SECRET` value.

### Step 3: Test Payment Again

1. Go to http://localhost:3000/plans
2. Click upgrade
3. Use test card: 4242 4242 4242 4242
4. Complete payment
5. Watch Terminal 2 (backend server) for webhook logs
6. Your tier should upgrade within 2-3 seconds

## What We Fixed

1. **Updated webhook handlers** in `server.js` to properly update both `subscriptions` and `user_profiles` tables
2. **Added refresh functionality** to fetch the latest tier from database after payment
3. **Added detailed logging** to help debug webhook issues

## Troubleshooting

If tier still doesn't update:
1. Check Terminal 2 for webhook logs - you should see "✅ Received webhook: checkout.session.completed"
2. Check for any database errors in the logs
3. Make sure all 3 services are running (frontend, backend, webhook forwarding)

## For Production

In production, you'll configure the webhook endpoint directly in Stripe Dashboard instead of using the CLI forwarding.