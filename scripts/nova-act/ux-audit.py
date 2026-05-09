import os, boto3, json, time

os.environ["AWS_PROFILE"] = "bryanchasko-kiro"
os.environ["AWS_DEFAULT_REGION"] = "us-east-1"

from bedrock_agentcore.tools.browser_client import browser_session
from nova_act import NovaAct, workflow
from nova_act.types.act_errors import ActActuationError

EMAIL = "heraldstack-test-member@clouddelnorte.org"
PAGES = ["/index.html", "/meetings/index.html", "/admin/index.html"]
BROWSER_ID = "novaActUxAudit-Zw4ZTcqlhF"

ssm = boto3.Session(profile_name="jitsi-video-hosting", region_name="us-west-2").client("ssm")
PASSWORD = ssm.get_parameter(Name="/cloud-del-norte/test/smoketest-user-password", WithDecryption=True)["Parameter"]["Value"]

results = {}

@workflow(
    model_id="nova-act-latest",
    boto_session_kwargs={"profile_name": "bryanchasko-kiro", "region_name": "us-east-1"},
    workflow_definition_name="cdn-ux-audit",
)
def run_audit():
    with browser_session(region="us-east-1", identifier=BROWSER_ID) as browser:
        ws_url, headers = browser.generate_ws_headers()

        with NovaAct(
            cdp_endpoint_url=ws_url,
            cdp_headers=headers,
            starting_page="https://auth.clouddelnorte.org/login/index.html",
            headless=True,
            tty=False,
        ) as nova:
            try:
                nova.act(
                    f"Enter email {EMAIL} in the email field. Enter password {PASSWORD} in the password field. "
                    f"Click the sign in button. Wait for redirect to complete."
                )
                print("\n=== LOGIN === success")
            except ActActuationError as e:
                print(f"\n=== LOGIN === timeout after {e.metadata.num_steps_executed} steps (continuing)")

            time.sleep(5)

            for page in PAGES:
                try:
                    nova.act(f"Navigate to https://awsug.clouddelnorte.org{page} and wait for the page to fully load.")
                    r = nova.act_get(
                        "Describe everything visible on the page. Rate visual appeal 1-10. "
                        "Rate usefulness 1-10. List anything broken, ugly, or empty. Suggest top 3 improvements."
                    )
                    results[page] = {"response": r.response}
                    print(f"\n=== {page} ===\n{r.response}")
                except Exception as e:
                    print(f"{page} failed: {e}")
                    results[page] = {"error": str(e)}

run_audit()

with open("/tmp/nova-act-ux-audit-results.json", "w") as f:
    json.dump(results, f, indent=2, default=str)
print("\nResults saved to /tmp/nova-act-ux-audit-results.json")
