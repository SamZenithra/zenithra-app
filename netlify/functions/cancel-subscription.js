const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  try {
    const { userId } = JSON.parse(event.body || '{}');
    if (!userId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing userId' }) };

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    // Get user's stripe subscription ID from Supabase
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_subscription_id, stripe_customer_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'User not found' }) };
    }

    if (!profile.stripe_subscription_id) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No active subscription found' }) };
    }

    // Cancel at period end — user keeps access until billing period ends
    await stripe.subscriptions.update(profile.stripe_subscription_id, {
      cancel_at_period_end: true
    });

    // Update Supabase immediately
    await supabase
      .from('profiles')
      .update({ subscription_status: 'cancelled' })
      .eq('id', userId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Subscription cancelled at period end' })
    };

  } catch (err) {
    console.error('Cancel subscription error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || 'Internal server error' })
    };
  }
};
