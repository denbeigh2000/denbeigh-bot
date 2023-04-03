"$WRANGLER_BIN" --version 2>&1 >/dev/null

WRANGLER_TOML="$(mktemp)"
echo "$STUB_WRANGLER_TOML" > "$WRANGLER_TOML"

ln -s $NODE_MODULES_PATH/node_modules node_modules

"$WRANGLER_BIN" publish \
    --name local-build \
    --config "$WRANGLER_TOML" \
    --minify \
    --dry-run \
    --outdir dist \
    src/index.ts

mkdir -p $out
mv dist/index.js dist/index.js.map $out/
