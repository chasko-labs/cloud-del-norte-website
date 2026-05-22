# cognito auth

user authentication for cloud del norte via amazon cognito user pools.

## pool details

| field | value |
|---|---|
| pool name | cloud-del-norte-members |
| pool id | us-west-2_cyPQF4F3r |
| account | 170473530355 (jitsi-video-hosting) |
| region | us-west-2 |
| client id | 57eikmt418ea6vti2f6h0pl74r |
| client name | clouddelnorte-portal-spa |

## auth flows enabled

- USER_PASSWORD_AUTH (primary — custom login form)
- USER_SRP_AUTH (available but unused)
- REFRESH_TOKEN_AUTH (token refresh)

## mfa

- configuration: ON (required for all users)
- type: SOFTWARE_TOKEN (TOTP authenticator app)
- first login triggers MFA_SETUP challenge

## password policy

- minimum length: 12
- requires: uppercase + lowercase + numbers + symbols
- temporary password validity: 3 days

## user attributes

| attribute | type | required |
|---|---|---|
| email | standard | yes (username alias) |
| name | standard | yes |
| custom:member_type | custom | no |
| custom:location | custom | no |
| custom:topics | custom | no |
| custom:background | custom | no |

## login flow

1. InitiateAuth (USER_PASSWORD_AUTH) with email + password
2. first login: MFA_SETUP challenge
   - AssociateSoftwareToken -> get TOTP secret
   - VerifySoftwareToken -> confirm TOTP code
   - RespondToAuthChallenge (MFA_SETUP) -> tokens issued
3. subsequent logins: SOFTWARE_TOKEN_MFA challenge
   - RespondToAuthChallenge with TOTP code -> tokens issued

## token configuration

| token | validity |
|---|---|
| access token | 60 minutes |
| id token | 60 minutes |
| refresh token | 43200 minutes (30 days) |

## email verification

- auto-verified attributes: email
- verification method: CONFIRM_WITH_CODE (6-digit code)
- email sender: COGNITO_DEFAULT (no-reply@verificationemail.com)
- delivery: email sent on SignUp, user confirms via ConfirmSignUp API

## admin operations

{
    "Users": [
        {
            "Username": "58315330-f091-7008-ae3b-4033fecd6811",
            "Attributes": [
                {
                    "Name": "email",
                    "Value": "bryanj+clouddelnorte@abstractspacecraft.com"
                },
                {
                    "Name": "email_verified",
                    "Value": "true"
                },
                {
                    "Name": "sub",
                    "Value": "58315330-f091-7008-ae3b-4033fecd6811"
                }
            ],
            "UserCreateDate": "2026-04-23T13:10:42.603000-06:00",
            "UserLastModifiedDate": "2026-05-06T19:32:44.792000-06:00",
            "Enabled": true,
            "UserStatus": "CONFIRMED"
        },
        {
            "Username": "a8718320-a041-7051-8dbc-cb405600c1c5",
            "Attributes": [
                {
                    "Name": "email",
                    "Value": "bryan@clouddelnorte.org"
                },
                {
                    "Name": "email_verified",
                    "Value": "true"
                },
                {
                    "Name": "name",
                    "Value": "Bryan Test"
                },
                {
                    "Name": "sub",
                    "Value": "a8718320-a041-7051-8dbc-cb405600c1c5"
                }
            ],
            "UserCreateDate": "2026-05-07T14:45:39.357000-06:00",
            "UserLastModifiedDate": "2026-05-07T14:48:53.468000-06:00",
            "Enabled": true,
            "UserStatus": "CONFIRMED"
        },
        {
            "Username": "f8012330-2031-7024-dfc4-718ada639fac",
            "Attributes": [
                {
                    "Name": "email",
                    "Value": "bryanj+clouddelnortetest1@abstractspacecraft.com"
                },
                {
                    "Name": "email_verified",
                    "Value": "false"
                },
                {
                    "Name": "name",
                    "Value": "Smoketest Bot"
                },
                {
                    "Name": "sub",
                    "Value": "f8012330-2031-7024-dfc4-718ada639fac"
                }
            ],
            "UserCreateDate": "2026-05-06T15:58:59.717000-06:00",
            "UserLastModifiedDate": "2026-05-06T15:59:05.819000-06:00",
            "Enabled": true,
            "UserStatus": "CONFIRMED"
        },
        {
            "Username": "a8d1e3d0-d081-70fa-3302-a65be03022be",
            "Attributes": [
                {
                    "Name": "email",
                    "Value": "test@example.com"
                },
                {
                    "Name": "email_verified",
                    "Value": "false"
                },
                {
                    "Name": "name",
                    "Value": "Test User"
                },
                {
                    "Name": "sub",
                    "Value": "a8d1e3d0-d081-70fa-3302-a65be03022be"
                }
            ],
            "UserCreateDate": "2026-05-07T07:11:19.308000-06:00",
            "UserLastModifiedDate": "2026-05-07T07:11:19.308000-06:00",
            "Enabled": true,
            "UserStatus": "UNCONFIRMED"
        }
    ]
}

## test user

- email: bryan@clouddelnorte.org
- status: CONFIRMED, email_verified=true, MFA configured
- sub: a8718320-a041-7051-8dbc-cb405600c1c5
- created: 2026-05-07

## change log

### 2026-05-22 — wave 89: software token MFA set to OPTIONAL (stratia)

As part of Wave 89 TOTP enrollment UI work, software token MFA was explicitly enabled on pool `us-west-2_cyPQF4F3r` with `MfaConfiguration=OPTIONAL`. Pre-state showed `MfaConfiguration: OPTIONAL` already (pool was not in a fully broken state), but `SoftwareTokenMfaConfiguration.Enabled` was re-asserted to ensure the TOTP enrollment flow functions correctly for the new UI. Existing users are not forced into MFA mid-session. Pre/post JSON evidence captured at `/tmp/wave89-cognito-pre.json` and `/tmp/wave89-cognito-post.json`.

```
aws cognito-idp set-user-pool-mfa-config \
  --user-pool-id us-west-2_cyPQF4F3r \
  --software-token-mfa-configuration Enabled=true \
  --mfa-configuration OPTIONAL \
  --profile jitsi-video-hosting-170473530355 \
  --region us-west-2
```
