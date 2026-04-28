// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useState } from 'react';
import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Link from '@cloudscape-design/components/link';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { LocaleProvider } from '../../../contexts/locale-context';
import { useTranslation } from '../../../hooks/useTranslation';
import { initializeLocale, applyLocale, setStoredLocale, type Locale } from '../../../utils/locale';
import { signInWithPassword, AuthError, assertNonEmpty } from '../../../lib/cognito';
import AuthLayout from '../_layout';

const AWSUG_ORIGIN = 'https://awsug.clouddelnorte.org';

function LoginForm() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  document.title = t('auth.login.title') + ' — ' + t('auth.siteTitle');

  function validate(): boolean {
    let valid = true;
    setEmailError('');
    setPasswordError('');
    try {
      assertNonEmpty(email, t('auth.login.emailLabel'));
    } catch {
      setEmailError(t('auth.login.emailLabel') + ' is required');
      valid = false;
    }
    try {
      assertNonEmpty(password, t('auth.login.passwordLabel'));
    } catch {
      setPasswordError(t('auth.login.passwordLabel') + ' is required');
      valid = false;
    }
    return valid;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setFormError('');
    try {
      await signInWithPassword(email, password);
      // Pass tokens to awsug via URL fragment; awsug/auth/redeem strips them immediately.
      const idToken = sessionStorage.getItem('cdn.idToken') ?? '';
      const accessToken = sessionStorage.getItem('cdn.accessToken') ?? '';
      const refreshToken = sessionStorage.getItem('cdn.refreshToken') ?? '';
      const fragment = `id_token=${encodeURIComponent(idToken)}&access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}`;
      window.location.assign(`${AWSUG_ORIGIN}/auth/redeem/index.html#${fragment}`);
    } catch (err) {
      if (err instanceof AuthError && (err.code === 'NotAuthorizedException' || err.code === 'UserNotFoundException')) {
        setFormError(t('auth.login.invalidCredentials'));
      } else {
        setFormError(t('auth.login.genericError'));
      }
      setLoading(false);
    }
  }

  return (
    <Container>
      <form
        onSubmit={e => {
          void handleSubmit(e);
        }}
        noValidate
      >
        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button formAction="submit" variant="primary" loading={loading}>
                {t('auth.login.signInButton')}
              </Button>
            </SpaceBetween>
          }
          errorText={formError || undefined}
        >
          <SpaceBetween size="m">
            {formError && <Alert type="error">{formError}</Alert>}
            <FormField label={t('auth.login.emailLabel')} errorText={emailError || undefined}>
              <Input
                type="email"
                value={email}
                onChange={({ detail }) => setEmail(detail.value)}
                placeholder={t('auth.login.emailPlaceholder')}
                autoFocus
                inputMode="email"
              />
            </FormField>
            <FormField label={t('auth.login.passwordLabel')} errorText={passwordError || undefined}>
              <SpaceBetween size="xs">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={({ detail }) => setPassword(detail.value)}
                />
                <Link onFollow={() => setShowPassword(p => !p)}>
                  {showPassword ? 'Hide password' : 'Show password'}
                </Link>
              </SpaceBetween>
            </FormField>
          </SpaceBetween>
        </Form>
      </form>
      <Box margin={{ top: 'm' }} textAlign="center">
        <SpaceBetween size="xs">
          <Link href="/forgot-password/index.html">{t('auth.login.forgotPassword')}</Link>
          <Link href="/signup/index.html">{t('auth.login.noAccount')}</Link>
        </SpaceBetween>
      </Box>
    </Container>
  );
}

export default function App() {
  const [locale, setLocale] = useState<Locale>(() => initializeLocale());

  function handleLocaleChange(next: Locale) {
    setLocale(next);
    applyLocale(next);
    setStoredLocale(next);
  }
  void handleLocaleChange;

  return (
    <LocaleProvider locale={locale}>
      <AuthLayout>
        <LoginForm />
      </AuthLayout>
    </LocaleProvider>
  );
}
