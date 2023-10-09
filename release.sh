ENV="${1:-staging}"
TAG="${2:-}"

"$WRANGLER_BIN" --version 2>&1 >/dev/null

IDENTITY_FILE="${IDENTITY_FILE:-}"
if [[ -z "$IDENTITY_FILE" ]]
then
    IDENTITY_FILE="$(find "$HOME/.ssh" \( -name id_rsa -or -name id_ed25519 \))"
fi

if [[ $ENV != 'staging' ]] && [[ $ENV != 'production' ]]
then
    echo "Unknown env $ENV, choose one of (staging, production)" >&2
    exit 1
fi

# Expected vars:
#  - CLOUDFLARE_ACCOUNT_ID
#  - CLOUDFLARE_API_TOKEN
CLOUDFLARE_SECRETS_FILE="$("$GIT_BIN" ls-files ":/secrets/cf_authn.sh.age")"
CLOUDFLARE_ENV_FILE="$(mktemp)"
"$AGE_BIN" --decrypt --identity "$IDENTITY_FILE" --output "$CLOUDFLARE_ENV_FILE" "$CLOUDFLARE_SECRETS_FILE"

# Load our config directly from our encrypted config file
# This is passed in as a file later via a tempfile
WRANGLER_SECRETS_FILE="$("$GIT_BIN" ls-files ":/secrets/wrangler.toml.age")"
WRANGLER_TOML_FILE="$(mktemp)"
"$AGE_BIN" --decrypt --identity "$IDENTITY_FILE" --output "$WRANGLER_TOML_FILE" "$WRANGLER_SECRETS_FILE"

# Expected vars:
#  - SENTRY_AUTH_TOKEN
#  - SENTRY_PROJECT
#  - SENTRY_ORG
SENTRY_SECRET_FILE="$("$GIT_BIN" ls-files ":/secrets/sentry_authn.sh.age")"
SENTRY_ENV_FILE="$(mktemp)"
"$AGE_BIN" --decrypt --identity "$IDENTITY_FILE" --output "$SENTRY_ENV_FILE" "$SENTRY_SECRET_FILE"

source "$SENTRY_ENV_FILE"
source "$CLOUDFLARE_ENV_FILE"

if [[ "$ENV" = "production" ]]
then
    if ! echo "$TAG" | egrep '^v[0-9]+\.[0-9]+\.[0-9]+$'
    then
        echo "Tag $TAG not in expected format vX.Y.Z" >&2
        exit 1
    fi

    echo "{
  \"tag\": \"$TAG\"
}" > version.json

    "$GIT_BIN" add version.json
    "$GIT_BIN" commit -m "Created release $TAG"

    "$GIT_BIN" tag "$TAG"
    COMMIT="$("$GIT_BIN" rev-parse $TAG)"

    "$SENTRY_BIN" \
        releases \
        --org "$SENTRY_ORG" \
        --project "$SENTRY_PROJECT" \
         new \
        "$TAG"

    "$SENTRY_BIN" \
        releases \
        --org "$SENTRY_ORG" \
        --project "$SENTRY_PROJECT" \
        set-commits \
        --commit "origin@$COMMIT" \
        "$TAG"
elif [[ -z "$ENV" ]]
then
    ENV="dev"
fi

ln -sf "$WRANGLER_TOML_FILE" wrangler.toml

"$WRANGLER_BIN" publish \
    --env "$ENV" \
    --no-bundle \
    $BUNDLED_WORKER_PATH/index.js

if [[ "$ENV" = "production" ]]
then
    "$SENTRY_BIN" \
        releases \
        --org "$SENTRY_ORG" \
        --project "$SENTRY_PROJECT" \
        files "$TAG" \
        upload-sourcemaps \
        --bundle $BUNDLED_WORKER_PATH/index.js \
        --bundle-sourcemap $BUNDLED_WORKER_PATH/index.js.map
fi
