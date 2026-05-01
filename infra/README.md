# taskometer · infrastructure

Terragrunt + Azure. Provisions the **community backend** stack:
Azure Functions API, Cosmos DB serverless, Application Insights,
Key Vault. The frontend stays on Vercel.

## Layout

```
infra/
├─ terragrunt.hcl              # root: providers, remote state, common inputs
├─ envs/
│  ├─ dev/  env.hcl  community/terragrunt.hcl
│  └─ prod/ env.hcl  community/terragrunt.hcl
├─ modules/community/          # the actual Terraform module
└─ bootstrap/backend/          # one-time: creates the tfstate storage account
```

## One-time setup (per environment)

You need:

- `terraform >= 1.6` and `terragrunt >= 0.55` on PATH
- Azure CLI authenticated against the subscription you want to use
- The subscription id available — exported as `TF_VAR_subscription_id`

### 1. Bootstrap the state backend

The state backend itself can't live in remote state. Bootstrap it once
with local state, then forget it:

```bash
export TF_VAR_subscription_id="<your-subscription-id>"
cd infra/bootstrap/backend
terraform init
TF_VAR_env=dev terraform apply
```

This creates `taskometer-tfstate-dev` resource group and a storage
account inside it. The names match what `envs/dev/env.hcl` references.

Repeat for `prod` if you want a separate prod environment.

### 2. Apply the community stack

```bash
export TF_VAR_subscription_id="<your-subscription-id>"
cd infra/envs/dev/community
terragrunt init
terragrunt plan
terragrunt apply
```

## Cost estimate (low scale)

| Resource | At v1 traffic | At medium scale |
|---|---|---|
| Cosmos DB serverless | $0–5/mo | $20/mo |
| Functions consumption | $0 | $5–10 |
| Storage + App Insights | ~$1 | ~$5 |
| Key Vault | $0 | $0 |
| **Total** | **~$0–10/mo** | **~$30–50/mo** |

Set a budget alert in the portal as soon as you apply: `Cost Management
→ Budgets → New budget` with a `$25` monthly threshold and email
notification at 80%.

## Tearing down

```bash
cd infra/envs/dev/community
terragrunt destroy
```

The bootstrap backend is **not** destroyed by the regular `destroy` —
it lives separately. To wipe an environment entirely:

```bash
cd infra/bootstrap/backend
TF_VAR_env=dev terraform destroy
```

## Stripe environment variables

Billing is handled by Stripe. Nothing about Stripe is provisioned in
Terragrunt (Stripe is its own SaaS), but the API endpoints in
`api/checkout-session.js` and `api/stripe-webhook.js` require these
variables in the Vercel project settings:

| Variable | Where | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | Vercel runtime env (server) | `sk_live_...` or `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Vercel runtime env (server) | `whsec_...` from the Stripe webhook config |
| `STRIPE_PRICE_PRO` | Vercel runtime env (server) | `price_...` for the monthly Pro plan |
| `STRIPE_PRICE_TEAM` | Vercel runtime env (server) | `price_...` for the seat-priced Team plan |
| `VITE_STRIPE_PRICE_PRO` | Vercel runtime env (build) | Same as above; surfaced to the SPA so it knows checkout is wired |
| `VITE_STRIPE_PRICE_TEAM` | Vercel runtime env (build) | Same |
| `PUBLIC_BASE_URL` | Vercel runtime env (server) | e.g. `https://taskometer.vercel.app` — used in checkout success/cancel URLs |

Webhook configuration in the Stripe dashboard:

1. Add an endpoint pointing at `https://<your-host>/api/stripe-webhook`.
2. Subscribe to: `checkout.session.completed`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.payment_failed`.
3. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

If none of these are set the pricing page falls back to a friendly
"email us when you launch this" mailto on the paid CTAs. Production
won't have dead buttons.

## Conventions

- Subscription ids are never committed. They're passed via
  `TF_VAR_subscription_id` (env var) or set in the GitHub Actions
  secret store.
- Region defaults to `eastus`. Change in `env.hcl` if you need a
  different one — the whole stack moves together.
- Naming: `taskometer-<env>-<role>`. Globally-unique resources
  (storage, Cosmos) get a 6-char random suffix appended.
- Tags on every resource: `project`, `environment`, `managed_by`.
  Helpful when you're hunting cost in the portal.

## When backend ships, what changes in the SPA

The SPA's `api/*` calls flip from `/api/*` (Vercel functions) to the
Function App's hostname:

```js
const API_BASE = import.meta.env.PROD
  ? 'https://taskometer-prod-community-api-<suffix>.azurewebsites.net'
  : 'http://localhost:7071';
```

Once a custom domain is wired (e.g., `api.taskometer.app`), update the
CORS allowlist in `envs/prod/community/terragrunt.hcl` and the SPA's
`API_BASE`.
