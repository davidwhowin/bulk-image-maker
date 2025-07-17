# Stripe Payment Integration Setup

This document explains how to set up Stripe payments for the bulk image optimizer application.

## Overview

The application now supports real Stripe payments with:
- ✅ Stripe Checkout integration
- ✅ Subscription management via Stripe Customer Portal
- ✅ Webhook handling for subscription events
- ✅ Monthly and yearly billing options
- ✅ Testing mode for development
- ✅ Automatic tier upgrades with fallback handling
- ✅ BigQuery quota issue workaround
- ✅ Graceful error handling for database limits

## Setup Instructions

### 1. Create Stripe Account

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Create an account or sign in
3. Switch to **Test mode** for development

### 2. Get Stripe Keys

From your Stripe Dashboard:

1. Go to **Developers** → **API keys**
2. Copy the **Publishable key** (starts with `pk_test_`)
3. Copy the **Secret key** (starts with `sk_test_`)

### 3. Create Products and Prices

1. Go to **Products** in Stripe Dashboard
2. Create products for each tier:

#### Pro Plan
- **Name**: Pro Plan
- **Monthly Price**: $29.00 USD
- **Yearly Price**: $290.00 USD (save $58)

#### Team Plan
- **Name**: Team Plan  
- **Monthly Price**: $149.00 USD
- **Yearly Price**: $1,490.00 USD (save $298)

#### Enterprise Plan
- **Name**: Enterprise Plan
- **Monthly Price**: $499.00 USD
- **Yearly Price**: $4,990.00 USD (save $998)

3. Copy the **Price IDs** for each price (starts with `price_`)

### 4. Update Environment Variables

Update your `.env.local` file:

```env
# Stripe Configuration
STRIPE_SECRET_KEY="sk_test_your_secret_key_here"
VITE_STRIPE_PUBLISHABLE_KEY="pk_test_your_publishable_key_here"

# Stripe Price IDs
VITE_STRIPE_PRO_MONTHLY_PRICE_ID="price_your_pro_monthly_price_id"
VITE_STRIPE_PRO_YEARLY_PRICE_ID="price_your_pro_yearly_price_id"
VITE_STRIPE_TEAM_MONTHLY_PRICE_ID="price_your_team_monthly_price_id"
VITE_STRIPE_TEAM_YEARLY_PRICE_ID="price_your_team_yearly_price_id"
VITE_STRIPE_ENTERPRISE_MONTHLY_PRICE_ID="price_your_enterprise_monthly_price_id"
VITE_STRIPE_ENTERPRISE_YEARLY_PRICE_ID="price_your_enterprise_yearly_price_id"

# Webhook Secret (from Step 5)
STRIPE_WEBHOOK_SECRET="whsec_your_webhook_secret_here"

# Supabase Service Role Key (for webhooks)
SUPABASE_SERVICE_ROLE_KEY="your_service_role_key_here"
```

### 5. Set Up Webhooks

1. Go to **Developers** → **Webhooks** in Stripe Dashboard
2. Click **+ Add endpoint**
3. **Endpoint URL**: `https://your-domain.com/api/stripe/webhook`
4. **Events to send**:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.payment_succeeded`
5. Copy the **Webhook signing secret** (starts with `whsec_`)

### 6. Deploy API Routes

The Stripe integration requires server-side API routes. Deploy these files:

- `api/stripe/create-checkout-session.ts`
- `api/stripe/create-portal-session.ts`
- `api/stripe/webhook.ts`

#### Option A: Vercel Deployment
These API routes are compatible with Vercel's serverless functions.

#### Option B: Custom Server
Set up an Express.js server to handle the API routes.

### 7. Enable Real Payments

In `src/lib/subscription-service.ts`, change:

```typescript
private testingMode = false // Set to false to enable real payments
```

## Testing

### Test Mode
- Use Stripe test card numbers: `4242 4242 4242 4242`
- Any future expiry date and any 3-digit CVC
- Test webhooks using Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe/webhook`

### Production Mode
- Switch to **Live mode** in Stripe Dashboard
- Update environment variables with live keys
- Set up production webhook endpoint

## Features

### User Experience
- **Seamless Checkout**: Redirects to Stripe-hosted checkout page
- **Subscription Management**: Users can update payment methods, cancel subscriptions
- **Multiple Billing Options**: Monthly and yearly plans with savings
- **Instant Activation**: Webhooks automatically activate subscriptions

