import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppLayout, TopNavigation, BreadcrumbGroup } from '@cloudscape-design/components';
import '@cloudscape-design/global-styles/index.css';
import Navigation from '../../../components/navigation';
import RiftRewindDashboard from './RiftRewindDashboard';

const App: React.FC = () => {
  return (
    <>
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
              { text: 'Home', href: '/home/index.html' },
              { text: 'Learning', href: '#' },
              { text: 'API', href: '/learning/api/' }
            ]}
          />
        }
        content={<RiftRewindDashboard />}
        toolsHide
      />
    </>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);