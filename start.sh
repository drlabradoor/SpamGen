#!/bin/sh
# Container entry point. /app/data survives redeploys on bothost, assets/ does
# not keep runtime additions — so the banks are copied over once and then grow
# in data/. A later deploy never overwrites what the bot has collected.
mkdir -p data out
[ -d data/bank ]   || cp -r assets/bank   data/bank
[ -d data/status ] || cp -r assets/status data/status
exec node bot.js
