import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia'
})

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const sig = req.headers['stripe-signature'] as string
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return res.status(400).json({ error: 'Webhook signature verification failed' })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(session)
        break
      }

      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionCreated(subscription)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(subscription)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentFailed(invoice)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentSucceeded(invoice)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    res.status(200).json({ received: true })
  } catch (error) {
    console.error('Error handling webhook:', error)
    res.status(500).json({ error: 'Webhook handler failed' })
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId
  const tier = session.metadata?.tier

  if (!userId || !tier) {
    console.error('Missing metadata in checkout session')
    return
  }

  try {
    // Create or update subscription in database
    const { error } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: userId,
        tier,
        status: 'active',
        stripe_subscription_id: session.subscription as string,
        stripe_customer_id: session.customer as string,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        cancel_at_period_end: false
      })

    if (error) {
      console.error('Error updating subscription:', error)
      return
    }

    // Update user tier in user_profiles
    await supabase
      .from('user_profiles')
      .update({ user_tier: tier })
      .eq('id', userId)

    console.log(`Subscription activated for user ${userId} with tier ${tier}`)
  } catch (error) {
    console.error('Error in handleCheckoutCompleted:', error)
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId
  const tier = subscription.metadata?.tier

  if (!userId || !tier) {
    console.error('Missing metadata in subscription')
    return
  }

  try {
    const { error } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: userId,
        tier,
        status: subscription.status,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: subscription.customer as string,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end || false
      })

    if (error) {
      console.error('Error creating subscription:', error)
      return
    }

    console.log(`Subscription created for user ${userId}`)
  } catch (error) {
    console.error('Error in handleSubscriptionCreated:', error)
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  try {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end || false
      })
      .eq('stripe_subscription_id', subscription.id)

    if (error) {
      console.error('Error updating subscription:', error)
      return
    }

    console.log(`Subscription updated: ${subscription.id}`)
  } catch (error) {
    console.error('Error in handleSubscriptionUpdated:', error)
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    // Get user ID from subscription
    const { data: subscriptionData } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', subscription.id)
      .single()

    if (!subscriptionData) {
      console.error('Subscription not found in database')
      return
    }

    // Update subscription status to canceled and downgrade to free
    const { error: subError } = await supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        tier: 'free'
      })
      .eq('stripe_subscription_id', subscription.id)

    if (subError) {
      console.error('Error canceling subscription:', subError)
      return
    }

    // Update user tier to free
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({ user_tier: 'free' })
      .eq('id', subscriptionData.user_id)

    if (profileError) {
      console.error('Error updating user profile:', profileError)
    }

    console.log(`Subscription canceled for user ${subscriptionData.user_id}`)
  } catch (error) {
    console.error('Error in handleSubscriptionDeleted:', error)
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  // Handle failed payments - could send email, update subscription status, etc.
  console.log(`Payment failed for subscription: ${invoice.subscription}`)
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  // Handle successful payments - could update billing info, send receipt, etc.
  console.log(`Payment succeeded for subscription: ${invoice.subscription}`)
}

// Disable body parsing for webhook
export const config = {
  api: {
    bodyParser: false,
  },
}