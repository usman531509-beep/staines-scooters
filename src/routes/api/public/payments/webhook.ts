import { createFileRoute } from '@tanstack/react-router';
import { type StripeEnv, verifyWebhook, createStripeClient } from '@/lib/stripe.server';
import { onlinePaymentsEnabled } from '@/lib/online-payments';

/** Store the card used (or set up) on a rental so staff can charge future weekly rent to it. */
async function storeRentalCard(session: any, env: StripeEnv, rentalId: string) {
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const stripe = createStripeClient(env);
    let paymentMethodId: string | null = null;
    if (session.mode === 'setup') {
      const siId = typeof session.setup_intent === 'string' ? session.setup_intent : session.setup_intent?.id;
      if (!siId) return;
      const si = await stripe.setupIntents.retrieve(siId);
      paymentMethodId = typeof si.payment_method === 'string' ? si.payment_method : si.payment_method?.id ?? null;
    } else {
      const piId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
      if (!piId) return;
      const pi = await stripe.paymentIntents.retrieve(piId);
      paymentMethodId = typeof pi.payment_method === 'string' ? pi.payment_method : (pi.payment_method as any)?.id ?? null;
    }
    if (!paymentMethodId) return;
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (customerId && (pm as any).customer !== customerId) {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    }
    const card: any = (pm as any).card ?? {};
    await supabaseAdmin
      .from('rentals')
      .update({
        ...(customerId && { stripe_customer_id: customerId }),
        default_payment_method_id: paymentMethodId,
        card_brand: card.brand ?? null,
        card_last4: card.last4 ?? null,
        card_exp_month: card.exp_month ?? null,
        card_exp_year: card.exp_year ?? null,
        card_updated_at: new Date().toISOString(),
      })
      .eq('id', rentalId);
  } catch (e) {
    console.error('storeRentalCard failed', e);
  }
}

