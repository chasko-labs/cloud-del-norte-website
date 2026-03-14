# cloudscapedesign-aws-usergroup-website

### todos for next time
1. add "split panel header" aka footer to App Layout
see code @ https://cloudscape.design/components/app-layout/?tabId=preview

2. update with more relevant content

3. integrate cognito login

4. integrate chime sdk for video conferencing and streaming to twitch, youtube & linkedin

5. Install testing libraries Jest and React Testing Library


## Overview

This guide outlines the steps to deploy a Cloudscape Design System website using AWS S3 for static website hosting, CloudFront for CDN, and Route 53 for DNS management. The website is hosted at [awsaerospace.org](https://awsaerospace.org).

## Background and Setup

I have configured AWS CLI with the proper access and am using WSL2 with Zsh as my shell, Vim as my terminal editor, and VSCode on Windows 10 with GitHub Copilot as my primary coding assistant. Occasionally, I also use a MacBook with a similar toolchain.

**Lessons Learned from Previous Deployments:**

1. **DNS Propagation:** DNS changes through CDN can take time. It’s effective to launch a basic `index.html` and set up routing before focusing on design and build processes.

2. **S3 Bucket Naming:** For S3 to serve content publicly, the bucket name must match the domain name. For example, `bryanchasko.com` required a bucket named `bryanchasko.com`.

3. **Repository Management:** Use private repos for sensitive data and maintain public repos for open code. Update the private repo regularly to leverage GitHub Copilot effectively.

## About Cloudscape Design System

Cloudscape is an open-source design system from AWS designed to build intuitive, engaging, and inclusive user experiences. This guide will help you set up and deploy a static website using Vite with Cloudscape components.

## Why Choose Vite?

- **Lightweight and Fast:** Offers quick build and development times, ideal for static sites.
- **Simple Integration:** Minimal configuration aligns well with Cloudscape component integration.
- **Static Site Focus:** Outputs a clean `dist` directory, which is easy to deploy to AWS S3.

## Setting Up Your Project

### Install Node.js and npm

Update your package list and install Node.js (which includes npm):

```sh
sudo apt update
sudo apt install -y nodejs npm
```

Verify the installation:

```sh
node -v
npm -v
```

You should see version numbers for both Node.js and npm.

### Create and Configure a Vite Project

1. **Create a Vite Project**

   Navigate to the directory where you want to create your project and run:

```sh
   cd cloudscapedesign-aws-usergroup-website
   npm create vite@latest . --template react
```

**Install Typescript Dependencies:**

```sh
npm install eslint eslint-plugin-react @typescript-eslint/eslint-plugin @typescript-eslint/parser --save-dev
```

**Configure ESLint:**
You can expand your ESLint configuration to include TypeScript-aware linting rules. Update your .eslintrc.js file:

```js
Copy code
import react from 'eslint-plugin-react';
import typescript from '@typescript-eslint/eslint-plugin';

export default {
  parser: '@typescript-eslint/parser',
  plugins: ['react', '@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
  ],
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    // Add custom rules here
  },
};
```

**Update tsconfig.json:**
Ensure your TypeScript configuration (tsconfig.json) includes strict mode and paths to allow ESLint to work correctly:

```json
{
  "compilerOptions": {
    "strict": true,
    "jsx": "react-jsx",
    "esModuleInterop": true
  },
  "include": ["src"]
}
```

2. **Install Cloudscape Packages**

   Install the necessary Cloudscape packages:

```sh
   npm install @cloudscape-design/global-styles @cloudscape-design/components
```

3. **Configure Vite**

vite.config.ts
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname, 'src'),
  publicDir: resolve(__dirname, 'public'),
  plugins: [react()],
  server: {
    port: 8080, 
  },
  build: {
    outDir: resolve(__dirname, 'build'),
    rollupOptions: {
      input: {
        home: resolve(__dirname, 'src/pages/home/index.html'),
        meetups: resolve(__dirname, 'src/pages/meetups/index.html'),
        'submit-event': resolve(__dirname, 'src/pages/submit-event/index.html'),
      },
    },
  },
});
```

4. **Include Cloudscape Styles**
**src/components/AppLayout.tsx**

Configure App Layout

Create a basic layout for your site using the AppLayout component from Cloudscape. This layout includes navigation and content areas, with the footer omitted:

```typescript
import React from 'react';
import { AppLayout } from '@cloudscape-design/components';
import Navigation from './Navigation';
import Content from './Content';

