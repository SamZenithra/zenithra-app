// netlify/functions/stripe-webhook.js
// Listens for Stripe events and updates Supabase accordingly

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // service role key — NOT anon key
);

exports.handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  const data = stripeEvent.data.object;

  // Helper: update user profile by Stripe customer ID
  async function updateByCustomer(customerId, fields) {
    const { error } = await sb
      .from('profiles')
      .update(fields)
      .eq('stripe_customer_id', customerId);
    if (error) console.error('Supabase update error:', error);
  }

  switch (stripeEvent.type) {

    // ── Payment succeeded → activate subscription ──
    case 'invoice.payment_succeeded': {
      const customerId = data.customer;
      const subId = data.subscription;
      await updateByCustomer(customerId, {
        subscription_status: 'active',
        stripe_subscription_id: subId,
        card_added: true,
      });
      console.log('✅ Subscription activated for customer:', customerId);
      break;
    }

    // ── Payment failed → mark as past_due ──
    case 'invoice.payment_failed': {
      const customerId = data.customer;
      await updateByCustomer(customerId, {
        subscription_status: 'past_due',
      });
      console.log('⚠️ Payment failed for customer:', customerId);
      break;
    }

    // ── Subscription cancelled or ended ──
    case 'customer.subscription.deleted': {
      const customerId = data.customer;
      await updateByCustomer(customerId, {
        subscription_status: 'cancelled',
        card_added: false,
      });
      console.log('❌ Subscription cancelled for customer:', customerId);
      break;
    }

    // ── Subscription updated (e.g. plan change) ──
    case 'customer.subscription.updated': {
      const customerId = data.customer;
      const status = data.status; // active, past_due, canceled, etc.
      const mappedStatus =
        status === 'active' ? 'active' :
        status === 'past_due' ? 'past_due' :
        status === 'canceled' ? 'cancelled' : status;
      await updateByCustomer(customerId, {
        subscription_status: mappedStatus,
      });
      console.log('🔄 Subscription updated:', customerId, '→', mappedStatus);
      break;
    }

    default:
      console.log('Unhandled event type:', stripeEvent.type);
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
