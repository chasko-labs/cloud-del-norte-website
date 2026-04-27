import * as React from 'react';
import HelpPanel from '@cloudscape-design/components/help-panel';
import Icon from '@cloudscape-design/components/icon';
import { useTranslation } from '../../../hooks/useTranslation';

export const HelpPanelHome = () => {
  const { t } = useTranslation();

  return (
    <HelpPanel
      footer={
        <div>
          <h3>{t('helpPanel.rsvpHeader')}</h3>
          <ul>
            <li>
              <a target="_blank" href="https://meetup.com/AWSSelfTaught">
                {t('helpPanel.cloudDelNorteMeetups')} <Icon name="external" />
              </a>
            </li>
            <li>
              <a target="_blank" href="https://meetup.com/BostonBlender">
                {t('helpPanel.blenderMeetups')} <Icon name="external" />
              </a>
            </li>
            <li>
              <a href="/home/index.html">{t('helpPanel.aboutPage')}</a>
            </li>
          </ul>
        </div>
      }
      header={<h2>{t('helpPanel.userGroupTitle')}</h2>}
    >
      <div>
        <p>{t('helpPanel.communityDescription')}</p>

        <h3>{t('helpPanel.organizersWantedHeader')}</h3>
        <ul>
          <li>{t('helpPanel.spanishSpeakers')}</li>
          <li>{t('helpPanel.studentsStepUp')}</li>
          <li>{t('helpPanel.womenWelcome')}</li>
        </ul>

        <h4>{t('helpPanel.globalCommunityHeader')}</h4>
        <pre>
          <a target="_blank" href="https://www.meetup.com/pro/global-aws-user-group-community/">
            {t('helpPanel.findLocalGroup')}
            <Icon name="external" />
          </a>
        </pre>

        <h5>{t('helpPanel.communityLeadersHeader')}</h5>
        <dl>
          <dt>{t('helpPanel.jacobWright')}</dt>
          <dd>
            <a target="_blank" href="https://www.linkedin.com/in/jrwright121">
              {t('helpPanel.reachOutLinkedIn')} <Icon name="external" />
            </a>
          </dd>
          <dt>{t('helpPanel.bryanChasko')}</dt>
          <dd>
            <a target="_blank" href="https://aws.amazon.com/developer/community/heroes/bryan-chasko/">
              {t('helpPanel.awsHeroBio')} <Icon name="external" />
            </a>
          </dd>
          <dd>
            <a target="_blank" href="https://bryanchasko.com">
              {t('helpPanel.bryansHomepage')} <Icon name="external" />
            </a>
          </dd>
          <dt>{t('helpPanel.andresMoreno')}</dt>
          <dd>{t('helpPanel.andresRole')}</dd>
          <dd>
            <a target="_blank" href="https://andmore.dev">
              {t('helpPanel.andresWebsite')} <Icon name="external" />
            </a>
          </dd>
        </dl>
      </div>
    </HelpPanel>
  );
};