### Admin Features
- **Real-time Updates**: Webhooks keep database in sync with Stripe
- **Subscription Tracking**: Full subscription history in Supabase
- **Error Handling**: Comprehensive error handling and logging

### Security
- **PCI Compliance**: No payment data stored on your servers
- **Webhook Verification**: All webhooks verified with Stripe signatures
- **Environment Isolation**: Test and live modes completely separate

## Troubleshooting

### Common Issues

1. **"Price not found" errors**
   - Verify Price IDs in environment variables
   - Ensure prices are active in Stripe Dashboard

2. **Webhook not working**
   - Check webhook endpoint URL is accessible
   - Verify webhook signing secret
   - Check server logs for errors

3. **Subscription not updating**
   - Ensure webhooks are properly configured
   - Check Supabase RLS policies allow webhook updates

4. **BigQuery quota exceeded errors**
   - This is a temporary Supabase infrastructure issue
   - Payment still succeeds, database updates are delayed
   - Quotas reset every 24 hours
   - Manual fallback system handles tier upgrades
   - Users see "Payment successful - tier will be updated shortly"

### Testing Webhooks Locally

1. Install Stripe CLI: `npm install -g stripe`
2. Login: `stripe login`
3. Forward events: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
4. Use the provided webhook secret in your `.env.local`

## Migration from Testing Mode

To migrate existing test users to production:

1. Export user data from test database
2. Switch to live mode
3. Import users and create new subscriptions
4. Communicate plan changes to existing users

# Webhook Development Setup

## Prerequisites

1. Install Stripe CLI:
   ```bash
   # On Linux/macOS
   brew install stripe/stripe-cli/stripe
   
   # Or download from https://stripe.com/docs/stripe-cli
   ```

2. Login to Stripe CLI:
   ```bash
   stripe login
   ```

## Running the Application with Stripe

To properly receive Stripe webhooks in development, you need to run THREE things:

### Option 1: Run Everything Manually (3 terminals)

**Terminal 1 - Frontend:**
```bash
npm run dev
```

**Terminal 2 - Backend API Server:**
```bash
npm run dev:api
```

**Terminal 3 - Stripe Webhook Forwarding:**
```bash
./scripts/stripe-listen.sh
```

### Option 2: Use the Combined Script (Recommended)

First, make the stripe-listen.sh script executable:
```bash
chmod +x scripts/stripe-listen.sh
```

Then run everything together:
```bash
npm run dev:full
# In a separate terminal:
./scripts/stripe-listen.sh
```

## Important: Setting the Webhook Secret

When you run `./scripts/stripe-listen.sh`, it will display a webhook signing secret that looks like:
```
Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
```

**Copy this secret and add it to your `.env.local` file:**
```env
STRIPE_WEBHOOK_SECRET="whsec_xxxxxxxxxxxxx"
```

## Testing the Payment Flow

1. Make sure all three services are running (frontend, backend, webhook forwarding)
2. Go to http://localhost:3000/plans
3. Click upgrade on any plan
4. Use test card: 4242 4242 4242 4242
5. Complete the payment
6. You should see webhook logs in the terminal running the Express server
7. Your tier should be upgraded after a few seconds

## Advanced Troubleshooting

### Webhook not received
- Check that the Express server is running on port 3001
- Check that stripe-listen.sh is running and shows "Ready!"
- Check that STRIPE_WEBHOOK_SECRET is set in .env.local
- Restart the Express server after setting the webhook secret

### Tier not updating
- Check the Express server logs for any errors
- Check the Stripe Dashboard > Webhooks to see if events are being sent
- Check Supabase logs for any database errors

## Production Status

**✅ RESOLVED**: The Stripe payment system is fully functional with comprehensive error handling.

### Current Implementation:
- **Webhook Processing**: Working correctly with fallback mechanisms
- **Tier Upgrades**: Automatic with manual fallback for quota issues
- **Error Handling**: Graceful degradation with user-friendly messages
- **Production Ready**: Complete payment flow with robust error recovery

### For Production Deployment:
1. Set up webhook endpoint in Stripe Dashboard instead of CLI forwarding
2. Use environment variables for all sensitive data
3. Monitor webhook delivery in Stripe Dashboard
4. Set up proper logging and monitoring

The Stripe integration is now ready for production use! 🚀