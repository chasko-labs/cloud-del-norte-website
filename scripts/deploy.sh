#!/usr/bin/env bash
# deploy cloud-del-norte sites to s3 and invalidate cloudfront. replaces the retired codepipeline buildspec.yml
# usage: scripts/deploy.sh [main|auth|awsug|dev|quantum|all] [--dry-run | --apply] [--check-remote]
# default is --dry-run, which makes no aws calls. --check-remote adds read-only aws calls (bucket region, delete preview)
# every --delete sync is previewed with --dryrun before any upload. MAX_DELETES (default 25) caps total deletes per bucket across all passes, ALLOW_DELETES=1 overrides
set -euo pipefail

PROFILE="aerospaceug-admin"
ALL_TARGETS=(main auth awsug dev quantum)

usage() {
	echo "usage: $0 [main|auth|awsug|dev|quantum|all] [--dry-run | --apply] [--check-remote]" >&2
	exit 2
}

mode="dry-run"
check_remote=0
targets=()
for arg in "$@"; do
	case "$arg" in
	--dry-run) mode="dry-run" ;;
	--apply) mode="apply" ;;
	--check-remote) check_remote=1 ;;
	all) targets=("${ALL_TARGETS[@]}") ;;
	main | auth | awsug | dev | quantum) targets+=("$arg") ;;
	*) usage ;;
	esac
done
if [ "${#targets[@]}" -eq 0 ]; then
	targets=("${ALL_TARGETS[@]}")
fi

MAX_DELETES="${MAX_DELETES:-25}"
if ! [[ "$MAX_DELETES" =~ ^[0-9]{1,9}$ ]]; then
	echo "MAX_DELETES must be a non-negative integer (up to 9 digits), got: ${MAX_DELETES}" >&2
	exit 2
fi

cd "$(dirname "${BASH_SOURCE[0]}")/.."
REPO_ROOT="$(pwd)"

# one row per bucket and distribution pair. region verified with s3api get-bucket-location
load_target() {
	TARGET="$1"
	case "$1" in
	main)
		BUCKET="clouddelnorte.org"
		DIST="ECC3LP1BL2CZS"
		LIB_PATH="${REPO_ROOT}/lib"
		REGION="us-east-1"
		VERIFY_URL="https://clouddelnorte.org/"
		VERIFY_EXPECT="AWS UG Cloud del Norte"
		;;
	auth)
		BUCKET="auth.clouddelnorte.org"
		DIST="ECQ44FO9MBTCY"
		LIB_PATH="${REPO_ROOT}/lib-auth"
		REGION="us-east-1"
		VERIFY_URL="https://auth.clouddelnorte.org/login/index.html"
		VERIFY_EXPECT="Sign in"
		;;
	awsug)
		BUCKET="awsug.clouddelnorte.org"
		DIST="E2QLAWFVIT1AR8"
		LIB_PATH="${REPO_ROOT}/lib-awsug"
		REGION="us-east-1"
		VERIFY_URL="https://awsug.clouddelnorte.org/"
		VERIFY_EXPECT="Cloud del Norte"
		;;
	dev)
		BUCKET="dev.clouddelnorte.org"
		DIST="EEHVTUEQ97V0X"
		LIB_PATH="${REPO_ROOT}/lib"
		REGION="us-east-1"
		VERIFY_URL=""
		VERIFY_EXPECT=""
		;;
	quantum)
		BUCKET="quantum.clouddelnorte.org"
		DIST="EXLFK7JNU2JNM"
		LIB_PATH="${REPO_ROOT}/lib-quantum"
		REGION="us-west-2"
		VERIFY_URL="https://quantum.clouddelnorte.org/"
		VERIFY_EXPECT="Amazon Braket Workshop"
		;;
	*)
		usage
		;;
	esac
}

# excludes from the retired deploy-manual.sh main pass. liora/, screenshots/, quantum/, _previews/ must never be deleted by a site sync
SITE_EXCLUDES=(
	--exclude 'assets/*'
	--exclude 'events/*'
	--exclude 'brand/*'
	--exclude 'icons/*'
	--exclude 'data/*'
	--exclude 'liora/*'
	--exclude 'liora-embed/*'
	--exclude 'fiona/*'
	--exclude 'fiona-embed/*'
	--exclude 'screenshots/*'
	--exclude 'quantum/*'
	--exclude '_previews/*'
)

run() {
	if [ "$mode" = "apply" ]; then
		"$@"
	else
		printf 'dry-run:'
		printf ' %q' "$@"
		printf '\n'
	fi
}

# previews one --delete sync with --dryrun and adds its delete count to GUARD_TOTAL. guard_target compares the bucket total
guard_deletes() {
	local preview deletes count
	if ! preview="$(aws "$@" --dryrun --profile "$PROFILE" --region "$REGION")"; then
		echo "delete guard: aws s3 sync --dryrun failed for ${BUCKET}. a site sync needs a local build (npm run build), or use --apply" >&2
		exit 1
	fi
	deletes="$(grep -E '(^|[[:space:]])delete:' <<<"$preview" || true)"
	count=0
	if [ -n "$deletes" ]; then
		count="$(grep -c . <<<"$deletes")"
		echo "$deletes"
	fi
	GUARD_TOTAL=$((GUARD_TOTAL + count))
}

