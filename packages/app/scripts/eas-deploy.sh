#!/usr/bin/env bash
# Ships main to iOS users: an EAS Update when a finished production build has
# the same native fingerprint, otherwise a store build + auto-submit.
#
#   eas-deploy.sh predict   print the fingerprint and what deploy would do
#   eas-deploy.sh deploy    do it (eas.yml, on push to main)
#
# An update is published only to a runtime that a FINISHED production build
# has, so a fingerprint mismatch can only cost an extra build, never ship JS to
# a binary with different native code. Any tooling error fails the run; it never
# falls through to a publish or a submit.
set -euo pipefail

mode="${1:-}"
if [[ "$mode" != "predict" && "$mode" != "deploy" ]]; then
  echo "usage: $0 <predict|deploy>" >&2
  exit 2
fi

cd "$(dirname "$0")/.."

readonly PROD_API_URL="https://www.soberjourney.app"

# `eas update` evaluates app.config.ts with expo's development default for
# NODE_ENV, which resolves extra.apiUrl to localhost. APP_VARIANT pins the
# production API for everything this script evaluates. The fingerprint ignores
# `extra` (fingerprint.config.js), so this does not change the runtime hash.
export APP_VARIANT=production

fingerprint() {
  eas fingerprint:generate --platform ios --build-profile "$1" --json --non-interactive |
    jq -er '.hash'
}

prod_hash="$(fingerprint production)"
echo "iOS production fingerprint: $prod_hash"

if [[ "$mode" == "predict" ]]; then
  # Same native inputs as production (fingerprint.config.js skips `extra`);
  # compared against the PR's EAS development build to prove CI/EAS parity.
  dev_hash="$(fingerprint development)"
  echo "iOS development fingerprint: $dev_hash"
fi

builds="$(eas build:list --platform ios --build-profile production \
  --fingerprint-hash "$prod_hash" --status finished --limit 10 \
  --json --non-interactive)"
build_ids="$(jq -er 'map(.id) | join(" ")' <<<"$builds")"

if [[ -n "$build_ids" ]]; then
  decision="update"
  echo "Finished production builds with this fingerprint: $build_ids"
else
  decision="build"
  echo "No finished production build has this fingerprint."
fi
echo "Decision: $decision"

if [[ "$mode" == "predict" ]]; then
  exit 0
fi

if [[ "$decision" == "build" ]]; then
  npm run eas:submit
  exit 0
fi

# Evaluated the same way `eas update` evaluates it for the update's manifest.
api_url="$(npx expo config --type public --json | jq -er '.extra.apiUrl')"
if [[ "$api_url" != "$PROD_API_URL" ]]; then
  echo "Refusing to publish: extra.apiUrl is $api_url, expected $PROD_API_URL" >&2
  exit 1
fi

message="$(git log -1 --format='%s (%h)')"
result="$(eas update --channel production --platform ios --environment production \
  --message="$message" --json --non-interactive)"
echo "$result"

published_runtime="$(jq -er '[.[].runtimeVersion] | unique | join(" ")' <<<"$result")"
if [[ "$published_runtime" != "$prod_hash" ]]; then
  echo "Published runtimeVersion $published_runtime does not match the build fingerprint $prod_hash; no build can receive this update" >&2
  exit 1
fi

# Read the API URL back from what devices will actually download. The update is
# already live here, so any failure must still print how to roll it back.
group_id="$(jq -er '.[0].group' <<<"$result")"
permalink="$(jq -er '.[0].manifestPermalink' <<<"$result")"
manifest_api_url="$(curl -fsS --retry 3 --retry-all-errors -H 'expo-platform: ios' \
  -H 'expo-protocol-version: 1' -H "expo-runtime-version: $prod_hash" \
  -H 'accept: multipart/mixed' "$permalink" |
  grep -o '"apiUrl": *"[^"]*"' | head -1 | sed -E 's/.*"([^"]*)"$/\1/' || true)"
if [[ "$manifest_api_url" != "$PROD_API_URL" ]]; then
  echo "Published update group $group_id has extra.apiUrl '$manifest_api_url'; roll it back now: eas update:rollback $group_id" >&2
  exit 1
fi
echo "Published update group $group_id for runtime $prod_hash (apiUrl $manifest_api_url)"
