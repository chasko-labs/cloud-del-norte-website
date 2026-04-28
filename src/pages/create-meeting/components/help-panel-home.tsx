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
            In-person, virtual, and hybrid meetups across the Juárez MX / El Paso and Las Cruces corridor, all of New
            Mexico, and surrounding rural areas. Founded on International Women&apos;s Day — March 8, 2021 — at{' '}
            <Link href="https://arrowheadcenter.nmsu.edu/" external>
              Arrowhead Research Park
            </Link>
            , NMSU.
          </p>
        </div>

        <div>
          <h3>Community Leaders</h3>

          <div className="help-panel-leader">
            <strong>Andres Moreno</strong>
            <span className="help-panel-leader__role">Co-organizer · AWS Community Builder</span>
            <p>
              Principal Software Architect at Caylent. Serverless specialist — Lambda, Step Functions, CI/CD, and
              developer experience. Writes at{' '}
              <Link href="https://andmoredev.medium.com/" external>
                andmoredev.medium.com
              </Link>{' '}
              on real-world serverless patterns from production systems.
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
            <span className="help-panel-leader__role">Founder · AWS Hero · AWS Content Builder</span>
            <p>
              Builder-focused organizer based in El Paso. AWS Hero recognition for community contributions across the
              US/MX border region. Creates hands-on content around containers, serverless, and AI/ML infrastructure.
              Runs the group&apos;s technical programming and speaker pipeline.
            </p>
            <ul>
              <li>
                <Link href="https://aws.amazon.com/developer/community/heroes/bryan-chasko/" external>
                  AWS Hero profile <Icon name="external" />
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
            <span className="help-panel-leader__role">Founder · Doña Ana County Lead</span>
            <p>
              Co-founded the group in Las Cruces. Anchor for the Doña Ana County and southern New Mexico chapter — the
              geographic spine connecting El Paso and Albuquerque for the group&apos;s in-person events.
            </p>
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
            <span className="help-panel-leader__role">Founder · Retired Organizer</span>
            <p>
              Part of the founding team. Connected the group to{' '}
              <Link href="https://arrowheadcenter.nmsu.edu/" external>
                Arrowhead Research Park
              </Link>{' '}
              at NMSU, where the first meetup took place. The Arrowhead partnership remains a thread in the group&apos;s
              New Mexico roots.
            </p>
          </div>
        </div>

        <div>
          <h3>{t('helpPanel.organizersWantedHeader')}</h3>
          <p>Cloud del Norte is a volunteer-run group. These roles are open:</p>
          <ul>
            <li>
              <strong>ASL Lead</strong> — coordinate American Sign Language interpretation for events, advocate for
              accessibility in session planning
            </li>
            <li>
              <strong>LSM Lead</strong> — Lengua de Señas Mexicana — conectar la comunidad sorda de Juárez con los
              eventos del grupo
            </li>
            <li>{t('helpPanel.spanishSpeakers')}</li>
            <li>{t('helpPanel.studentsStepUp')}</li>
            <li>{t('helpPanel.womenWelcome')}</li>
          </ul>
          <p>
            <Link href="https://www.meetup.com/awsugclouddelnorte/" external>
              Reach out on Meetup <Icon name="external" />
            </Link>
          </p>
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
