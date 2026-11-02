#!/usr/bin/env bash
# Monthly cost alert for the subscription (email only, it does not stop anything).
# Usage: BUDGET_EMAIL=you@example.com ./infra/azure/budget.sh
set -euo pipefail

BUDGET_NAME="${BUDGET_NAME:-murder-mystery-monthly}"
BUDGET_AMOUNT="${BUDGET_AMOUNT:-20}"              # in the subscription's billing currency
BUDGET_EMAIL="${BUDGET_EMAIL:?Set BUDGET_EMAIL}"
START_DATE="${START_DATE:-$(date +%Y-%m-01)}"
END_DATE="${END_DATE:-$(date -d '+1 year' +%Y-%m-01)}"

SUB_ID="$(az account show --query id -o tsv)"

notification() {  # name, threshold, type
  cat <<EOF
"$1": {
  "enabled": true, "operator": "GreaterThan", "threshold": $2,
  "thresholdType": "$3", "contactEmails": ["$BUDGET_EMAIL"]
}
EOF
}

az rest --method put \
  --url "https://management.azure.com/subscriptions/$SUB_ID/providers/Microsoft.Consumption/budgets/$BUDGET_NAME?api-version=2023-05-01" \
  --body "{
    \"properties\": {
      \"category\": \"Cost\",
      \"amount\": $BUDGET_AMOUNT,
      \"timeGrain\": \"Monthly\",
      \"timePeriod\": { \"startDate\": \"${START_DATE}T00:00:00Z\", \"endDate\": \"${END_DATE}T00:00:00Z\" },
      \"notifications\": {
        $(notification actual30 30 Actual),
        $(notification actual50 50 Actual),
        $(notification actual80 80 Actual),
        $(notification actual100 100 Actual),
        $(notification forecast100 100 Forecasted)
      }
    }
  }" --query "{name:name, amount:properties.amount, period:properties.timePeriod}" -o json
