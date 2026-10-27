import "server-only";

// Code talks to this interface; the mode comes from env/config (docs/03-ordering-payments.md).
//  - demo:    no Stripe keys (pitch demos, local dev). Payment is simulated with the test card.
//  - connect: our platform key + the restaurant's connected account id.
//  - direct:  the restaurant's own secret key.
export interface CheckoutRequest {
  orderId: string;
  orderNumber: string;
  amountCents: number;
  customerEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
}

export interface PaymentProvider {
  name: "demo" | "connect" | "direct";
  /** Returns a URL to send the customer to, or null when payment is already complete (demo). */
  startCheckout(req: CheckoutRequest): Promise<{ redirectUrl: string | null; ref: string }>;
}

const demo: PaymentProvider = {
  name: "demo",
  async startCheckout(req) {
    return { redirectUrl: null, ref: `demo_${req.orderNumber}_${Date.now()}` };
  },
};

function stripeProvider(mode: "connect" | "direct"): PaymentProvider {
  return {
    name: mode,
    async startCheckout(req) {
      // Stripe-hosted Checkout. The order is only marked paid by the webhook (app/api/stripe/webhook).
      const { default: Stripe } = await import("stripe");
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      const account = mode === "connect" ? process.env.STRIPE_CONNECT_ACCOUNT_ID : undefined;
      const feeBps = Number(process.env.PLATFORM_FEE_BPS ?? 0);
      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: req.amountCents, product_data: { name: `Order #${req.orderNumber}` } } }],
          customer_email: req.customerEmail ?? undefined,
          success_url: req.successUrl,
          cancel_url: req.cancelUrl,
          metadata: { orderId: req.orderId },
          payment_intent_data: {
            metadata: { orderId: req.orderId },
            ...(account && feeBps ? { application_fee_amount: Math.round((req.amountCents * feeBps) / 10000) } : {}),
          },
        },
        account ? { stripeAccount: account } : undefined,
      );
      return { redirectUrl: session.url, ref: session.id };
    },
  };
}

/**
 * Stripe is used only when both the key and the webhook secret are set: without the webhook,
 * Stripe can't tell us an order was paid, so it would never reach the kitchen.
 */
export const stripeReady = () => !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET;

export function getPaymentProvider(): PaymentProvider {
  if (!stripeReady()) return demo;
  return stripeProvider(process.env.STRIPE_CONNECT_ACCOUNT_ID ? "connect" : "direct");
}