const MyApp: React.FC = () => {
  return (
    <AppLayout
      navigation={<Navigation />}
      content={<Content />}
      headerVariant="default"
      disableContentPaddings
    />
  );
};

export default MyApp;
```

**Create Navigation Component**
**src/components/Navigation.tsx**

Develop a navigation component that links to different sections such as upcoming meetups, past events, and on-demand resources:


```typescript
import React from 'react';

const Navigation: React.FC = () => {
  return (
    <nav>
      <ul>
        <li><a href="#upcoming">Upcoming Meetups</a></li>
        <li><a href="#past">Past Events</a></li>
        <li><a href="#ondemand">On-Demand Resources</a></li>
      </ul>
    </nav>
  );
};

export default Navigation;
```

### Design Content Areas

**Upcoming Meetups**
**src/components/UpcomingMeetups.tsx**

List upcoming meetups with details and links:

```typescript
import React from 'react';

interface Meetup {
  title: string;
  link: string;
  date: string;
}

const UpcomingMeetups: React.FC = () => {
  const meetups: Meetup[] = [
    { title: 'AWS User Group Meeting - August', link: '/events/august-meeting', date: 'August 10, 2024' },
    { title: 'AWS Workshop - September', link: '/events/september-workshop', date: 'September 15, 2024' }
  ];

  return (
    <section id="upcoming">
      <h2>Upcoming Meetups</h2>
      <ul>
        {meetups.map(meetup => (
          <li key={meetup.title}>
            <a href={meetup.link}>{meetup.title}</a> - {meetup.date}
          </li>
        ))}
      </ul>
    </section>
  );
};

export default UpcomingMeetups;
```

**Past Events**
**src/components/PastEvents.tsx**
List past events with links to on-demand recordings if available:

```typescript
import React from 'react';

interface PastEvent {
  title: string;
  link: string;
  date: string;
}

const PastEvents: React.FC = () => {
  const pastEvents: PastEvent[] = [
    { title: 'July AWS Summit', link: '/events/july-summit', date: 'July 20, 2024' }
  ];

  return (
    <section id="past">
      <h2>Past Events</h2>
      <ul>
        {pastEvents.map(event => (
          <li key={event.title}>
            <a href={event.link}>{event.title}</a> - {event.date}
          </li>
        ))}
      </ul>
    </section>
  );
};

export default PastEvents;
```

**On-Demand Resources**
**src/components/OnDemandResources.tsx**

Provide links to on-demand resources or recordings of past meetups:

```Typescript
import React from 'react';

const OnDemandResources: React.FC = () => {
  return (
    <section id="ondemand">
      <h2>On-Demand Resources</h2>
      <ul>
        <li><a href="/resources/aws-meetup-recordings">AWS User Group Meetups Recordings</a></li>
      </ul>
    </section>
  );
};

export default OnDemandResources;
```

**Help System**
**src/components/Help.tsx**

Add a help panel to assist users with navigating the site or accessing additional information:

```TS
import React from 'react';
import { HelpPanel } from '@cloudscape-design/components';

const Help: React.FC = () => {
  return (
    <HelpPanel>
      <h2>Help and Support</h2>
      <p>If you need assistance, feel free to reach out to us on social media. find UG Organizer Bryan Chasko's contact details at <a href="https://bryanchasko.com" target="_blank"> bryanchasko.com</a></p>
    </HelpPanel>
  );
};

export default Help;
```

**Include Table and Form Components**
**src/components/EventTable.tsx**

Table Component

Create a table to display detailed information such as event schedules or attendee lists:

```typescript
import React from 'react';
import { Table } from '@cloudscape-design/components';

