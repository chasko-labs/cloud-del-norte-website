/**
 * Build-time feature flags for auth surfaces.
 *
 * Toggle these to re-enable gated features once backend prerequisites are met.
 * No env-var plumbing — flip the constant and rebuild.
 */

/** Enable TOTP authenticator setup during signup verification (requires #189 Lambda). */
export const ENABLE_TOTP_SETUP = false;

/** Enable SMS verification option during signup (not yet implemented). */
export const ENABLE_SMS_VERIFICATION = false;
