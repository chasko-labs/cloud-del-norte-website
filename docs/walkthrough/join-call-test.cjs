const { chromium } = require('playwright');
const { execFileSync } = require('child_process');

function ssmParam(name, withDecryption) {
  const args = ['ssm', 'get-parameter', '--name', name, '--profile', 'aerospaceug-admin', '--region', 'us-west-2', '--query', 'Parameter.Value', '--output', 'text'];
  if (withDecryption) args.push('--with-decryption');
  return execFileSync('aws', args, { encoding: 'utf8' }).trim();
}

(async () => {
  // Get real Cognito tokens
  console.log('1. Getting Cognito tokens...');
  const CDN_MEMBER_USERNAME = ssmParam('/device-farm/test-users/member-username', false);
  const CDN_MEMBER_PASSWORD = ssmParam('/device-farm/test-users/member-password', true);

  const authResult = JSON.parse(execFileSync('aws', [
    'cognito-idp', 'initiate-auth',
    '--auth-flow', 'USER_PASSWORD_AUTH',
    '--client-id', '57eikmt418ea6vti2f6h0pl74r',
    '--auth-parameters', `USERNAME=${CDN_MEMBER_USERNAME},PASSWORD=${CDN_MEMBER_PASSWORD}`,
    '--profile', 'jitsi-video-hosting',
    '--region', 'us-west-2',
    '--query', 'AuthenticationResult.{IdToken:IdToken,AccessToken:AccessToken,RefreshToken:RefreshToken}',
    '--output', 'json'
  ], { encoding: 'utf8' }));
  console.log('   IdToken:', authResult.IdToken.substring(0, 30) + '...');

  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
  const page = await ctx.newPage();
  const consoleMessages = [];
  page.on('console', msg => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));

  // 2. Navigate to quantum dashboard and inject tokens
  console.log('\n2. Loading quantum dashboard + injecting tokens...');
  await page.goto('https://quantum.clouddelnorte.org/dashboard/', { waitUntil: 'networkidle', timeout: 20000 });
  await page.evaluate((tokens) => {
    sessionStorage.setItem('cdn.idToken', tokens.IdToken);
    sessionStorage.setItem('cdn.accessToken', tokens.AccessToken);
    if (tokens.RefreshToken) sessionStorage.setItem('cdn.refreshToken', tokens.RefreshToken);
    const payload = JSON.parse(atob(tokens.IdToken.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    if (payload.exp) sessionStorage.setItem('cdn.expiresAt', String(payload.exp * 1000));
  }, authResult);
  
  // Reload to pick up tokens
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // 3. Check what view we're in
  console.log('\n3. Checking dashboard state...');
  const bodyText = await page.locator('body').textContent();
  const isMemberView = bodyText.includes('Join Now') || bodyText.includes('join');
  const hasModControls = bodyText.includes('Launch') || bodyText.includes('Moderator');
  const hasSignInPrompt = bodyText.includes('sign in to join');
  const hasLiveSession = bodyText.includes('Live now') || bodyText.includes('Live');
  console.log(`   Member view: ${isMemberView}`);
  console.log(`   Moderator controls: ${hasModControls}`);
  console.log(`   Sign-in prompt (should be NO): ${hasSignInPrompt}`);
  console.log(`   Live session detected: ${hasLiveSession}`);

  // 4. Click Join Now if visible
  console.log('\n4. Attempting to join call...');
  const joinBtn = await page.locator('button:has-text("Join Now"), button:has-text("join")').first();
  if (await joinBtn.isVisible().catch(() => false)) {
    console.log('   Join button found! Clicking...');
    await joinBtn.click();
    await page.waitForTimeout(5000);
    
    // Check if JitsiEmbed rendered
    const hasJitsiContainer = await page.locator('[data-testid="jitsi-iframe-host"], iframe[src*="meet.clouddelnorte"]').count();
    const hasLoadingSpinner = await page.locator('text=connecting').count() + await page.locator('text=Connecting').count() + await page.locator('text=loading').count();
    const hasError = await page.locator('[class*="error"], [class*="alert-error"]').count();
    console.log(`   Jitsi container/iframe: ${hasJitsiContainer > 0}`);
    console.log(`   Loading state: ${hasLoadingSpinner > 0}`);
    console.log(`   Error state: ${hasError > 0}`);
    
    await page.screenshot({ path: 'docs/walkthrough/join-call-test.png', fullPage: true });
    console.log('   Screenshot: docs/walkthrough/join-call-test.png');
  } else {
    console.log('   No Join button visible. Checking why...');
    const pageContent = await page.locator('body').textContent();
    const relevant = pageContent.substring(0, 500);
    console.log(`   Page content (first 500): ${relevant}`);
    await page.screenshot({ path: 'docs/walkthrough/join-call-nobutton.png', fullPage: true });
  }

  // 5. Console messages
  console.log('\n5. Console messages:');
  const jitsiMsgs = consoleMessages.filter(m => m.includes('jitsi') || m.includes('token') || m.includes('error') || m.includes('Error'));
  for (const m of jitsiMsgs.slice(0, 10)) console.log(`   ${m}`);

  console.log('\n=== DONE ===');
  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
