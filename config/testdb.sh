#!/usr/bin/env bash
set -euo pipefail

export DB_HOST=localhost
export DB_NAME=root
export DB_USER=root
export DB_PASS=justine@17
export DB_PORT=3306
export DB_SSL=false

# run the test script (assumes this script is run from server/config)
bun --watch test_db.ts