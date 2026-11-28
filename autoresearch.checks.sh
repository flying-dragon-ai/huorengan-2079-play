#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
npm run lint
npm test -- --reporter=dot
npm run build
npm run build:viewer