# runs every guard pass for one bucket, then checks the summed count. exits 1 above the limit
guard_target() {
	GUARD_TOTAL=0
	sync_target guard
	echo "delete guard: ${GUARD_TOTAL} delete(s) in ${BUCKET}, limit ${MAX_DELETES}"
	if [ "$GUARD_TOTAL" -gt "$MAX_DELETES" ] && [ "${ALLOW_DELETES:-0}" != "1" ]; then
		echo "delete guard: ${GUARD_TOTAL} deletes exceeds MAX_DELETES=${MAX_DELETES} in ${BUCKET}, aborting. set ALLOW_DELETES=1 to override" >&2
		exit 1
	fi
}

# checks the bucket region matches REGION. a mismatch is a bad load_target row, so it fails the run
region_check() {
	local loc
	if ! loc="$(aws s3api get-bucket-location --bucket "$BUCKET" \
		--query LocationConstraint --output text \
		--profile "$PROFILE" --region "$REGION")"; then
		echo "region check: get-bucket-location failed for ${BUCKET}" >&2
		exit 1
	fi
	case "$loc" in
	None | null | "") loc="us-east-1" ;;
	esac
	if [ "$loc" != "$REGION" ]; then
		echo "region check: ${BUCKET} is in ${loc} but REGION=${REGION}, aborting" >&2
		exit 1
	fi
	echo "region check: ${BUCKET} is in ${loc}, matches REGION=${REGION}"
}

# one --delete pass. guard previews it, run uploads it
sync_pass() { # $1 guard|run, $2 label, $3 source, $4 destination, $5 cache-control, rest extra flags
	local action="$1" label="$2" src="$3" dst="$4" cache="$5"
	shift 5
	if [ "$action" = "guard" ]; then
		guard_deletes s3 sync "$src" "$dst" --delete "$@"
	else
		echo "$label"
		run aws s3 sync "$src" "$dst" --delete "$@" --cache-control "$cache" \
			--profile "$PROFILE" --region "$REGION"
	fi
}

site_sync() { # $1 guard|run
	local action="$1" dst="s3://${BUCKET}/"
	sync_pass "$action" "pass 1/4: app shell (no-cache)" \
		"${LIB_PATH}/" "$dst" "no-cache" "${SITE_EXCLUDES[@]}"

	if [ -d "${LIB_PATH}/events" ]; then
		sync_pass "$action" "pass 2/4: events (24h)" \
			"${LIB_PATH}/events/" "${dst}events/" "public, max-age=86400, must-revalidate"
	fi
	if [ -d "${LIB_PATH}/brand" ]; then
		sync_pass "$action" "pass 2/4: brand (24h)" \
			"${LIB_PATH}/brand/" "${dst}brand/" "public, max-age=86400, must-revalidate"
	fi
	if [ -d "${LIB_PATH}/icons" ]; then
		sync_pass "$action" "pass 2/4: icons (24h)" \
			"${LIB_PATH}/icons/" "${dst}icons/" "public, max-age=86400, must-revalidate"
	fi
	if [ -d "${LIB_PATH}/data" ]; then
		sync_pass "$action" "pass 3/4: data feeds (5min)" \
			"${LIB_PATH}/data/" "${dst}data/" "public, max-age=300, must-revalidate"
	fi
	if [ -d "${LIB_PATH}/assets" ]; then
		sync_pass "$action" "pass 4/4: hashed bundles (immutable, 1y)" \
			"${LIB_PATH}/assets/" "${dst}assets/" "public, max-age=31536000, immutable"
	fi

	if [ "$action" = "run" ] && [ "$TARGET" = "awsug" ]; then
		echo "awsug: copying fiona vendor assets from main bucket"
		run aws s3 sync "s3://clouddelnorte.org/fiona-embed/" "s3://${BUCKET}/fiona-embed/" \
			--profile "$PROFILE" --region "$REGION"
		run aws s3 sync "s3://clouddelnorte.org/fiona/" "s3://${BUCKET}/fiona/" \
			--profile "$PROFILE" --region "$REGION"
	fi
}

quantum_sync() { # $1 guard|run
	if [ "$1" = "guard" ]; then
		guard_deletes s3 sync "${LIB_PATH}/" "s3://${BUCKET}/" --delete --exact-timestamps
	else
		echo "quantum: syncing ${LIB_PATH}/ to s3://${BUCKET}/"
		run aws s3 sync "${LIB_PATH}/" "s3://${BUCKET}/" --delete --exact-timestamps \
			--profile "$PROFILE" --region "$REGION"
	fi
}

sync_target() { # $1 guard|run
	if [ "$TARGET" = "quantum" ]; then
		quantum_sync "$1"
	else
		site_sync "$1"
	fi
}

