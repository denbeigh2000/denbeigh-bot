"$WRANGLER_BIN" --version 2>&1 >/dev/null

COMPATIBILITY_DATE="2023-03-02"

ln -s $NODE_MODULES_PATH/node_modules node_modules

"$WRANGLER_BIN" \
    deploy \
    --compatibility-date "$COMPATIBILITY_DATE" \
    --name local-build \
    --compatibility-date 2023-03-02 \
    --minify \
    --dry-run \
    --outdir dist \
    src/index.ts

mkdir -p $out
mv dist/index.js dist/index.js.map $out/