async function handleArrearsPlan(session: any, env: StripeEnv) {
  const planId = session?.metadata?.arrearsPlanId as string | undefined;
  if (!planId) return false;
  const ids = String(session?.metadata?.installmentIds ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const { storePlanCard, settlePlanInstallments } = await import('@/lib/arrears-pay.server');
  await storePlanCard(session, env, planId);
  if (ids.length) {
    await settlePlanInstallments(planId, ids, {
      sessionId: session.id,
      paymentIntent: typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
    });
  }
  return true;
}

async function handleRental(session: any, env: StripeEnv) {
  const kind = session?.metadata?.rentalKind as string | undefined;
  if (kind === 'arrears_plan') return handleArrearsPlan(session, env);
  if (!kind || !kind.startsWith('rental_')) return false;

  if (kind === 'rental_card_setup') {
    const rentalId = session.metadata?.rentalId as string;
    if (rentalId) await storeRentalCard(session, env, rentalId);
    return true;
  }

  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const nowIso = new Date().toISOString();
  const rentalId = session.metadata?.rentalId as string | undefined;
  const amount = session.amount_total as number | undefined;
  if (kind === 'rental_weekly') {
    const weekId = session.metadata?.weekId as string;
    const { data: wk } = await supabaseAdmin.from('rental_weeks').select('*').eq('id', weekId).maybeSingle();
    if (!wk || wk.status === 'paid') return true;
    await supabaseAdmin.from('rental_weeks').update({ status: 'paid', paid_at: nowIso, stripe_session_id: session.id }).eq('id', weekId);
    await supabaseAdmin.from('rental_payments').insert({
      rental_id: wk.rental_id, week_id: weekId, amount_pence: wk.amount_pence,
      kind: 'weekly', method: 'stripe', stripe_session_id: session.id, paid_at: nowIso,
    });
  } else if (kind === 'rental_weekly_bulk' && rentalId) {
    // One payment covering every outstanding week in the window the customer paid for.
    const weekFrom = session.metadata?.weekFrom as string | undefined;
    const weekTo = session.metadata?.weekTo as string | undefined;
    let q = supabaseAdmin
      .from('rental_weeks')
      .select('*')
      .eq('rental_id', rentalId)
      .eq('status', 'unpaid')
      .is('deleted_at', null);
    if (weekFrom) q = q.gte('week_start', weekFrom);
    if (weekTo) q = q.lte('week_start', weekTo);
    const { data: weeks } = await q.order('week_start');
    const list = (weeks ?? []) as any[];
    // Fall back to amount-based allocation only for legacy sessions with no window.
    let remaining = amount ?? 0;
    const useWindow = Boolean(weekFrom && weekTo);
    for (const wk of list) {

      if (!useWindow) {
        if (remaining < (wk.amount_pence ?? 0)) break;
        remaining -= wk.amount_pence ?? 0;
      }
      await supabaseAdmin.from('rental_weeks').update({ status: 'paid', paid_at: nowIso, stripe_session_id: session.id }).eq('id', wk.id);
      await supabaseAdmin.from('rental_payments').insert({
        rental_id: rentalId, week_id: wk.id, amount_pence: wk.amount_pence,
        kind: 'weekly', method: 'stripe', stripe_session_id: session.id, paid_at: nowIso,
      });
    }

  } else if (kind === 'rental_deposit' && rentalId) {
    const { data: r } = await supabaseAdmin.from('rentals').select('deposit_paid_pence').eq('id', rentalId).maybeSingle();
    await supabaseAdmin.from('rental_payments').insert({
      rental_id: rentalId, amount_pence: amount ?? 0,
      kind: 'deposit', method: 'stripe', stripe_session_id: session.id, paid_at: nowIso,
    });
    await supabaseAdmin.from('rentals').update({ deposit_paid_pence: (r?.deposit_paid_pence ?? 0) + (amount ?? 0) }).eq('id', rentalId);
  } else if (kind === 'rental_pcn' && rentalId) {
    const pcnId = session.metadata?.pcnId as string;
    await supabaseAdmin.from('rental_pcns').update({ status: 'paid' }).eq('id', pcnId);
    await supabaseAdmin.from('rental_payments').insert({
      rental_id: rentalId, pcn_id: pcnId, amount_pence: amount ?? 0,
      kind: 'pcn', method: 'stripe', stripe_session_id: session.id, paid_at: nowIso,
    });
  }
  // Store the card used so staff can charge future weekly rent to it.
  if (rentalId && session.metadata?.saveCard === '1') {
    await storeRentalCard(session, env, rentalId);
  }
  return true;
}

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  // Apple Pay / delayed methods can complete the sheet while the payment is
  // still unpaid — never settle anything until Stripe confirms the money.
  if (session?.payment_status === 'unpaid') return;
  if (session?.metadata?.financeAgreementId) {
    const agreementId = session.metadata.financeAgreementId as string;
    const fsb = (await import('@/integrations/supabase/client.server')).supabaseAdmin as any;
    let ids = String(session.metadata.financeInstalmentIds ?? '').split(',').map((s: string) => s.trim()).filter(Boolean);
    if (session.metadata.financeAll === '1') {
      const { data: due } = await fsb.from('finance_instalments').select('id').eq('agreement_id', agreementId).eq('status', 'due');
      ids = ((due ?? []) as any[]).map((d) => d.id);
    }
    const { settleFinanceInstalments } = await import('@/lib/finance.server');
    await settleFinanceInstalments(ids, {
      method: 'card',
      paymentIntent: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null,
    });
    return;
  }
  await handleRental(session, env);
}

export const Route = createFileRoute('/api/public/payments/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!onlinePaymentsEnabled()) return new Response('Online payments are disabled', { status: 503 });
        const rawEnv = new URL(request.url).searchParams.get('env');
        if (rawEnv !== 'sandbox' && rawEnv !== 'live') {
          return Response.json({ received: true, ignored: 'invalid env' });
        }
        const env: StripeEnv = rawEnv;
        try {
          const event = await verifyWebhook(request, env);
          switch (event.type) {
            case 'checkout.session.completed':
            case 'checkout.session.async_payment_succeeded':
              await handleCheckoutCompleted(event.data.object, env);
              break;
            default:
              // Ignore other events silently.
              break;
          }
          return Response.json({ received: true });
        } catch (e) {
          console.error('payments webhook error', e);
          return new Response('Webhook error', { status: 400 });
        }
      },
    },
  },
});
