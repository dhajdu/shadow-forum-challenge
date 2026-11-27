#!/usr/bin/env bash
# Leak suite against LOCAL Supabase only (needs Docker: `supabase start`).
# Resets the local database to supabase/migrations, runs supabase/tests/leak.test.ts,
# and resets again afterwards so no test rows are left behind.
set -euo pipefail
cd "$(dirname "$0")/../.."

supabase status >/dev/null 2>&1 || supabase start
supabase db reset --local --no-seed

eval "$(supabase status -o env | sed -nE 's/^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=/LOCAL_\1=/p')"
case "$LOCAL_API_URL" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *) echo "refusing: $LOCAL_API_URL is not local" >&2; exit 1 ;;
esac

# Leave the shared local database clean for other sessions, pass or fail.
trap 'supabase db reset --local --no-seed >/dev/null 2>&1 || true' EXIT

NEXT_PUBLIC_SUPABASE_URL="$LOCAL_API_URL" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="$LOCAL_ANON_KEY" \
SUPABASE_SERVICE_ROLE_KEY="$LOCAL_SERVICE_ROLE_KEY" \
  npx tsx --test supabase/tests/leak.test.ts
