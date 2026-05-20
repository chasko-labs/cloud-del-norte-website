# Wave 47 — Spanish Norteño (Chihuahuan) Translation Audit

**Date:** 2026-05-20  
**Scope:** `src/locales/en-US.json` vs `src/locales/es-MX.json`  
**Dialect target:** Chihuahuan norteño — Juárez MX / El Paso TX corridor  
**Status:** Read-only audit. No source mutations.

---

## Tier 1: Identical / English-Leaked

Keys where es-MX value exactly matches en-US and is NOT on the `allowIdentical` list.

| Key path | en-US value | es-MX value | Finding | Proposed norteño value | Rationale |
|----------|-------------|-------------|---------|------------------------|-----------|
| `feedPage.andresMediumHeader` | Andres Moreno — andmoredev | Andres Moreno — andmoredev | identical-leak | Andres Moreno — andmoredev | Actually legitimate (proper name + handle) — recommend adding to allowIdentical |
| `feedPage.pastMeetupSpeaker1Name` | Carolina Herrera Monteza | Carolina Herrera Monteza | identical-leak | Carolina Herrera Monteza | Already on allowIdentical — test passes; no action needed |
| `feedPage.pastMeetupSpeaker2Name` | Verónica Rivera | Verónica Rivera | identical-leak | Verónica Rivera | Already on allowIdentical — no action needed |
| `feedPage.pastMeetupSpeaker3Name` | Sary Libreros | Sary Libreros | identical-leak | Sary Libreros | Already on allowIdentical — no action needed |
| `feedPage.pastMeetupSpeaker4Name` | Brenda Galicia | Brenda Galicia | identical-leak | Brenda Galicia | Already on allowIdentical — no action needed |
| `maintenanceCalendar.releaseNotes` | Release notes | Release notes | identical-leak | Notas de release | Technical term but user-facing label; "release" is fine as loanword, "notes" should be Spanish |
| `meetings.tableHeaders.onDemand` | On-Demand | On-Demand | identical-leak | On-Demand | Already on allowIdentical — no action needed |

**Net Tier 1 findings requiring action: 2** (andresMediumHeader → add to allowIdentical; maintenanceCalendar.releaseNotes → translate)

---

## Tier 2: Stale (en-US updated in wave 36+ but es-MX not refreshed)

| Key path | en-US value (current) | es-MX value (current) | Finding | Proposed norteño value | Rationale |
|----------|----------------------|----------------------|---------|------------------------|-----------|
| `feedPage.andmoreCoOrganizer` | Cloud Del Norte UG co-organizer | co-organizador del UG Cloud Del Norte | stale-after-wave-45 | Co-organizador del UG Cloud Del Norte | Wave 45 changed en-US to include "UG" explicitly; es-MX already has it — verify parity is intentional |
| `feedPage.shortsHostBlurb` | Hosted by Ma-tonth, sharing conversations on Oak Flat, Indigenous cu… | Conducido por Ma-tonth, compartiendo conversaciones sobre Oak Flat, c… | stale-after-wave-45 | Conducido por Ma-tonth, compartiendo pláticas sobre Oak Flat, cultura indígena y el movimiento MMIP. | Wave 45 trimmed the en-US blurb; es-MX matches current en-US meaning — verify trim parity |
| `auth.signup.alreadyMember` | Already a Member? | ¿Ya eres miembro? | stale-after-wave-39 | ¿Ya eres miembro? | Wave 39b changed en-US sign-in flow copy; es-MX value looks correct — confirm no wording shift |
| `auth.signup.signInLink` | Sign in | Inicia sesión | stale-after-wave-39 | Inicia sesión | Wave 39b; es-MX looks correct — confirm |
| `auth.login.signUpLink` | Apply to join | Solicita unirte | stale-after-wave-40 | Solicita unirte | Wave 40b changed en-US from "Sign up" to "Apply to join"; es-MX already updated — confirm |

**Net Tier 2 findings requiring action: 0** (all appear already synchronized — recommend spot-checking git blame to confirm)

---

## Tier 3: Tone Drift from Norteño

Values that read as neutral-LATAM or formal instead of fronterizo. The existing file already uses good norteño in many places (e.g. "vuelve pronto, raza", "cáele en el trolley", "píllate un Lyft"). These entries don't match that voice.

