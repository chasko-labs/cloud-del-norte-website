import * as React from "react";
import HelpPanel from "@cloudscape-design/components/help-panel";
import Icon from "@cloudscape-design/components/icon";

export const HelpPanelHome = () => {
    return (
        <HelpPanel
            footer={
                <div>
                    <h3>
                        RSVP for Live Events
                    </h3>
                    <ul>
                        <li>
                            <a target="_blank" href="https://meetup.com/AWSSelfTaught">Cloud Del Norte Meetups <Icon name="external" /></a>
                        </li>
                        <li>
                            <a target="_blank" href="https://meetup.com/BostonBlender">Blender & Graphic Design:NE3D <Icon name="external" /></a>
                        </li>
                    </ul>
                </div>
            }
            header={<h2>☁️ #AWSelfTaught UG</h2>}
        >
            <div>
                <p>
                    <b>AWS UG Cloud Del Norte</b> are self-organized and self-taught learners
                    on a quest to network, experiment, and upskill together. We hold in-person, virtual, and hybrid meetups focusing on regional topics to rural New Mexico, West Texas, Northern Chihuaha, the Borderplex and beyond.
                </p>

                <h3>Organizers Wanted</h3>
                <ul>
                    <li>Spanish-Speakers Sought.</li>
                    <li>Students to Step Up. </li>
                    <li>Women Welcome.</li>
                </ul>

                <h4>AWS Global Community</h4>
                <pre>
                    <a target="_blank" href="https://www.meetup.com/pro/global-aws-user-group-community/">Find your local AWS User Group on Meetup.<Icon name="external" /></a>
                </pre>


                <h5>Community Leaders</h5>
                <dl>
                    <dt>Jacob Wright</dt>
                    <dd><a target="_blank" href="https://www.linkedin.com/in/jrwright121">reach out on LinkedIn <Icon name="external" /></a></dd>
                    <dt>Bryan Chasko</dt>
                    <dd><a target="_blank" href="https://aws.amazon.com/developer/community/heroes/bryan-chasko/">AWS Hero Bio <Icon name="external" /></a></dd>
                    <dd><a target="_blank" href="https://bryanchasko.com">Bryan's HomePage <Icon name="external" /></a></dd>
                </dl>
            </div>
        </HelpPanel>
    );
}
