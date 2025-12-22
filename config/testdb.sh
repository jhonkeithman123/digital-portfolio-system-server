#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export DB_HOST=localhost
export DB_NAME=digital_portfolio_system
export DB_USER=root
export DB_PASS=justine@17
export DB_PORT=3306
export DB_SSL=false

echo "Resolved script dir: $SCRIPT_DIR"

# run the test script (assumes this script is run from server/config)
bun run "$SCRIPT_DIR/test_db.ts"