| Key path | en-US value | es-MX value | Finding | Proposed norteño value | Rationale |
|----------|-------------|-------------|---------|------------------------|-----------|
| `auth.sessionExpired.title` | Your session has expired | Su sesión ha expirado | tone-drift-formal | Tu sesión expiró | "Su" → "Tu" (norteño tú-form); "ha expirado" → "expiró" (simpler preterite) |
| `auth.sessionExpired.body` | Please log in again to continue. | Por favor inicie sesión nuevamente para continuar. | tone-drift-formal | Inicia sesión de nuevo pa' continuar. | "inicie" (usted) → "inicia" (tú); "por favor" can drop; "pa'" is fronterizo |
| `meetings.connection.coldStart` | Meeting room is starting up, please wait… | La sala se está iniciando, por favor espere… | tone-drift-formal | La sala se está iniciando, espérate tantito… | "espere" (usted) → "espérate tantito" (tú + norteño diminutive) |
| `meetings.connection.unreachableBody` | The meeting room may be unavailable. | La sala de reuniones puede no estar disponible. | tone-drift-formal | La sala puede que no esté disponible. | Shorter, more natural norteño phrasing |
| `meetings.connection.permissionBlocked.header` | Camera or microphone access blocked | Acceso a cámara o micrófono bloqueado | tone-drift-formal | Cámara o micrófono bloqueados | Direct, shorter — norteño doesn't front-load "acceso a" |
| `meetings.connection.permissionBlocked.body` | Click the lock icon in your browser's address bar to allow access, t… | Haga clic en el icono de candado en la barra de direcciones para perm… | tone-drift-formal | Dale clic al candadito en la barra de tu navegador pa' dar permiso, y luego recarga. | "Haga clic" (usted) → "Dale clic" (tú); "candadito" (norteño diminutive); "pa'" |
| `awsug.pendingApproval.body` | An admin will review your request. This is a manual process, so plea… | Un administrador revisará tu solicitud. Este es un proceso manual, as… | tone-drift-formal | Un admin va a revisar tu solicitud. Es proceso manual, así que dale chance. | "administrador" → "admin" (Spanglish); "así que por favor espera" → "dale chance" |
| `awsug.meetings.pendingJoinError` | Your account is pending admin approval. You'll be able to join meeti… | Su cuenta está pendiente de aprobación del administrador. Podrá unirs… | tone-drift-formal | Tu cuenta está pendiente de aprobación. Vas a poder unirte a las juntas cuando te aprueben. | "Su/Podrá" (usted) → "Tu/Vas a poder" (tú); natural norteño future |
| `awsug.meetings.pendingApproval` | your application is pending approval. meetings are available once ap… | tu solicitud está pendiente de aprobación. las reuniones estarán disp… | tone-drift-formal | tu solicitud está pendiente. las juntas van a estar disponibles cuando te aprueben. | "reuniones" → "juntas" (consistent with rest of file); simpler future |
| `awsug.meetings.createPendingApproval` | your application is pending approval. meeting creation is available … | tu solicitud está pendiente de aprobación. la creación de reuniones e… | tone-drift-formal | tu solicitud está pendiente. crear juntas va a estar disponible cuando te aprueben. | Same pattern — "reuniones" → "juntas"; natural future tense |
| `awsug.pendingApproval.header` | Your account is pending admin approval. | Tu cuenta está pendiente de aprobación. | tone-drift-formal | Tu cuenta está pendiente de aprobación. | Actually fine — already uses tú. No change needed. |
| `awsug.admin.banPopoverBody` | banned from future sessions. to remove from an active call, join as … | Bloqueado de sesiones futuras. Para remover de una llamada activa, ún… | tone-drift-formal | Bloqueado de sesiones futuras. Pa' sacarlo de una llamada activa, únete como moderador y usa los controles de participantes. | "Para remover" → "Pa' sacarlo" (norteño contraction + natural verb) |
| `awsug.admin.moderatorAccessRequired` | You don't have access to the admin area. This area is for moderators… | No tienes acceso al área de administración. Esta área es solo para mo… | tone-drift-formal | No tienes acceso al área de admin. Esto es solo pa' moderadores. | "administración" → "admin"; "Esta área es solo para" → "Esto es solo pa'" |
| `auth.verificationSetup.description` | Add a second factor to keep your account secure. You can skip for no… | Agrega un segundo factor para mantener tu cuenta segura. Puedes omiti… | tone-drift-formal | Agrega un segundo factor pa' mantener tu cuenta segura. Si quieres lo haces después. | "para" → "pa'"; "Puedes omitirlo ahora y configurarlo después" → shorter norteño |
| `auth.verificationSetup.skipDescription` | You can set this up later from your account settings. | Puedes configurar esto después desde los ajustes de tu cuenta. | tone-drift-formal | Lo puedes configurar después desde los ajustes de tu cuenta. | Minor — fronting "lo" is more natural norteño word order |
| `auth.login.passkeyButton` | Sign in with passkey | Iniciar sesión con clave de acceso | tone-drift-formal | Entrar con clave de acceso | "Iniciar sesión" → "Entrar" (matches signInButton which already uses "Entrar") |
| `feedPage.upcomingVirtualEventDescription` | A global virtual gathering hosted by the AWS community. Open to all.… | Una reunión virtual global organizada por la comunidad AWS. Abierta a… | tone-drift-formal | Reunión virtual global de la comunidad AWS. Abierta a todos. Únete al stream y conecta con builders de todo el mundo. | Drop "Una…organizada por" → direct; "transmisión en vivo" → "stream" (Spanglish, matches norteño) |
| `feedPage.pastMeetupIntroP2` | Join us for a special event where you will get to know the AWS Commu… | Te invitamos a un evento especial donde conocerás el programa AWS Com… | tone-drift-formal | Cáele a un evento especial donde vas a conocer el programa AWS Community Builders de la mano de Community Builders de LATAM que llevan años compartiendo y aprovechando los beneficios del programa. | "Te invitamos" → "Cáele" (matches existing featuredEvent tone); "conocerás" → "vas a conocer" |
| `auth.signup.passwordPolicy` | At least 12 characters with uppercase, lowercase, and numbers. | Mínimo 12 caracteres con mayúsculas, minúsculas y números. | tone-drift-formal | Mínimo 12 caracteres con mayúsculas, minúsculas y números. | Actually fine — technical constraint, formal is appropriate. No change. |
| `helpPanel.jacobWrightBio` | Voice + communication systems expert with 10 years of experience int… | Experto en sistemas de voz y comunicación con 10 años de experiencia… | tone-drift-formal | Experto en sistemas de voz y comunicación con 10 años integrando IA en sistemas críticos. Polímata Aggie de NMSU, inventor con bases en Física, Ingeniería Eléctrica, Mates y Astronomía. Trae especialidades en programación, observabilidad y seguridad, combinando edge devices, robótica y cloud resiliente en eventos como AWS re:Invent y CES. Mentor certificado en AWS y liderazgo Ágil | "Matemáticas" → "Mates" (norteño shortening); tighter phrasing overall |
| `helpPanel.bryanChaskoBio` | Builder-focused organizer based in El Paso. AWS Hero recognition for… | Organizador enfocado en builders, radicado en El Paso. Reconocimiento… | tone-drift-formal | Organizador enfocado en builders, radicado en El Paso. AWS Hero por contribuciones a la comunidad en la frontera. Crea contenido práctico de contenedores, serverless e IA/ML. Coordina la programación técnica y el pipeline de speakers del grupo | "Reconocimiento AWS Hero por contribuciones a la comunidad en la región fronteriza" → shorter; "región fronteriza" → "la frontera" (how norteños actually say it) |
| `feedPage.pastMeetupSpeaker1Role` | Technical Leader / Cloud Engineer + Global Team Leader. Helps compan… | Technical Leader / Cloud Engineer + Global Team Leader. Ayuda a empre… | tone-drift-formal | Technical Leader / Cloud Engineer + Global Team Leader. Ayuda a empresas a operar en la nube y enseña a equipos a jalar entre países y culturas. Mentora a mujeres y comparte en charlas comunitarias. | "colaborar" → "jalar" (norteño for working together) |
| `feedPage.pastMeetupSpeaker3Role` | Cloud Coach + Women in Tech Mentor. Walks alongside new folks and te… | Cloud Coach + Women in Tech Mentor. Acompaña a personas y equipos nue… | tone-drift-formal | Cloud Coach + Women in Tech Mentor. Acompaña a raza nueva y equipos mientras aprenden la nube, enfocándose en claridad, confianza y crecimiento. | "personas" → "raza nueva" (matches existing "raza" usage in file) |
| `auth.verificationSetup.totpDescription` | Use Google Authenticator, Microsoft Authenticator, or Authy to gener… | Usa Google Authenticator, Microsoft Authenticator o Authy para genera… | tone-drift-formal | Usa Google Authenticator, Microsoft Authenticator o Authy pa' generar códigos de 6 dígitos. | "para" → "pa'" in casual context |
| `auth.verificationSetup.passkeyDescription` | Sign in with Face ID, fingerprint, or Windows Hello — no password ne… | Inicia sesión con Face ID, huella dactilar o Windows Hello — sin cont… | tone-drift-formal | Entra con Face ID, huella o Windows Hello — sin contraseña. | "Inicia sesión" → "Entra"; "huella dactilar" → "huella" (everyone says just "huella") |

