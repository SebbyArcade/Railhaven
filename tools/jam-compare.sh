#!/bin/sh
# Runs tools/jam-run.ts on several saves in parallel. Usage: sh tools/jam-compare.sh label minutes
# Writes one line per save to /tmp/jam-<label>.txt
L=${1:-x}; M=${2:-15}; OUT=${JAMOUT:-/tmp}/jam-$L.txt; : > $OUT
for f in save-seb-2026-11-15.json:0:0 save-seb-2026-11-14.json:0:0 save-seb-2026-11-14-live.json:0:0 save-seb-2026-11-11.json:0:0 save-seb-2026-11-15.json:1:6; do
  s=${f%%:*}; r=${f#*:}; d=${r%%:*}; w=${r#*:}
  (timeout 900 npx vite-node tools/jam-run.ts tests/saves/$s $M $d $w 2>&1 | grep held | head -1 >> $OUT) &
done
wait; cat $OUT
