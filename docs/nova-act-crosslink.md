# splintercells nova-act — awareness note

this site's E2E and visual-regression flows use playwright/chromium locally via the liora E2E testing recipe (reference: `feedback_liora_e2e_testing` — chrome-for-testing + xvfb :99 + EGL on rocm-aibox). that is the primary path for verifying the liora-embed bundle at clouddelnorte.org.

the splintercells deepagents harness provides a complementary cloud-hosted tier: AWS Nova Act can exercise browser workflows without requiring a local chromium instance. this is not a replacement.

## entry point

`invoke_nova_act_workflow` tool on the heraldstack-nova-mcp server at `http://rocm-aibox.local:8170/mcp` (or localhost:8170 from rocm-aibox).

rate limit: 3 concurrent invocations, 30-minute timeout per slot (valkey semaphore).

## API integration pattern

boto3 service name: **nova-act**
region: us-east-1
account: 946179428633 (profile: bryanchasko-kiro)

### flow

```
CreateWorkflowDefinition → CreateWorkflowRun → CreateSession → InvokeActStep (loop with CallResults)
```

1. **CreateWorkflowDefinition** — register a named workflow (e.g. `cdn-ux-audit`)
2. **CreateWorkflowRun** — start an execution of that definition
3. **CreateSession** — open a browser session within the run
4. **InvokeActStep** — send a prompt; returns `calls` (actions the agent wants to take). Provide `CallResults` and loop until the step completes.

### working Python script template

Environment: `~/code/heraldstack/splintercells-deep-agents-cli/.venv-sprint-a/` has boto3 available.

```python
#!/usr/bin/env python3
"""CDN UX Audit via Nova Act API."""
import boto3, json, time

session = boto3.Session(profile_name="bryanchasko-kiro", region_name="us-east-1")
client = session.client("nova-act")

UX_AUDIT_PROMPT = (
    "Navigate to https://awsug.clouddelnorte.org/index.html. "
    "You will be redirected to login. "
    "Enter email: heraldstack-test-member@clouddelnorte.org, "
    "password from SSM /device-farm/test-users/member-password. "
    "After login: screenshot every page (/index.html, /meetings/index.html, /admin/index.html). "
    "For each page rate 1-10: visual appeal, usefulness, information density. "
    "List what's broken, ugly, or missing. "
    "Suggest top 3 improvements per page."
)

# 1. Create workflow definition
wf = client.create_workflow_definition(workflowName="cdn-ux-audit")
wf_id = wf["workflowDefinitionId"]

# 2. Create a run
run = client.create_workflow_run(workflowDefinitionId=wf_id)
run_id = run["workflowRunId"]

# 3. Create a session
sess = client.create_session(workflowRunId=run_id)
session_id = sess["sessionId"]

# 4. Invoke act step — loop until done
response = client.invoke_act_step(
    sessionId=session_id,
    prompt=UX_AUDIT_PROMPT,
)

while response.get("calls"):
    # Process calls — provide results back
    call_results = []
    for call in response["calls"]:
        # Handle each call type (screenshot, input, navigation, etc.)
        call_results.append({
            "callId": call["callId"],
            "result": {"status": "SUCCESS"},
        })
    response = client.invoke_act_step(
        sessionId=session_id,
        callResults=call_results,
    )

print(json.dumps(response.get("output", {}), indent=2))
```

## when nova-act is appropriate for this repo

- scheduled visual-regression checks that run without a local playwright session
- verifying the liora-embed CDN endpoint from a remote host
- multi-instance parallel flows
- **UX audits** — automated scoring and screenshot capture across authenticated pages

## when local playwright testing is correct

- interactive E2E sessions against the live clouddelnorte.org CloudFront distribution
- anything requiring the EGL/ROCm GPU path for WebGL surface verification
- flows that depend on local BryanChasko aws credentials for S3 diff checks

## implementation reference

`BryanChasko/splintercells-deep-agents-cli` — see `docs/architecture.md` for tool signatures, aws auth, and rate limiter behavior.

aws account note: nova-act runs in the kiro account (946179428633, us-east-1). the liora-embed production deploy target is the awsaerospace account (211125425201). these are distinct accounts — nova-act invocations do not touch the awsaerospace S3 bucket or CloudFront distribution unless explicitly wired.
