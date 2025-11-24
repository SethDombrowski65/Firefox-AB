#!/bin/bash
cd "$(dirname "$0")"
export PLAYWRIGHT_BROWSERS_PATH="$(pwd)/browsers"
./browser-manager
