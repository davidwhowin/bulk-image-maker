import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
});

const supabase = createClient(
  process.env.VITE_SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { priceId, userId, userEmail, successUrl, cancelUrl, tier } =
      req.body as {
        priceId: string;
        userId: string;
        userEmail: string;
        successUrl: string;
        cancelUrl: string;
        tier: string;
      };

    if (
      !priceId ||
      !userId ||
      !userEmail ||
      !successUrl ||
      !cancelUrl ||
      !tier
    ) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // FIXED: Check for existing customer first to prevent duplicates
    let customerId: string | undefined;

    // First, check if we have a customer ID stored in our database
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    if (existingSubscription?.stripe_customer_id) {
      customerId = existingSubscription.stripe_customer_id;
      console.warn(
        `♻️ Reusing existing customer from subscription: ${customerId}`
      );
    } else {
      // Also check billing_info table
      const { data: existingBilling } = await supabase
        .from('billing_info')
        .select('stripe_customer_id')
        .eq('user_id', userId)
        .single();

      if (existingBilling?.stripe_customer_id) {
        customerId = existingBilling.stripe_customer_id;
        console.warn(
          `♻️ Reusing existing customer from billing: ${customerId}`
        );
      } else {
        // Check if customer exists in Stripe by email
        const existingCustomers = await stripe.customers.list({
          email: userEmail,
          limit: 1,
        });

        if (existingCustomers.data.length > 0) {
          customerId = existingCustomers.data[0].id;
          console.warn(
            `♻️ Found existing Stripe customer by email: ${customerId}`
          );
        } else {
          // Create new customer only if none exists
          const customer = await stripe.customers.create({
            email: userEmail,
            metadata: {
              userId,
            },
          });
          customerId = customer.id;
          console.warn(`🆕 Created new customer: ${customerId}`);
        }
      }
    }

    // Create Stripe checkout session with existing or new customer
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer: customerId, // Use specific customer instead of customer_email
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        tier,
      },
      subscription_data: {
        metadata: {
          userId,
          tier,
        },
      },
      allow_promotion_codes: true,
    });

    res.status(200).json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({
      error: 'Failed to create checkout session',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