**Net Tier 3 findings requiring action: 20**

---

## Tier 4: Punctuation + Accent Drift

| Key path | en-US value | es-MX value | Finding | Proposed norteño value | Rationale |
|----------|-------------|-------------|---------|------------------------|-----------|
| `auth.sessionExpired.title` | Your session has expired | Su sesión ha expirado | accent-missing | Tu sesión expiró | "sesión" accent is correct; issue is tone (covered in Tier 3) |
| `navigation.cacheable` | cacheable | cacheable | accent-missing | cacheable | Technical term — no accent needed. No action. |
| `feedPage.featuredEventDescription` | …grab a Lyft, ride a bike, or pull on up for finger-foods… | …píllate un Lyft, en bici, o tráete tu nave para finger-foods… | accent-missing | (no change) | Accents on "píllate" and "tráete" are correct ✓ |
| `shell.siteTitle` | Cloud Del Norte | Nube of the North | accent-missing | (no change) | No accent issue |
| `feedPage.nextMeetupLoading` | Loading meetup info… | Cargando información del meetup… | accent-missing | Cargando info del meetup… | "información" → "info" (shorter, norteño); accent on "ó" is correct ✓ |

**Net Tier 4 findings requiring action: 0** (accents are well-maintained across the file — no systemic drift detected)

