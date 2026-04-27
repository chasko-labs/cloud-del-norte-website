import * as React from 'react';
import HelpPanel from '@cloudscape-design/components/help-panel';
import Icon from '@cloudscape-design/components/icon';
import Link from '@cloudscape-design/components/link';
import SpaceBetween from '@cloudscape-design/components/space-between';
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
              <a target="_blank" href="https://www.meetup.com/awsugclouddelnorte/">
                {t('helpPanel.cloudDelNorteMeetups')} <Icon name="external" />
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
      <SpaceBetween size="l">
        <div>
          <p>{t('helpPanel.communityDescription')}</p>
          <p>
            We hold in-person, virtual, and hybrid meetups across the Juarez MX / El Paso and Las Cruces corridor, all
            of New Mexico, and surrounding rural areas. Started on International Women&apos;s Day 03/08/21 at{' '}
            <Link href="https://arrowheadcenter.nmsu.edu/" external>
              Arrowhead Research Park
            </Link>
            .
          </p>
        </div>

        <div>
          <h3>Community Leaders</h3>

          <div className="help-panel-leader">
            <strong>Andres Moreno</strong>
            <p>
              Serverless architect and AWS Community Builder. Principal Software Architect at Caylent. Co-organizer of
              Cloud del Norte. Focuses on Lambda, Step Functions, CI/CD, and developer experience.
            </p>
            <ul>
              <li>
                <Link href="https://andmore.dev" external>
                  andmore.dev <Icon name="external" />
                </Link>
              </li>
              <li>
                <Link href="https://andmoredev.medium.com/" external>
                  Medium — andmoredev <Icon name="external" />
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
            <p>Founder and organizer. AWS Hero.</p>
            <ul>
              <li>
                <Link href="https://aws.amazon.com/developer/community/heroes/bryan-chasko/" external>
                  AWS Hero Bio <Icon name="external" />
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
            <p>Founder and Dona Ana County Lead.</p>
            <ul>
              <li>
                <Link href="https://www.linkedin.com/in/jrwright121" external>
                  LinkedIn <Icon name="external" />
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div>
          <h3>{t('helpPanel.organizersWantedHeader')}</h3>
          <ul>
            <li>{t('helpPanel.spanishSpeakers')}</li>
            <li>{t('helpPanel.studentsStepUp')}</li>
            <li>{t('helpPanel.womenWelcome')}</li>
          </ul>
        </div>

        <div>
          <h4>{t('helpPanel.globalCommunityHeader')}</h4>
          <Link href="https://www.meetup.com/pro/global-aws-user-group-community/" external>
            {t('helpPanel.findLocalGroup')} <Icon name="external" />
          </Link>
        </div>
      </SpaceBetween>
    </HelpPanel>
  );
};
