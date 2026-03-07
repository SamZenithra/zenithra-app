const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': 'https://app.auralith.uk',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const { sessionId } = JSON.parse(event.body);
    if (!sessionId) throw new Error('No session ID');

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription']
    });

    if (session.status !== 'complete') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Session not complete' }) };
    }

    const userId = session.metadata?.userId;
    const plan = session.metadata?.plan || 'monthly';
    const sub = session.subscription;

    if (userId) {
      await sb.from('profiles').update({
        card_added: true,
        subscription_status: 'trial',
        subscription_plan: plan,
        stripe_customer_id: session.customer,
        stripe_subscription_id: sub?.id || null,
        trial_ends_at: sub?.trial_end
          ? new Date(sub.trial_end * 1000).toISOString()
          : new Date(Date.now() + 28 * 86400000).toISOString()
      }).eq('id', userId);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        plan,
        trialEnd: sub?.trial_end || null
      })
    };

  } catch (err) {
    console.error('checkout-success error:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