# fails on a missing or incomplete build. dry-run without a build skips the check
validate_output() {
	if [ ! -d "$LIB_PATH" ]; then
		if [ "$mode" = "apply" ]; then
			echo "ERROR: ${LIB_PATH} missing after build" >&2
			exit 1
		fi
		echo "dry-run: ${LIB_PATH} not built, output checks skipped"
		return 0
	fi
	if [ ! -f "${LIB_PATH}/index.html" ] && [ ! -f "${LIB_PATH}/landing/index.html" ]; then
		echo "ERROR: ${LIB_PATH}/index.html (or landing/index.html) not found, build output incomplete" >&2
		exit 1
	fi
	case "$TARGET" in
	main | auth | awsug)
		if [ ! -d "${LIB_PATH}/assets" ] || [ -z "$(find "${LIB_PATH}/assets" -mindepth 1 -print -quit)" ]; then
			echo "ERROR: ${LIB_PATH}/assets missing or empty, build output incomplete. refusing to deploy ${TARGET} without hashed bundles" >&2
			exit 1
		fi
		;;
	esac
	if [ "$TARGET" = "quantum" ]; then
		local brand_dir="${LIB_PATH}/brand/quantum" asset missing=0
		local assets=(
			quantum-hero-1920x600.webp
			quantum-hero-1920x600.png
			quantum-hero-mobile-1080x1920.webp
			quantum-hero-mobile-1080x1920.png
			quantum-card-origami-600x400.png
			quantum-card-lattices-600x400.png
			quantum-card-prism-600x400.png
			quantum-og-1200x630.png
			quantum-meetup-1200x675.png
			quantum-fb-event-1920x1005.png
		)
		for asset in "${assets[@]}"; do
			if [ ! -f "${brand_dir}/${asset}" ]; then
				echo "ERROR: quantum brand asset missing: ${brand_dir}/${asset}. the --delete sync would wipe it from the bucket" >&2
				missing=1
			fi
		done
		if [ "$missing" = 1 ]; then
			exit 1
		fi
	fi
}

build_targets() {
	local t needs_site=0 needs_quantum=0
	for t in "${targets[@]}"; do
		load_target "$t"
		rm -rf "$LIB_PATH"
		if [ "$t" = "quantum" ]; then
			needs_quantum=1
		else
			needs_site=1
		fi
	done
	npm ci
	if [ "$needs_site" = 1 ]; then
		npm run build
	fi
	if [ "$needs_quantum" = 1 ]; then
		npx vite build --config vite.config.quantum.ts
	fi
}

invalidate() {
	if [ "$mode" != "apply" ]; then
		run aws cloudfront create-invalidation --distribution-id "$DIST" --paths "/*" \
			--profile "$PROFILE" --region "$REGION"
		return 0
	fi
	INVALIDATION_ID="$(aws cloudfront create-invalidation --distribution-id "$DIST" --paths "/*" \
		--query 'Invalidation.Id' --output text \
		--profile "$PROFILE" --region "$REGION")"
	echo "waiting for invalidation ${INVALIDATION_ID} on ${DIST}"
	aws cloudfront wait invalidation-completed --distribution-id "$DIST" --id "$INVALIDATION_ID" \
		--profile "$PROFILE" --region "$REGION"
}

verify_target() {
	[ -n "$VERIFY_URL" ] || return 0
	local title
	title="$(curl -s "$VERIFY_URL" | grep -o '<title>[^<]*' | head -1 || true)"
	if grep -q "$VERIFY_EXPECT" <<<"$title"; then
		echo "  PASS: ${VERIFY_URL} ${title}"
	else
		echo "  FAIL: ${VERIFY_URL} expected '${VERIFY_EXPECT}', got '${title}'" >&2
		exit 1
	fi
}

echo "deploy: targets=${targets[*]} mode=${mode} check_remote=${check_remote} MAX_DELETES=${MAX_DELETES}"

if [ "$mode" = "apply" ]; then
	build_targets
fi

for t in "${targets[@]}"; do
	load_target "$t"
	validate_output
	if [ "$mode" = "apply" ] || [ "$check_remote" = 1 ]; then
		region_check
	fi
done

# every guard runs before the first upload, so one abort leaves every bucket untouched
if [ "$mode" = "apply" ] || [ "$check_remote" = 1 ]; then
	for t in "${targets[@]}"; do
		load_target "$t"
		guard_target
	done
fi

COMMIT_SHA="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
for t in "${targets[@]}"; do
	load_target "$t"
	sync_target run
	invalidate
	if [ "$mode" = "apply" ]; then
		echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) target=${TARGET} bucket=${BUCKET} dist=${DIST} commit=${COMMIT_SHA} invalidation=${INVALIDATION_ID}" >>"${REPO_ROOT}/.deploy.log"
		verify_target
	fi
done

if [ "$mode" = "dry-run" ]; then
	echo "dry-run complete, nothing was uploaded. pass --apply to deploy"
fi
