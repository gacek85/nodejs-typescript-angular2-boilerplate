#!/usr/bin/env sh
cd "$(dirname "$0")"

echo "Compiling application..."

node ../node_modules/gulp/bin/gulp compile-app