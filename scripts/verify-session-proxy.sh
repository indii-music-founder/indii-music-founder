#!/usr/bin/env bash
#
# ISSUE-1175 live closure harness — repair-order steps 2/3.
#
# The founder's binding acceptance rule (see the FOUNDER ASSESSMENT block in
# .agent/test_ledger/OPEN_ISSUES_V2.md) is that a real user action in the running
# app must produce the real artefact end to end. Unit tests do not close it, and
# the 2026-07-24 run that reached `proxyJob.status: "blocked"` did not either.
#
# This script does NOT fabricate that user action. It does the two things around
# it that were re-derived by hand on every previous attempt:
#
#   preflight  — prove every piece of infra the chain depends on is actually live
#                BEFORE a human uploads anything, so a failed run means a real
#                defect rather than a missing env var.
#   watch      — follow one real session to a terminal state and print the exact
#                evidence the ledger needs (manifest presence, proxy object,
#                worker logs), without ever asserting success on its behalf.
#
# Usage:
#   scripts/verify-session-proxy.sh preflight
#   scripts/verify-session-proxy.sh watch <sessionId>
#
set -euo pipefail

PROJECT="${SESSION_PROXY_PROJECT:-indii-music-founder}"
REGION="${SESSION_PROXY_REGION:-us-central1}"
QUEUE="${SESSION_PROXY_TASKS_QUEUE:-session-proxy-queue}"
WORKER_SERVICE="${SESSION_PROXY_WORKER_SERVICE:-engine-dsp}"
FUNCTION="finalizeVideoSessionUpload"
INVOKER_SA="engine-dsp-invoker@${PROJECT}.iam.gserviceaccount.com"

pass() { printf '  \033[32mPASS\033[0m  %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; FAILED=1; }
info() { printf '  ----  %s\n' "$1"; }

require_auth() {
    if ! gcloud auth print-access-token >/dev/null 2>&1; then
        echo "gcloud auth is expired. Run:  gcloud auth login" >&2
        exit 2
    fi
}

preflight() {
    require_auth
    FAILED=0
    echo "ISSUE-1175 preflight — project ${PROJECT}, region ${REGION}"
    echo

    echo "1. Proxy worker service"
    local url
    url="$(gcloud run services describe "$WORKER_SERVICE" \
        --project "$PROJECT" --region "$REGION" \
        --format='value(status.url)' 2>/dev/null || true)"
    if [[ -n "$url" ]]; then
        pass "${WORKER_SERVICE} is deployed at ${url}"
    else
        fail "${WORKER_SERVICE} is not deployed in ${REGION}"
        return 1
    fi

    # /health must answer with an identity token. A 403 here means the caller
    # lacks run.invoker, not that the service is down — distinguish the two,
    # because conflating them is what makes this chain hard to debug.
    local token code
    token="$(gcloud auth print-identity-token 2>/dev/null || true)"
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 \
        -H "Authorization: Bearer ${token}" "${url}/health" || echo 000)"
    case "$code" in
        200) pass "/health returned 200 for an authenticated caller" ;;
        403) info "/health returned 403 for this operator account (expected if you lack run.invoker; the dispatcher uses ${INVOKER_SA})" ;;
        *)   fail "/health returned ${code}" ;;
    esac

    # The dispatcher builds its URL as new URL('/proxy', workerUrl), so the route
    # must exist on this exact service — the audio worker shares the app.
    if curl -s --max-time 30 -H "Authorization: Bearer ${token}" "${url}/openapi.json" \
        | grep -q '"/proxy"'; then
        pass "/proxy route is present in the deployed OpenAPI schema"
    else
        info "could not confirm /proxy from openapi.json (403 or schema not exposed) — check the revision's source if the run stalls"
    fi

    # The worker refuses to build its pipeline without this bucket; the failure
    # surfaces as a 503 mid-run rather than at deploy time.
    local bucket
    bucket="$(gcloud run services describe "$WORKER_SERVICE" \
        --project "$PROJECT" --region "$REGION" \
        --format='value(spec.template.spec.containers[0].env)' 2>/dev/null || true)"
    if grep -q 'SESSION_MEDIA_BUCKET' <<<"$bucket"; then
        pass "SESSION_MEDIA_BUCKET is set on the worker"
    else
        fail "SESSION_MEDIA_BUCKET is NOT set on the worker (build_pipeline_from_environment will raise)"
    fi

    echo
    echo "2. Cloud Tasks queue"
    if gcloud tasks queues describe "$QUEUE" \
        --project "$PROJECT" --location "$REGION" >/dev/null 2>&1; then
        local state
        state="$(gcloud tasks queues describe "$QUEUE" --project "$PROJECT" \
            --location "$REGION" --format='value(state)')"
        if [[ "$state" == "RUNNING" ]]; then
            pass "${QUEUE} exists and is RUNNING"
        else
            fail "${QUEUE} exists but is ${state} — tasks will not dispatch"
        fi
    else
        fail "${QUEUE} does not exist in ${REGION}"
    fi

    echo
    echo "3. Finalizer env contract"
    local env
    env="$(gcloud functions describe "$FUNCTION" --gen2 \
        --project "$PROJECT" --region "$REGION" \
        --format='value(serviceConfig.environmentVariables)' 2>/dev/null || true)"
    if [[ -z "$env" ]]; then
        fail "${FUNCTION} is not deployed or is unreadable"
    else
        # Missing URL/service-account is the exact condition that produced the
        # 2026-07-24 `blocked: proxy-worker-not-configured` result.
        for key in SESSION_PROXY_WORKER_URL SESSION_PROXY_SERVICE_ACCOUNT \
                   SESSION_PROXY_AUDIENCE SESSION_PROXY_TASKS_QUEUE \
                   SESSION_PROXY_TASKS_LOCATION; do
            if grep -q "$key" <<<"$env"; then
                pass "${key} is set"
            else
                fail "${key} is MISSING — dispatch will record blocked/proxy-worker-not-configured"
            fi
        done
    fi

    echo
    echo "4. Invoker IAM"
    if gcloud run services get-iam-policy "$WORKER_SERVICE" \
        --project "$PROJECT" --region "$REGION" --format=json 2>/dev/null \
        | grep -q "$INVOKER_SA"; then
        pass "${INVOKER_SA} is bound on ${WORKER_SERVICE}"
    else
        fail "${INVOKER_SA} has no binding on ${WORKER_SERVICE} — Cloud Tasks OIDC will 403"
    fi

    echo
    if [[ "${FAILED:-0}" -eq 0 ]]; then
        echo "Preflight clean. A real upload can now be attempted from the running app."
    else
        echo "Preflight found blocking gaps above. Fix them before the live run —"
        echo "a run started now would fail for infra reasons and prove nothing."
        return 1
    fi
}

