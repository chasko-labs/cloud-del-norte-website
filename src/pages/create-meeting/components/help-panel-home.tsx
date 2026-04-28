import * as React from 'react';
import HelpPanel from '@cloudscape-design/components/help-panel';
import Icon from '@cloudscape-design/components/icon';
import Link from '@cloudscape-design/components/link';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useTranslation } from '../../../hooks/useTranslation';

export const HelpPanelHome = () => {
  const { t } = useTranslation();

  return (
    <HelpPanel header={<h2>{t('helpPanel.userGroupTitle')}</h2>}>
      <SpaceBetween size="l">
        <div>
          <p>{t('helpPanel.communityDescription')}</p>
        </div>

        <div>
          <h3>{t('helpPanel.organizersWantedHeader')}</h3>
          <p>{t('helpPanel.organizersWantedIntro')}</p>
          <ul>
            <li>
              <strong>{t('helpPanel.aslLeadRole')}</strong> — {t('helpPanel.aslLeadDesc')}
            </li>
            <li>
              <strong>LSM Lead</strong> — {t('helpPanel.lsmLeadDesc')}
            </li>
            <li>{t('helpPanel.spanishSpeakers')}</li>
            <li>{t('helpPanel.studentsStepUp')}</li>
            <li>{t('helpPanel.womenWelcome')}</li>
          </ul>
          <p>
            <Link href="https://www.meetup.com/awsugclouddelnorte/" external>
              {t('helpPanel.reachOutOnMeetup')} <Icon name="external" />
            </Link>
          </p>
        </div>

        <div>
          <h4>{t('helpPanel.globalCommunityHeader')}</h4>
          <Link href="https://www.meetup.com/pro/global-aws-user-group-community/" external>
            {t('helpPanel.findLocalGroup')} <Icon name="external" />
          </Link>
        </div>

        <div>
          <h3>{t('helpPanel.rsvpHeader')}</h3>
          <ul>
            <li>
              <a target="_blank" rel="noopener noreferrer" href="https://www.meetup.com/awsugclouddelnorte/">
                {t('helpPanel.cloudDelNorteMeetups')} <Icon name="external" />
              </a>
            </li>
            <li>
              <a href="/home/index.html">{t('helpPanel.aboutPage')}</a>
            </li>
          </ul>
        </div>

        <div>
          <h3>{t('helpPanel.communityLeaders')}</h3>

          <div className="help-panel-leader">
            <strong>Andres Moreno</strong>
            <span className="help-panel-leader__role">{t('helpPanel.andresMorenoRole')}</span>
            <p>
              {t('helpPanel.andresMorenoBioPrefix')}{' '}
              <Link href="https://andmoredev.medium.com/" external>
                andmoredev.medium.com
              </Link>{' '}
              {t('helpPanel.andresMorenoBioSuffix')}
            </p>
            <ul>
              <li>
                <Link href="https://andmore.dev" external>
                  andmore.dev <Icon name="external" />
                </Link>
              </li>
              <li>
                <Link href="https://x.com/andmoredev" external>
                  X @andmoredev <Icon name="external" />
                </Link>
              </li>
              <li>
                <Link href="https://github.com/andmoredev" external>
                  GitHub @andmoredev <Icon name="external" />
                </Link>
              </li>
            </ul>
          </div>

          <div className="help-panel-leader">
            <strong>Bryan Chasko</strong>
            <span className="help-panel-leader__role">{t('helpPanel.bryanChaskoRole')}</span>
            <ul>
              <li>
                <Link href="https://aws.amazon.com/developer/community/heroes/bryan-chasko/" external>
                  {t('helpPanel.awsHeroProfile')} <Icon name="external" />
                </Link>
              </li>
              <li>
                <Link href="https://bryanchasko.com" external>
                  bryanchasko.com <Icon name="external" />
                </Link>
              </li>
              <li>
                <Link href="https://github.com/BryanChasko" external>
                  GitHub @BryanChasko <Icon name="external" />
                </Link>
              </li>
            </ul>
          </div>

          <div className="help-panel-leader">
            <strong>Jacob Wright</strong>
            <span className="help-panel-leader__role">{t('helpPanel.jacobWrightRole')}</span>
            <p>{t('helpPanel.jacobWrightBio')}</p>
            <ul>
              <li>
                <Link href="https://www.linkedin.com/in/jrwright121" external>
                  LinkedIn <Icon name="external" />
                </Link>
              </li>
            </ul>
          </div>

          <div className="help-panel-leader">
            <strong>Wayne Savage</strong>
            <span className="help-panel-leader__role">{t('helpPanel.wayneSavageRole')}</span>
            <p>
              {t('helpPanel.wayneSavageBioPrefix')}{' '}
              <Link href="https://arrowheadcenter.nmsu.edu/" external>
                {t('helpPanel.arrowheadPark')}
              </Link>{' '}
              {t('helpPanel.wayneSavageBioSuffix')}
            </p>
          </div>
        </div>
      </SpaceBetween>
    </HelpPanel>
  );
};
