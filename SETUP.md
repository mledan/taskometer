# Manual Setup Checklist

Everything you need to do **outside** the codebase. Each section is
independent — the app degrades gracefully when a section is skipped,
and the browser console will tell you what's missing on every page
load.

> **You don't have to do all of this.** The local solo product works
> with zero of these sections done. Each one unlocks a different
> capability: Stripe → billing, Clerk → accounts, Azure → community
> backend.

---

## 1 · Stripe — billing

### 1a. Create products and prices

Run once, locally, with your tetecare-account secret key in the shell:

```powershell
# PowerShell
$env:STRIPE_SECRET_KEY = "sk_test_..."   # or sk_live_ once you're sure
npm run setup:stripe
```

```bash
# bash
STRIPE_SECRET_KEY=sk_test_... npm run setup:stripe
```

The script is **idempotent** — re-running uses existing products via
`metadata.tk_id` instead of creating duplicates. It prints the four
env vars to paste into Vercel.

### 1b. Create the webhook endpoint

Stripe dashboard → **Developers → Webhooks → Add endpoint**.

| Field | Value |
|---|---|
| Endpoint URL | `https://taskometer.vercel.app/api/stripe-webhook` |
| Description | taskometer plan lifecycle |
| Events | `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed` |

After creating it, click **Reveal** on the signing secret (starts with
`whsec_…`) and copy it.

### 1c. Vercel env vars (Production)

Project Settings → Environment Variables. Add all of these:

| Variable | Source |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | from step 1b |
| `STRIPE_PRICE_PRO` | output of `npm run setup:stripe` |
| `STRIPE_PRICE_TEAM` | output of `npm run setup:stripe` |
| `VITE_STRIPE_PRICE_PRO` | same value as above |
| `VITE_STRIPE_PRICE_TEAM` | same value as above |
| `PUBLIC_BASE_URL` | `https://taskometer.vercel.app` |

Redeploy (Vercel → Deployments → ⋯ → Redeploy).

### 1d. Verify

- Open `/pricing` — Pro card now shows a working button
- Click **Upgrade to Pro** → Stripe-hosted checkout page loads
- Run a test card (`4242 4242 4242 4242`, any future date, any CVC)
- Vercel → Functions → /api/stripe-webhook → see a `plan-upgrade` log line

---

## 2 · Clerk — accounts

### 2a. Create the application

1. Sign up at https://clerk.com
2. Create application **taskometer**
3. **User & Authentication → Email, Phone, Username**:
   - Enable **Email address** as primary identifier
   - Enable **Email link** (magic link) sign-in
   - Disable everything else for v1 — fewer surfaces to harden
4. **Domains** → add both:
   - `https://taskometer.vercel.app`
   - `http://localhost:3000`
5. **API Keys** → copy:
   - Publishable key (`pk_test_…` / `pk_live_…`)
   - Secret key (`sk_test_…` / `sk_live_…`)

### 2b. Vercel env vars

| Variable | Value |
|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_…` from step 2a |
| `CLERK_SECRET_KEY` | `sk_…` from step 2a |

Redeploy.

### 2c. Verify

- Open `/pricing` while signed out → Pro CTA reads **"Sign in to upgrade"**
- Click it → Clerk's hosted modal opens
- Sign in with a magic link → CTA changes to **"Upgrade to Pro"**
- The check completed in step 1d still works, now attributed to your Clerk userId

---

## 3 · Azure — community backend (when you're ready)

Costs ~$0–10/month at low scale; ~$30–50/month at medium scale. Only
do this when you've decided to ship community sharing for real
(Tier 1, the full feature).

### 3a. Authenticate the right subscription

```bash
az login
az account list --query "[].{Name:name, Id:id}" -o table
```

Pick the subscription ID for "sub 2" — the one you DON'T want gex-bot
work running into. Export it for the rest of this section:

```bash
export TF_VAR_subscription_id="<sub-2-id>"
```

### 3b. Bootstrap the state backend (one-time per environment)

The Terraform state itself needs a place to live before any other
stack can use remote state. This is the only stack that runs with
local state, then forgets itself.

```bash
cd infra/bootstrap/backend
terraform init
TF_VAR_env=dev terraform apply
```

This creates `taskometer-tfstate-dev` resource group + storage
account. Repeat with `TF_VAR_env=prod` for prod.

### 3c. Apply the community stack

```bash
cd ../../envs/dev/community
terragrunt init
terragrunt plan       # always look at the plan
terragrunt apply
```

The output prints the Function App's hostname — copy it; the SPA
will need it to reach the API.

### 3d. Set a budget alert

Non-negotiable. Azure Portal → **Cost Management → Budgets → Add**.

| Field | Value |
|---|---|
| Amount | `25 USD` |
| Period | Monthly |
| Alert at | 80% |
| Notify | your email |

### 3e. (optional) GitHub Actions OIDC for CI applies

If you want CI to run `terragrunt apply` on workflow_dispatch:

1. Azure portal → **App Registrations → New** (call it `taskometer-ci-dev`)
2. The new app → **Certificates & secrets → Federated credentials → Add**
   - Issuer: `https://token.actions.githubusercontent.com`
   - Subject: `repo:mledan/taskometer:environment:dev`
