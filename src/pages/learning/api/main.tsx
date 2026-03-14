import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppLayout, TopNavigation, BreadcrumbGroup } from '@cloudscape-design/components';
import '@cloudscape-design/global-styles/index.css';
import '../../../styles/tokens.css';
import Navigation from '../../../components/navigation';
import RiftRewindDashboard from './RiftRewindDashboard';
import { LocaleProvider } from '../../../contexts/locale-context';
import { initializeLocale, type Locale } from '../../../utils/locale';
import enUS from '../../../locales/en-US.json';
import esMX from '../../../locales/es-MX.json';

const App: React.FC = () => {
  const locale: Locale = initializeLocale();
  const translations = locale === 'mx' ? esMX : enUS;
  const t = (key: string) => {
    const keys = key.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let value: any = translations;
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  };

  return (
    <LocaleProvider locale={locale}>
      <TopNavigation
        identity={{
          href: '/home/index.html',
          title: 'Cloud Del Norte'
        }}
        utilities={[
          {
            type: 'button',
            text: 'GitHub',
            href: 'https://github.com/BryanChasko/rift-rewind-aws-riot-games-hackathon',
            external: true
          }
        ]}
      />
      <AppLayout
        navigation={<Navigation />}
        breadcrumbs={
          <BreadcrumbGroup
            items={[
              { text: t('breadcrumbs.home'), href: '/home/index.html' },
              { text: t('navigation.learning'), href: '#' },
              { text: t('navigation.apiGuide'), href: '/learning/api/' }
            ]}
          />
        }
        content={<RiftRewindDashboard />}
        toolsHide
      />
    </LocaleProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);