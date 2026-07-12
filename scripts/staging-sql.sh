#!/bin/bash
# psql -tAc-compatible wrapper over the Supabase Management API query endpoint.
# Used as the SQL fixture channel for hosted staging tests (service authority
# via the operator's CLI token — never shipped to browsers or CI).
# Usage: staging-sql.sh "<sql>"   (prints first column of each row, bare)
set -euo pipefail
: "${STAGING_PROJECT_REF:?}" "${SUPABASE_MGMT_TOKEN:?}"
BODY=$(python3 -c 'import json,sys; print(json.dumps({"query": sys.argv[1]}))' "$1")
curl -fsS -X POST "https://api.supabase.com/v1/projects/${STAGING_PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${SUPABASE_MGMT_TOKEN}" \
  -H "content-type: application/json" \
  -d "$BODY" | python3 -c '
import json, sys
rows = json.load(sys.stdin)
if isinstance(rows, list):
    for row in rows:
        if isinstance(row, dict) and row:
            print(next(iter(row.values())))
'
