# Quantum Computing Workshop — User Experience Walkthrough

Captured: 2026-08-10 via Playwright (headless Chromium, 1280×800 viewport, dark mode default)

Screenshots live at: `https://dev.clouddelnorte.org/_previews/walkthrough/`

---

## 1. Landing Page — quantum.clouddelnorte.org

![Landing page](https://dev.clouddelnorte.org/_previews/walkthrough/01-landing.png)

The user arrives at **quantum.clouddelnorte.org**. They see:
- "LIVE ONLINE WORKSHOP · IN-PERSON HUBS AVAILABLE" badge
- "Hands-On Amazon Braket Workshop" title
- Date/time, bilingual note
- Hosts: Christian Perez (HOST, CEO, Clarksville), Amelia Hough-Ross (CDO, Columbia), Bryan Chasko (CTO, Cloud Del Norte)
- "Register for Workshop" CTA → takes them to /register/
- Theme toggle (sun/moon) + locale toggle (🇺🇸↔🇲🇽) in the top bar

---

## 2. Registration Form — quantum.clouddelnorte.org/register/

![Register form](https://dev.clouddelnorte.org/_previews/walkthrough/02-register.png)

Clean event registration. No passwords, no Cognito account creation. Just:
- Email
- Name
- Which group are you from? (optional)

---

## 3. Form Filled

![Form filled](https://dev.clouddelnorte.org/_previews/walkthrough/03-form-filled.png)

User fills in their email and name. Group affiliation is optional.

---

## 4. Registration Success

![Success](https://dev.clouddelnorte.org/_previews/walkthrough/04-success.png)

Immediate confirmation with:
- Checkmark animation
- "You're registered!" 
- Event date reminder
- Bookmark instruction (meeting link will be posted here on event day)

---

## 5. Login Page — auth.clouddelnorte.org

![Login page](https://dev.clouddelnorte.org/_previews/walkthrough/05-login.png)

For users who want full Cloud Del Norte membership (access to meetings, future workshops, community features), they create an account via the auth subdomain. Context: "Sign in — quantum computing workshop Aug 30"

---

## 6. Login Filled

![Login filled](https://dev.clouddelnorte.org/_previews/walkthrough/06-login-filled.png)

Existing member signs in with email + password. Passkey sign-in also available.

---

## 7. Post-Login — Redirected to Feed

![Post login](https://dev.clouddelnorte.org/_previews/walkthrough/07-post-login.png)

After successful authentication, user lands on the main clouddelnorte.org feed. The "Next workshop" card is prominently displayed with countdown to the quantum event.

---

## 8. Meetings Page — awsug.clouddelnorte.org/meetings/

![Meetings](https://dev.clouddelnorte.org/_previews/walkthrough/08-meetings.png)

Authenticated members access the meetings page where they can join live calls via Jitsi (meet.clouddelnorte.org). The "join call in progress" button appears when a meeting is active.

---

## 9. Feed — Featured Quantum Event

![Feed](https://dev.clouddelnorte.org/_previews/walkthrough/09-feed.png)

The main feed prominently features the quantum workshop with countdown timer and direct link to quantum.clouddelnorte.org.

---

## 10. Light Mode

![Light mode](https://dev.clouddelnorte.org/_previews/walkthrough/10-light-mode.png)

Full light mode support — cream/parchment backgrounds, warm shadows, all text maintains WCAG AA contrast.

---

## 11. Spanish Locale

![Spanish](https://dev.clouddelnorte.org/_previews/walkthrough/11-spanish.png)

Flag toggle switches all content to norteño Spanish. Bilingual workshop with accommodations for English and Spanish speakers.

---

## User Journey Summary

```
quantum.clouddelnorte.org
    │
    ├─→ /register/ (event-only: email + name → done)
    │       └─→ Success: "You're registered!"
    │
    └─→ "Join Cloud Del Norte" link
            │
            ├─→ auth.clouddelnorte.org/signup/ (full membership)
            │       └─→ Email verify → pending approval
            │               └─→ Admin approves → member
            │                       └─→ awsug.clouddelnorte.org/meetings/
            │                               └─→ "join call" → Jitsi room
            │
            └─→ auth.clouddelnorte.org/login/ (existing members)
                    └─→ clouddelnorte.org → meetings → join call
```

## Infrastructure

| Surface | URL | Purpose |
| --- | --- | --- |
| Event landing | quantum.clouddelnorte.org | Workshop info + registration |
| Registration | quantum.clouddelnorte.org/register/ | Event signup form |
| Full signup | auth.clouddelnorte.org/signup/ | CDN membership |
| Login | auth.clouddelnorte.org/login/ | Existing members |
| Feed | clouddelnorte.org | Main site with featured event |
| Meetings | awsug.clouddelnorte.org/meetings/ | Join live calls |
| Video | meet.clouddelnorte.org | Jitsi rooms (JWT-gated) |
