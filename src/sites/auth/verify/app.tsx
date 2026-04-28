// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useEffect, useRef, useState } from 'react';
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
import { confirmSignUp, resendConfirmationCode, AuthError, assertNonEmpty } from '../../../lib/cognito';
import AuthLayout from '../_layout';

const RESEND_COOLDOWN_SECS = 30;

function VerifyForm() {
  const { t } = useTranslation();
  document.title = t('auth.verify.title') + ' — ' + t('auth.siteTitle');

  const [email] = useState(() => new URLSearchParams(window.location.search).get('email') ?? '');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    },
    [],
  );

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN_SECS);
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCodeError('');
    setFormError('');
    try {
      assertNonEmpty(code, t('auth.verify.codeLabel'));
    } catch {
      setCodeError(t('auth.verify.codeLabel') + ' is required');
      return;
    }
    setLoading(true);
    try {
      await confirmSignUp(email, code.trim());
      setDone(true);
    } catch (err) {
      if (err instanceof AuthError) {
        if (err.code === 'CodeMismatchException') {
          setCodeError('Incorrect code — check your email and try again');
        } else if (err.code === 'ExpiredCodeException') {
          setCodeError('Code expired — request a new one below');
        } else if (err.code === 'NotAuthorizedException') {
          setFormError('This account is already confirmed. Sign in instead.');
        } else {
          setFormError(t('auth.verify.genericError'));
        }
      } else {
        setFormError(t('auth.verify.genericError'));
      }
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || !email) return;
    try {
      await resendConfirmationCode(email);
      startCooldown();
    } catch {
      /* best effort */
    }
  }

  if (done) {
    return (
      <Container>
        <SpaceBetween size="m">
          <Alert type="success">Email confirmed — you can now sign in.</Alert>
          <Box textAlign="center">
            <Link href="/login/index.html">Sign in</Link>
          </Box>
        </SpaceBetween>
      </Container>
    );
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
            <Button formAction="submit" variant="primary" loading={loading}>
              {t('auth.verify.confirmButton')}
            </Button>
          }
          errorText={formError || undefined}
        >
          <SpaceBetween size="m">
            {email && <Box>{t('auth.verify.description').replace('{{email}}', email)}</Box>}
            <FormField label={t('auth.verify.codeLabel')} errorText={codeError || undefined}>
              <Input
                value={code}
                onChange={({ detail }) => setCode(detail.value)}
                placeholder={t('auth.verify.codePlaceholder')}
                inputMode="numeric"
                autoFocus
              />
            </FormField>
            <Link
              onFollow={() => {
                void handleResend();
              }}
              variant={cooldown > 0 ? 'secondary' : 'primary'}
            >
              {cooldown > 0 ? `Resend available in ${cooldown}s` : t('auth.verify.resendCode')}
            </Link>
          </SpaceBetween>
        </Form>
      </form>
      <Box margin={{ top: 'm' }} textAlign="center">
        <Link href="/login/index.html">Back to sign in</Link>
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
        <VerifyForm />
      </AuthLayout>
    </LocaleProvider>
  );
}