3. Subscriptions → your sub → **Access control (IAM) → Add role assignment**
   - Role: Contributor
   - Scope: the `taskometer-dev-community-rg` resource group only (least privilege)
   - Member: the App Registration from step 1
4. GitHub → repo Settings → **Secrets and variables → Actions**:
   - `AZURE_CLIENT_ID` (App Registration's Application ID)
   - `AZURE_TENANT_ID` (Directory ID from the Azure tenant)
   - `AZURE_SUBSCRIPTION_ID`

The `infra` workflow now runs plans on PRs and applies on
manual dispatch.

### 3f. Verify

- `terragrunt output` in `infra/envs/dev/community` shows function app, cosmos endpoint, key vault URI
- Azure portal shows the resource group with all six resources
- Budget alert appears in Cost Management

---

## 5 · Azure Cosmos for community comments (cheapest cloud path)

This is the minimum cloud you need to make `/share` comments public.
No Functions, no Key Vault, no App Insights. Just one serverless
Cosmos account that the Vercel API routes talk to directly.

Cost at v1: **< $1/mo**. Cosmos serverless = $0 idle, ~$0.25 per 1M
RUs. Each comment write is ~5 RUs.

### 5a. Pick your subscription

```bash
az account set --subscription "Subscription 2"
# or by id:
az account set --subscription "5810fa50-29f6-46ec-a775-980b7437a275"
```

### 5b. Create the resource group + Cosmos

Cosmos account names are globally unique. The example uses
`taskometer-comments-<initials>`; pick something unique to you.

```bash
# 1. resource group
az group create \
  --name taskometer-comments-rg \
  --location eastus

# 2. cosmos account (serverless, single region, session consistency)
COSMOS_NAME="taskometer-comments-mle"   # change suffix to anything unique
az cosmosdb create \
  --name "$COSMOS_NAME" \
  --resource-group taskometer-comments-rg \
  --kind GlobalDocumentDB \
  --capabilities EnableServerless \
  --default-consistency-level Session \
  --locations regionName=eastus failoverPriority=0 isZoneRedundant=False

# 3. database
az cosmosdb sql database create \
  --account-name "$COSMOS_NAME" \
  --resource-group taskometer-comments-rg \
  --name taskometer

# 4. container, partitioned by /threadKey so each wheel's comments
#    live on one partition (cheap reads, cheap writes)
az cosmosdb sql container create \
  --account-name "$COSMOS_NAME" \
  --resource-group taskometer-comments-rg \
  --database-name taskometer \
  --name comments \
  --partition-key-path /threadKey
```

### 5c. Grab the credentials

```bash
# Endpoint
az cosmosdb show \
  --name "$COSMOS_NAME" \
  --resource-group taskometer-comments-rg \
  --query documentEndpoint -o tsv

# Primary key
az cosmosdb keys list \
  --name "$COSMOS_NAME" \
  --resource-group taskometer-comments-rg \
  --query primaryMasterKey -o tsv
```

### 5d. Vercel env vars

Project Settings → Environment Variables:

| Variable | Value |
|---|---|
| `COSMOS_ENDPOINT` | from step 5c (looks like `https://....documents.azure.com:443/`) |
| `COSMOS_KEY` | from step 5c (long base64 string) |
| `COSMOS_DATABASE` | `taskometer` (or whatever you called it) |
| `COSMOS_CONTAINER` | `comments` |

Redeploy.

### 5e. Verify

1. Open `/share#w=anything-decodable-for-the-test`
2. Comments section banner should read **"Comments are public — anyone with this share link sees the same thread."**
3. Post a comment. Open the same URL in a private window — your comment should appear.
4. Vercel → Functions → /api/comments logs show `comment-created` lines.

### 5f. Set the budget alert

Azure Portal → **Cost Management → Budgets → Add**. $10/month with
80% email alert. Cosmos serverless can't surprise-bill you anywhere
near that at v1, but the alert is cheap insurance.

### 5g. Provision the v2 API containers (Phase 2)

Once the comments container is up, run the helper script to add the
6 containers the v2 API uses. They live in the same Cosmos account
+ database as comments — no new resources, no new env vars.

```bash
COSMOS_NAME=<your account name from 5b> \
COSMOS_RG=taskometer-comments-rg \
bash scripts/setup-cosmos-v2.sh
```

This creates `blocks`, `recurring-blocks`, `routines`, `tasks`,
`day-assignments`, `exceptions` — all partitioned by `/ownerId` so
per-user reads are single-partition.

The v2 dispatcher (`api/_lib/repo/index.js`) auto-detects Cosmos
based on `COSMOS_ENDPOINT` + `COSMOS_KEY` already being set. Next
deploy, `/api/v2/health` returns `{ "repo": "cosmos" }` and data
persists across cold starts.

## 4 · Custom domain (optional)

Once Vercel deploy is stable:

1. Vercel → Project → **Settings → Domains** → add `taskometer.app`
2. Configure DNS at your registrar (Vercel shows the records)
3. Update `PUBLIC_BASE_URL` env var → redeploy
4. Update Clerk allowed domains → add the new host
5. Update Stripe webhook endpoint URL

---

## At-a-glance status

The app prints its config status to the browser DevTools console on
every load. Open `/app` (or any route), open the console, and look
for `[taskometer] startup config`. Anything yellow is a section above
that hasn't been completed.
