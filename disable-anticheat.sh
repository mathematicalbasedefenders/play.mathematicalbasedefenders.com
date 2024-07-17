#!/usr/bin/env bash
find ./server/src/anticheat -type f ! -name 'disabled-anticheat.ts' -delete
cp ./server/src/anticheat/disabled-anticheat.ts ./server/src/anticheat/anticheat.ts