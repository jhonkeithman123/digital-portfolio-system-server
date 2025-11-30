#!/usr/bin/env bash
set -euo pipefail

export DB_HOST=sql12.freesqldatabase.com
export DB_NAME=sql12809872
export DB_USER=sql12809872
export DB_PASS=AzhqdrTfsN
export DB_PORT=3306
export DB_SSL=false

# run the test script (assumes this script is run from server/config)
node ./test_db.js