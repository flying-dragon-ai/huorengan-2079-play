#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
node --check tools/qa/bench_mobile.mjs
node tools/qa/bench_mobile.mjs
