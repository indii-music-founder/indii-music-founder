# First-term prepaid pricing

Policy confirmed 2026-11-12: retain the current monthly base prices. Quarterly,
six-month and annual prepayments receive approximately 15%, 30% and 50% off the
first prepaid term, respectively. Subsequent terms renew at the undiscounted
monthly base multiplied by the term length. Totals are rounded to whole USD
before tax; displayed monthly equivalents are approximate. Monthly subscriptions
and existing subscription contracts are unchanged.

| Tier | Monthly | First quarter → renewal | First six months → renewal | First year → renewal |
| --- | ---: | ---: | ---: | ---: |
| Start | $22 | $56 → $66 | $92 → $132 | $132 → $264 |
| Build | $55 | $140 → $165 | $231 → $330 | $330 → $660 |
| Scale | $110 | $281 → $330 | $462 → $660 | $660 → $1,320 |

Scale's first year equals Build's undiscounted annual price. The previously
mentioned $528 was based on the old discounted Build annual total; it is not the
new Scale charge. The founder subsequently authorized consistent math using the
current monthly base prices.

## Stripe configuration before release

Updating code does not change Stripe's catalog. Configure the following in the
same Stripe account and mode as the deployed checkout function:

1. Each `STRIPE_PRICE_{START|BUILD|SCALE}_{QUARTERLY|SIX_MONTH|ANNUAL}` must reference
   an active USD, licensed, per-unit recurring price for the **renewal** amount
   above, not the introductory amount. Use month intervals of 3/6/12 or a one-year
   interval for annual prices. Never mutate existing subscriptions to migrate
   their contracts as part of this change.
2. Each `STRIPE_COUPON_{TIER}_{PERIOD}_INTRO` must reference a valid USD
   **amount-off** coupon with `duration: once`, with the amount below in cents.
   If product-restricted, it must cover the recurring price's product.

| Tier | QUARTERLY | SIX_MONTH | ANNUAL |
| --- | ---: | ---: | ---: |
| START | 1000 | 4000 | 13200 |
| BUILD | 2500 | 9900 | 33000 |
| SCALE | 4900 | 19800 | 66000 |

Checkout verifies the catalog against these amounts before creating a customer
or a payment session. Missing or stale configuration blocks checkout rather than
charging a different amount. Introductory coupons cannot be combined with
customer-entered promotion codes. The coupon applies to the first billed term
of a newly created prepaid subscription, including one that starts after a trial;
it does not discount later renewal invoices. This is a per-subscription offer,
not an account-lifetime redemption limit. Existing subscription changes continue
through their existing management path.

## Verification and release scope

- Public page: all cadence badges, first-term totals, approximate equivalents,
  renewal totals and tax/rounding disclosures.
- App and function pricing: matching introductory percentages, totals and regular
  renewal totals; legacy yearly alias carries the regular annual price.
- Checkout: reject mismatched price/currency/cadence and wrong or recurring coupons;
  apply the verified once-only coupon to the configured full-price recurring item.
- Structural tests cover those paths; they do not prove a live charge or renewal.
- Before enabling customer checkout, verify the real Stripe catalog, hosted
  checkout's first charge and renewal disclosure, and invoice behavior with an
  authorized genuine customer path. No purchase or deployment is authorized by
  this implementation record. Public beta checkout availability remains unchanged.
