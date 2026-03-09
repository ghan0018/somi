#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Runs the full test suite at every configured viewport width, then prints a
# combined summary so failures at any width are clearly visible.
# ---------------------------------------------------------------------------
set -o pipefail

VIEWPORTS=("1280:desktop" "375:mobile")
PASS=0
FAIL=0
SUMMARIES=""
EXIT_CODE=0

for entry in "${VIEWPORTS[@]}"; do
  WIDTH="${entry%%:*}"
  LABEL="${entry##*:}"

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Running tests @ ${LABEL} (${WIDTH}px)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  OUTPUT=$(VIEWPORT_WIDTH="$WIDTH" npx vitest run 2>&1)
  CODE=$?

  echo "$OUTPUT"

  # Extract the "Tests" summary line from vitest output
  RESULT_LINE=$(echo "$OUTPUT" | grep -E "^\s*Tests\s+" | tail -1)

  if [ $CODE -eq 0 ]; then
    SUMMARIES+="  ✅  ${LABEL} (${WIDTH}px): ${RESULT_LINE}\n"
    PASS=$((PASS + 1))
  else
    SUMMARIES+="  ❌  ${LABEL} (${WIDTH}px): ${RESULT_LINE}\n"
    FAIL=$((FAIL + 1))
    EXIT_CODE=1
  fi
done

# ---------------------------------------------------------------------------
# Combined summary
# ---------------------------------------------------------------------------
echo ""
echo ""
echo "┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓"
echo "┃                    ALL VIEWPORT RESULTS                       ┃"
echo "┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛"
echo ""
echo -e "$SUMMARIES"

TOTAL=$((PASS + FAIL))
if [ $EXIT_CODE -eq 0 ]; then
  echo "  All ${TOTAL} viewport(s) passed."
else
  echo "  ${FAIL} of ${TOTAL} viewport(s) FAILED."
fi

echo ""
exit $EXIT_CODE
