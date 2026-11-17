#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
set -- go.mod main.go main_test.go Dockerfile compose.yaml .dockerignore .gitignore \
  .env.example LICENSE README.md DEPLOYMENT.md QA.md scripts/package-source.sh \
  web/app.js web/diagram.js web/style.css web/index.html web/favicon.svg \
  qa/config.cjs qa/e2e.cjs qa/layout.cjs qa/inspect.cjs qa/accessibility.cjs qa/gates.cjs \
  qa/river-detail.cjs qa/count-label.cjs
# Only include reviewed source files. Local settings, saved rivers, Git history,
# backups, and generated QA evidence must never enter the public download.
tar -czf web/river-source.tar.gz "$@"