watch_session() {
    require_auth
    local session_id="$1"
    [[ -n "$session_id" ]] || { echo "usage: $0 watch <sessionId>" >&2; exit 2; }

    echo "Watching videoSessions/${session_id} — Ctrl-C to stop."
    echo "Terminal states: completed (with proxyManifest) | failed | cancelled"
    echo

    local last=""
    for _ in $(seq 1 120); do
        local doc status job manifest
        doc="$(gcloud firestore documents get \
            "projects/${PROJECT}/databases/(default)/documents/videoSessions/${session_id}" \
            --project "$PROJECT" --format=json 2>/dev/null || true)"
        if [[ -z "$doc" ]]; then
            echo "  session document not found yet…"
            sleep 10
            continue
        fi
        status="$(python3 -c '
import json,sys
d=json.load(sys.stdin).get("fields",{})
def s(k): return d.get(k,{}).get("stringValue","-")
job=d.get("proxyJob",{}).get("mapValue",{}).get("fields",{})
print(s("status"), job.get("status",{}).get("stringValue","-"),
      job.get("blockedReason",{}).get("stringValue",""),
      "manifest" if "proxyManifest" in d else "no-manifest")
' <<<"$doc" 2>/dev/null || echo "parse-error")"

        if [[ "$status" != "$last" ]]; then
            printf '  [%s] status/proxyJob/reason/manifest = %s\n' "$(date +%H:%M:%S)" "$status"
            last="$status"
        fi

        case "$status" in
            "completed "*"manifest") echo; echo "TERMINAL: completed with a proxy manifest."; break ;;
            *"blocked"*) echo; echo "TERMINAL: dispatch blocked — this does NOT close ISSUE-1175."; break ;;
            "failed "*|"cancelled "*) echo; echo "TERMINAL: ${status% *} — inspect worker logs below."; break ;;
        esac
        sleep 10
    done

    echo
    echo "Recent worker logs for this session:"
    gcloud logging read \
        "resource.type=cloud_run_revision AND resource.labels.service_name=${WORKER_SERVICE} AND textPayload:\"${session_id}\"" \
        --project "$PROJECT" --freshness=1h --limit=25 \
        --format='value(timestamp,textPayload)' 2>/dev/null || echo "  (no matching log entries)"
}

case "${1:-}" in
    preflight) preflight ;;
    watch)     watch_session "${2:-}" ;;
    *) echo "usage: $0 {preflight|watch <sessionId>}" >&2; exit 2 ;;
esac