---

## Tier 5: Structural Gaps

Keys present in en-US but missing from es-MX.

| Key path | en-US value | es-MX value | Finding | Proposed norteño value | Rationale |
|----------|-------------|-------------|---------|------------------------|-----------|
| — | — | — | — | — | — |

**Net Tier 5 findings requiring action: 0** (key structures are identical per the coverage test — both files have the same key tree)

---

## Summary

| Tier | Category | Keys flagged | Keys requiring action |
|------|----------|-------------|----------------------|
| 1 | Identical / English-leaked | 7 | 2 |
| 2 | Stale (wave 36+) | 5 | 0 (all appear synced) |
| 3 | Tone drift from norteño | 22 | 20 |
| 4 | Punctuation + accent drift | 5 | 0 |
| 5 | Structural gaps | 0 | 0 |
| **Total** | | **39** | **22** |

---

## Top 5 Highest-Impact Findings

1. **`auth.sessionExpired.*` + `awsug.meetings.pendingJoinError`** — These use usted (Su/Podrá/inicie) which is jarring in a site that otherwise tutea the user. Immediate tone break for any Spanish-mode user.

2. **`meetings.connection.permissionBlocked.body`** — "Haga clic" is usted-form in a real-time UX moment (camera blocked). User is already stressed; formal tone makes it worse. "Dale clic al candadito" is warmer.

3. **`feedPage.pastMeetupIntroP2`** — "Te invitamos" is polite-neutral while the surrounding event copy uses "cáele", "píllate", "tráete tu nave". Tone whiplash within the same card.

4. **`awsug.meetings.pendingJoinError`** — Only remaining usted-form string in the entire AWSUG flow. Every other string in that section uses tú. Inconsistency will confuse users.

5. **`maintenanceCalendar.releaseNotes`** — Untranslated English label visible in Spanish mode. Low-effort fix: "Notas de release" keeps the loanword but translates the noun.

---

*Generated by wave-47-spanish-audit session. Bryan reviews + picks per-row before a follow-up wave applies changes.*