interface Event {
  event: string;
  date: string;
  location: string;
}

const EventTable: React.FC = () => {
  const columns = [
    { header: 'Event', cell: (item: Event) => item.event },
    { header: 'Date', cell: (item: Event) => item.date },
    { header: 'Location', cell: (item: Event) => item.location }
  ];

  const data: Event[] = [
    { event: 'AWS User Group Meeting - August', date: 'August 10, 2024', location: 'Online' },
    { event: 'AWS Workshop - September', date: 'September 15, 2024', location: 'New York' }
  ];

  return (
    <Table
      columnDefinitions={columns}
      items={data}
      resizableColumns
      wrapLines
    />
  );
};

export default EventTable;
```

**Placeholder Form Component**
**src/components/EventForm.tsx**

Create a form component for users to submit event details or RSVP:

```typescript
import React from 'react';
import { Form, FormField, Input, Button } from '@cloudscape-design/components';

const EventForm: React.FC = () => {
  return (
    <Form
      header={<h2>Submit Event</h2>}
      actions={
        <Button variant="primary" onClick={() => alert('Event submitted')}>
          Submit
        </Button>
      }
    >
      <FormField label="Event Name">
        <Input placeholder="Enter event name" />
      </FormField>
      <FormField label="Date">
        <Input type="date" />
      </FormField>
      <FormField label="Location">
        <Input placeholder="Enter event location" />
      </FormField>
    </Form>
  );
};

export default EventForm;
```

### Running and Building the Project

1. **Run the Project Locally**

   Start the development server:

   ```
   npm run dev
   ```

   Navigate to `http://localhost:8080` to view your application.

2. **Build for Production**

   Build your project for production:

   ```
   npm run build
   ```

   This will generate the output files in the `dist` directory.

#
## Localization

The site supports two locales via a flag toggle (next to the theme toggle):

- **🇺🇸 US** — New Mexican English with Spanglish & local slang
- **🇲🇽 MX** — Chihuahua dialect Spanish (norteño)

See [LOCALIZATION.md](LOCALIZATION.md) for dialect guides, translation guidelines, and open linguistic resources for the El Paso / Juárez / Las Cruces border region.

---

## Deploy to AWS S3

1. **Deploy to S3**

   Use the AWS CLI to sync the contents of the `dist` directory with your S3 bucket which we previously setup for static website hosting and added cloudfront cdn (see our private readme):

   ```
   aws s3 sync dist/ s3://awsaerospace.org --region us-east-1
   ```

   This command uploads your build files to the specified S3 bucket.


## Conclusion

If you’ve successfully set up a Vite project with Cloudscape, run it locally, and deployed it to AWS S3. Your static site should now be live and accessible via [awsaerospace.org](https://awsaerospace.org).

# Derived from Workshop: Build a cloud experience with Cloudscape, an open-source design system

In this workshop, we will go from an empty React TypeScript project to building a basic application using Cloudscape components in three steps:

* Step 1: Create the basic layout used throughout the application.
* Step 2: Add a Table view.
* Step 3: Add a Creation flow.

All steps towards the final application are available as branches on the repository.

The workshop instructions will be shared at the workshop via [Workshop Studio](https://catalog.workshops.aws/).

## Introduction

Created in 2016, Cloudscape is Amazon Web Services (AWS) open source design system for building intuitive, engaging, and inclusive user experiences at scale. Since then, the system has evolved—based on customer feedback and research—to consist of an extensive guidelines for web applications, design resources, and front-end components to streamline implementation. AWS teams use Cloudscape to improve the user experience and implement applications faster. These guidelines and component APIs can be found in the Components section of the [Cloudscape website](https://cloudscape.design/components/overview/).

## Getting started

```bash
npm i
npm run dev
```

The project will be available at http://localhost:8080/home/index.html

## Security
See [CONTRIBUTING.md](CONTRIBUTING.md) for more information.

## License Summary

The sample code is available under a modified MIT license. See the [LICENSE](LICENSE) file.
