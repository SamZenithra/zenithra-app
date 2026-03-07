const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': 'https://app.auralith.uk',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method not allowed' };

  try {
    const { plan, email, userId } = JSON.parse(event.body);

    const PRICES = {
      weekly:  'price_1T8EL6RqeX8fYEjwp2phWDCu',
      monthly: 'price_1T8EL6RqeX8fYEjwNTmS7kzJ',
      annual:  'price_1T8EL6RqeX8fYEjwPgbk1YcW'
    };

    const priceId = PRICES[plan] || PRICES.monthly;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 28,
        metadata: { userId, plan }
      },
      customer_email: email,
      success_url: `https://app.auralith.uk/index.html?checkout=success&plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://app.auralith.uk/index.html?checkout=cancelled`,
      metadata: { userId, plan }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: session.url })
    };

  } catch (err) {
    console.error('Stripe error:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
