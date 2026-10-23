#!/usr/bin/env bash
# Runs the migration + flow tests against a throwaway local Postgres (with PostGIS).
# Usage: PGHOST=/path/to/socket PGPORT=5432 PGUSER=postgres supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
psql -X -q -c "drop database if exists af_test" -c "create database af_test"
psql -X -q -d af_test -v ON_ERROR_STOP=1 -f tests/supabase_stub.sql -f migrations/*.sql 2>&1 | grep -v -e wal_level -e HINT || true
psql -X -q -d af_test -v ON_ERROR_STOP=1 -f tests/flows.sql | grep -E "ok:|PASSED|ERROR" || true
