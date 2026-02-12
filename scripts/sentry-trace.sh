#!/usr/bin/env bash
# Fetch full trace data (spans + logs) from Sentry for a given trace ID.
# Output is written to .sentry-logs/<trace-id>.txt and the path is printed.
#
# Usage:
#   ./scripts/sentry-trace.sh <trace-id>
#   ./scripts/sentry-trace.sh <trace-id> --spans-only
#   ./scripts/sentry-trace.sh <trace-id> --logs-only
#   ./scripts/sentry-trace.sh <trace-id> --full          # no log truncation
#
# Requires:
#   - SENTRY_AUTH_TOKEN env var or ~/.sentryclirc with [auth] token=...
#   - curl, jq

set -euo pipefail

SENTRY_ORG="personal-dl4"
SENTRY_PROJECT="the-office"
SENTRY_PROJECT_ID="4510864889413632"
SENTRY_BASE="https://us.sentry.io/api/0"
MAX_LOG_CHARS=1024

# --- Auth ---
if [[ -z "${SENTRY_AUTH_TOKEN:-}" ]]; then
  if [[ -f "$HOME/.sentryclirc" ]]; then
    SENTRY_AUTH_TOKEN=$(grep '^token=' "$HOME/.sentryclirc" | cut -d= -f2)
  fi
fi

if [[ -z "${SENTRY_AUTH_TOKEN:-}" ]]; then
  echo "Error: No auth token. Set SENTRY_AUTH_TOKEN or run 'npx sentry-cli login'." >&2
  exit 1
fi

AUTH="Authorization: Bearer $SENTRY_AUTH_TOKEN"

# --- Args ---
TRACE_ID="${1:-}"
MODE="all"
TRUNCATE=true

shift || true
for arg in "$@"; do
  case "$arg" in
    --spans-only) MODE="spans" ;;
    --logs-only)  MODE="logs" ;;
    --full)       TRUNCATE=false ;;
  esac
done

if [[ -z "$TRACE_ID" ]]; then
  echo "Usage: $0 <trace-id> [--spans-only|--logs-only] [--full]" >&2
  exit 1
fi

# --- Output dir ---
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$REPO_ROOT/.sentry-logs"
mkdir -p "$OUT_DIR"
OUT_FILE="$OUT_DIR/$TRACE_ID.txt"

fetch() {
  curl -sf -H "$AUTH" "$1"
}

# --- Spans ---
print_spans() {
  echo "=== SPANS ==="
  echo ""

  local events
  events=$(fetch "$SENTRY_BASE/organizations/$SENTRY_ORG/events/?project=$SENTRY_PROJECT_ID&query=trace:$TRACE_ID&field=id&field=timestamp&field=transaction&field=event.type&per_page=50")

  local count
  count=$(echo "$events" | jq '.data | length')

  if [[ "$count" == "0" ]]; then
    echo "  (no transactions found)"
    return
  fi

  echo "$events" | jq -r '.data[] | "\(.id) \(.transaction)"' | while read -r eid txn; do
    local event
    event=$(fetch "$SENTRY_BASE/projects/$SENTRY_ORG/$SENTRY_PROJECT/events/$eid/")

    echo "--- $txn ---"
    echo "$event" | jq -r '
      .entries[] | select(.type == "spans") | .data | sort_by(.start_timestamp)[] |
      (.start_timestamp | floor | strftime("%H:%M:%S")) as $t |
      ((.start_timestamp - (.start_timestamp | floor)) * 1000 | floor | tostring | ("000" + .)[-3:]) as $ms |
      "  \($t).\($ms) | \(.op // "-") | \(.description // "-")"
    '
    echo ""
  done
}

# --- Logs ---
print_logs() {
  echo "=== LOGS ==="
  echo ""

  local logs
  logs=$(fetch "$SENTRY_BASE/organizations/$SENTRY_ORG/trace-logs/?dataset=ourlogs&field=timestamp_precise&field=severity&field=message&orderby=-timestamp&per_page=1000&project=-1&query=trace%3A$TRACE_ID&statsPeriod=14d&traceId=$TRACE_ID")

  local count
  count=$(echo "$logs" | jq '.data | length')

  if [[ "$count" == "0" ]]; then
    echo "  (no logs found)"
    return
  fi

  if [[ "$TRUNCATE" == "true" ]]; then
    echo "$logs" | jq -r --argjson max "$MAX_LOG_CHARS" '
      .data | sort_by(.timestamp_precise) | .[] |
      if (.message | length) > $max then
        "  \(.severity) | \(.message[:$max])… [truncated, use --full]"
      else
        "  \(.severity) | \(.message)"
      end
    '
  else
    echo "$logs" | jq -r '.data | sort_by(.timestamp_precise) | .[] | "  \(.severity) | \(.message)"'
  fi
}

# --- Main ---
{
  echo "Trace: $TRACE_ID"
  echo ""

  case "$MODE" in
    spans) print_spans ;;
    logs)  print_logs ;;
    *)     print_spans; print_logs ;;
  esac
} > "$OUT_FILE"

echo "$OUT_FILE"
