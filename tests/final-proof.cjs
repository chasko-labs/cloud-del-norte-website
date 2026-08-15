const { chromium } = require('playwright');
const { execSync, execFileSync } = require('child_process');

function ssmParam(name, withDecryption) {
  const args = ['ssm', 'get-parameter', '--name', name, '--profile', 'aerospaceug-admin', '--region', 'us-west-2', '--query', 'Parameter.Value', '--output', 'text'];
  if (withDecryption) args.push('--with-decryption');
  return execFileSync('aws', args, { encoding: 'utf8' }).trim();
}

(async () => {
  const CDN_TEST_USERNAME = ssmParam('/device-farm/test-users/admin-username', false);
  const CDN_TEST_PASSWORD = ssmParam('/device-farm/test-users/admin-password', true);

  const modAuth = JSON.parse(execFileSync('aws', [
    'cognito-idp', 'initiate-auth',
    '--auth-flow', 'USER_PASSWORD_AUTH',
    '--client-id', '57eikmt418ea6vti2f6h0pl74r',
    '--auth-parameters', `USERNAME=${CDN_TEST_USERNAME},PASSWORD=${CDN_TEST_PASSWORD}`,
    '--profile', 'jitsi-video-hosting',
    '--region', 'us-west-2',
    '--query', 'AuthenticationResult.{IdToken:IdToken,AccessToken:AccessToken,RefreshToken:RefreshToken}',
    '--output', 'json'
  ], { encoding: 'utf8' }));
  
  // Launch meeting
  execSync(`curl -s -X POST "https://rwmypxz9z6.execute-api.us-west-2.amazonaws.com/admin/meetings/launch" -H "Authorization: Bearer ${modAuth.IdToken}" -H "Content-Type: application/json" -d '{"title":"Final Proof","roomName":"cloud-del-norte-awsug"}'`);
  
  const browser = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark', permissions: ['microphone', 'camera'] });
  const page = await ctx.newPage();
  
  await page.goto('https://quantum.clouddelnorte.org/dashboard/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.evaluate((t) => {
    sessionStorage.setItem('cdn.idToken', t.IdToken);
    sessionStorage.setItem('cdn.accessToken', t.AccessToken);
    if (t.RefreshToken) sessionStorage.setItem('cdn.refreshToken', t.RefreshToken);
    const p = JSON.parse(atob(t.IdToken.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    if (p.exp) sessionStorage.setItem('cdn.expiresAt', String(p.exp * 1000));
  }, modAuth);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(8000);
  
  // Click Join
  await page.locator('button').filter({ hasText: /Join/ }).first().click();
  
  // Wait 30s for Jitsi to fully connect (no pre-join now)
  await page.waitForTimeout(30000);
  
  // Screenshot
  await page.screenshot({ path: 'docs/walkthrough/in-conference-proof.png', fullPage: true });
  console.log('Screenshot saved');
  
  // End meeting
  execSync(`curl -s -X POST "https://rwmypxz9z6.execute-api.us-west-2.amazonaws.com/admin/meetings/end" -H "Authorization: Bearer ${modAuth.IdToken}" -H "Content-Type: application/json" -d '{"roomName":"cloud-del-norte-awsug"}'`);
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
