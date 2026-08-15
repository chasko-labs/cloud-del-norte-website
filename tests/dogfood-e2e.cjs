const { chromium } = require('playwright');
const { execSync, execFileSync } = require('child_process');

function ssmParam(name, withDecryption) {
  const args = ['ssm', 'get-parameter', '--name', name, '--profile', 'aerospaceug-admin', '--region', 'us-west-2', '--query', 'Parameter.Value', '--output', 'text'];
  if (withDecryption) args.push('--with-decryption');
  return execFileSync('aws', args, { encoding: 'utf8' }).trim();
}

(async () => {
  console.log('=== FULL E2E DOG FOOD TEST ===\n');

  // 1. Get moderator + member tokens
  console.log('1. Authenticating users...');
  const CDN_ADMIN_USERNAME = ssmParam('/device-farm/test-users/admin-username', false);
  const CDN_ADMIN_PASSWORD = ssmParam('/device-farm/test-users/admin-password', true);
  const CDN_MEMBER_USERNAME = ssmParam('/device-farm/test-users/member-username', false);
  const CDN_MEMBER_PASSWORD = ssmParam('/device-farm/test-users/member-password', true);

  const modAuth = JSON.parse(execFileSync('aws', [
    'cognito-idp', 'initiate-auth',
    '--auth-flow', 'USER_PASSWORD_AUTH',
    '--client-id', '57eikmt418ea6vti2f6h0pl74r',
    '--auth-parameters', `USERNAME=${CDN_ADMIN_USERNAME},PASSWORD=${CDN_ADMIN_PASSWORD}`,
    '--profile', 'jitsi-video-hosting',
    '--region', 'us-west-2',
    '--query', 'AuthenticationResult.{IdToken:IdToken,AccessToken:AccessToken,RefreshToken:RefreshToken}',
    '--output', 'json'
  ], { encoding: 'utf8' }));
  const memAuth = JSON.parse(execFileSync('aws', [
    'cognito-idp', 'initiate-auth',
    '--auth-flow', 'USER_PASSWORD_AUTH',
    '--client-id', '57eikmt418ea6vti2f6h0pl74r',
    '--auth-parameters', `USERNAME=${CDN_MEMBER_USERNAME},PASSWORD=${CDN_MEMBER_PASSWORD}`,
    '--profile', 'jitsi-video-hosting',
    '--region', 'us-west-2',
    '--query', 'AuthenticationResult.{IdToken:IdToken,AccessToken:AccessToken,RefreshToken:RefreshToken}',
    '--output', 'json'
  ], { encoding: 'utf8' }));
  console.log('   Moderator: ✓');
  console.log('   Member: ✓');

  // 2. Launch a meeting via API (as moderator)
  console.log('\n2. Launching meeting via API...');
  const launchResp = execSync(
    `curl -s -X POST "https://rwmypxz9z6.execute-api.us-west-2.amazonaws.com/admin/meetings/launch" -H "Authorization: Bearer ${modAuth.IdToken}" -H "Content-Type: application/json" -d '{"title":"Dog Food Test Call","roomName":"cloud-del-norte-awsug"}'`,
    { encoding: 'utf8' }
  );
  const launch = JSON.parse(launchResp);
  console.log(`   Launch: ${launch.ok ? '✓' : '✗'} — ${launch.status}, infra: ${launch.infrastructure_status}`);

  // 3. Check meeting status
  console.log('\n3. Checking meeting status...');
  const statusResp = execSync(
    `curl -s "https://rwmypxz9z6.execute-api.us-west-2.amazonaws.com/meetings/status"`,
    { encoding: 'utf8' }
  );
  const status = JSON.parse(statusResp);
  console.log(`   Status: live=${status.live}, title="${status.title}"`);
  if (!status.live) { console.log('   ✗ FAIL — meeting not live'); process.exit(1); }

  // 4. Load quantum dashboard as MODERATOR
  console.log('\n4. Loading dashboard as moderator...');
  const browser = await chromium.launch({ headless: true });
  const modCtx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
  const modPage = await modCtx.newPage();
  await modPage.goto('https://quantum.clouddelnorte.org/dashboard/', { waitUntil: 'networkidle', timeout: 20000 });
  await modPage.evaluate((tokens) => {
    sessionStorage.setItem('cdn.idToken', tokens.IdToken);
    sessionStorage.setItem('cdn.accessToken', tokens.AccessToken);
    if (tokens.RefreshToken) sessionStorage.setItem('cdn.refreshToken', tokens.RefreshToken);
    const payload = JSON.parse(atob(tokens.IdToken.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    if (payload.exp) sessionStorage.setItem('cdn.expiresAt', String(payload.exp * 1000));
  }, modAuth);
  await modPage.reload({ waitUntil: 'networkidle' });
  await modPage.waitForTimeout(5000);

  const modBody = await modPage.locator('body').textContent();
  const hasModControls = modBody.includes('Launch') || modBody.includes('Moderator') || modBody.includes('End');
  const hasLiveStatus = modBody.includes('SESSION IN PROGRESS') || modBody.includes('Live') || modBody.includes('live');
  const hasJoinBtn = modBody.includes('Join Now') || modBody.includes('Join');
  console.log(`   Moderator controls: ${hasModControls ? '✓' : '✗'}`);
  console.log(`   Live status from API: ${hasLiveStatus ? '✓' : '✗'}`);
  console.log(`   Join button: ${hasJoinBtn ? '✓' : '✗'}`);
  await modPage.screenshot({ path: 'docs/walkthrough/dogfood-mod-dashboard.png', fullPage: true });

  // 5. Click Join as moderator — click through Jitsi pre-join lobby into actual conference
  // "joined" means: the user has passed the pre-join screen AND entered the live conference
  // (toolbar visible, video area present). Merely loading the iframe/lobby is NOT joined.
  console.log('\n5. Moderator joins call...');
  const joinBtn = await modPage.locator('button:has-text("Join")').first();
  if (await joinBtn.isVisible().catch(() => false)) {
    await joinBtn.click();
    // Wait for Jitsi iframe to load with correct src
    await modPage.locator('iframe[src*="meet.clouddelnorte"]').first().waitFor({ state: 'attached', timeout: 15000 });
    console.log('   Jitsi iframe attached: ✓');

    // Access the Jitsi iframe content via frameLocator
    const modJitsiFrame = modPage.frameLocator('iframe[src*="meet.clouddelnorte"]');

    // Wait for and click the pre-join "Join Meeting" button inside the iframe
    const modPrejoinBtn = modJitsiFrame.locator('[data-testid="prejoin.joinMeeting"], button:has-text("Join meeting"), button:has-text("Join Meeting")').first();
    await modPrejoinBtn.waitFor({ timeout: 20000 });
    console.log('   Pre-join button visible: ✓');
    await modPrejoinBtn.click();
    console.log('   Clicked pre-join Join Meeting: ✓');

    // Wait for actual conference view (toolbar or hangup button appears)
    const modConferenceIndicator = modJitsiFrame.locator('[data-testid="toolbox"], [class*="toolbox"], [aria-label="Leave"], [aria-label="Hangup"]').first();
    await modConferenceIndicator.waitFor({ timeout: 30000 });
    console.log('   Conference toolbar visible: ✓ — moderator is IN the call');

    await modPage.screenshot({ path: 'docs/walkthrough/dogfood-mod-incall.png', fullPage: true });
    console.log('   Screenshot captured: dogfood-mod-incall.png');
  } else {
    console.log('   ✗ Join button not visible');
  }

  // 6. Load quantum dashboard as MEMBER (separate browser context)
  console.log('\n6. Loading dashboard as member...');
  const memCtx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
  const memPage = await memCtx.newPage();
  await memPage.goto('https://quantum.clouddelnorte.org/dashboard/', { waitUntil: 'networkidle', timeout: 20000 });
  await memPage.evaluate((tokens) => {
    sessionStorage.setItem('cdn.idToken', tokens.IdToken);
    sessionStorage.setItem('cdn.accessToken', tokens.AccessToken);
    if (tokens.RefreshToken) sessionStorage.setItem('cdn.refreshToken', tokens.RefreshToken);
    const payload = JSON.parse(atob(tokens.IdToken.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    if (payload.exp) sessionStorage.setItem('cdn.expiresAt', String(payload.exp * 1000));
  }, memAuth);
  await memPage.reload({ waitUntil: 'networkidle' });
  await memPage.waitForTimeout(5000);

  const memBody = await memPage.locator('body').textContent();
  const memHasLive = memBody.includes('SESSION IN PROGRESS') || memBody.includes('Live') || memBody.includes('live');
  const memHasJoin = memBody.includes('Join Now') || memBody.includes('Join');
  const memNoMod = !memBody.includes('Launch Session') && !memBody.includes('End Session');
  console.log(`   Member sees live session: ${memHasLive ? '✓' : '✗'}`);
  console.log(`   Member sees Join: ${memHasJoin ? '✓' : '✗'}`);
  console.log(`   Member does NOT see mod controls: ${memNoMod ? '✓' : '✗'}`);

  // 7. Member joins — click through Jitsi pre-join lobby into actual conference
  // "joined" means: member has passed the pre-join screen AND entered the live conference.
  console.log('\n7. Member joins call...');
  const memJoin = await memPage.locator('button:has-text("Join")').first();
  if (await memJoin.isVisible().catch(() => false)) {
    await memJoin.click();
    // Wait for Jitsi iframe to load with correct src
    await memPage.locator('iframe[src*="meet.clouddelnorte"]').first().waitFor({ state: 'attached', timeout: 15000 });
    console.log('   Member Jitsi iframe attached: ✓');

    // Access the Jitsi iframe content via frameLocator
    const memJitsiFrame = memPage.frameLocator('iframe[src*="meet.clouddelnorte"]');

    // Wait for and click the pre-join "Join Meeting" button inside the iframe
    const memPrejoinBtn = memJitsiFrame.locator('[data-testid="prejoin.joinMeeting"], button:has-text("Join meeting"), button:has-text("Join Meeting")').first();
    await memPrejoinBtn.waitFor({ timeout: 20000 });
    console.log('   Member pre-join button visible: ✓');
    await memPrejoinBtn.click();
    console.log('   Member clicked pre-join Join Meeting: ✓');

    // Wait for actual conference view (toolbar or hangup button appears)
    const memConferenceIndicator = memJitsiFrame.locator('[data-testid="toolbox"], [class*="toolbox"], [aria-label="Leave"], [aria-label="Hangup"]').first();
    await memConferenceIndicator.waitFor({ timeout: 30000 });
    console.log('   Member conference toolbar visible: ✓ — member is IN the call');

    await memPage.screenshot({ path: 'docs/walkthrough/dogfood-mem-incall.png', fullPage: true });
    console.log('   Screenshot captured: dogfood-mem-incall.png');
  } else {
    console.log('   ✗ Member Join button not visible');
  }

  // 8. End meeting via API
  console.log('\n8. Ending meeting via API...');
  const endResp = execSync(
    `curl -s -X POST "https://rwmypxz9z6.execute-api.us-west-2.amazonaws.com/admin/meetings/end" -H "Authorization: Bearer ${modAuth.IdToken}" -H "Content-Type: application/json" -d '{"roomName":"cloud-del-norte-awsug"}'`,
    { encoding: 'utf8' }
  );
  const end = JSON.parse(endResp);
  console.log(`   End: ${end.ok ? '✓' : '✗'}`);

  // 9. Verify status shows not live
  console.log('\n9. Verifying meeting ended...');
  const finalStatus = JSON.parse(execSync(
    `curl -s "https://rwmypxz9z6.execute-api.us-west-2.amazonaws.com/meetings/status"`,
    { encoding: 'utf8' }
  ));
  console.log(`   Status: live=${finalStatus.live} ${!finalStatus.live ? '✓' : '✗'}`);

  await browser.close();

  console.log('\n========================================');
  console.log('DOG FOOD COMPLETE');
  console.log('========================================');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
