# Montessori OS

Montessori OS is a planning, progress review, and classroom operations platform for Montessori schools, built to replace fragmented manual workflows with a more structured operational system.

I started this project after seeing how much work at a partner Montessori school in Lebanon was still being handled through scattered Word documents, ad hoc planning habits, and a legacy school tool that did not support flexible classroom planning well. The school already used Transparent Classroom, but important workflows were still hard to manage, difficult to standardize, and too dependent on manual coordination.

This project is my attempt to build a more modern operational layer around those workflows: one that supports teachers, coordinators, administrators, and eventually parents through clearer planning, individualized follow-through, stronger visibility, better analytics, and cleaner data flow.

## Problem Context

The original pain points were operational, not purely technical:

- planning lived across disconnected documents and informal teacher processes
- it was hard to get a clear view of what had been presented, practiced, or mastered
- coordination across classrooms was manual and time-consuming
- staff needed a more flexible workflow than the existing legacy platform offered
- school data existed, but the usability around it was weak

The goal of Montessori OS is not to replace school expertise. It is to reduce friction around that expertise by giving the school a more usable system for planning, tracking, coordination, and communication.

## Product Goal

The first phase of the product is focused on internal school operations and instructional decision support:

- daily and long-range planning
- student-level visibility
- individualized student tailoring
- progress review and mastery tracking
- coordinator oversight
- assessments and reporting
- analytics and follow-up extraction logic
- configuration and admin workflows
- integration with school data from Transparent Classroom

The longer-term direction is to extend the system beyond staff operations into a broader parent and school community experience once the internal workflows are stable.

## Tech Stack

- React
- Vite
- JavaScript
- Supabase
- Lucide React
- Transparent Classroom API integration

## Live Demo

Live app: [montessori-app-eight.vercel.app](https://montessori-app-eight.vercel.app)

This project uses authentication and a configured backend, so some workflows are best understood through the screenshots below.

## Screenshots

The application is authenticated and backend-connected, so screenshots are the fastest way to understand the product surface and workflow structure.

### 1. Home

![Home view](docs/screenshots/01-home.png)
*Operational landing page routing users into the platform’s main workflows, including planning, coordination, student tracking, assessments, configuration, and administration.*

### 2. Scope & Sequence

![Scope and Sequence](docs/screenshots/02-scope-sequence.png)
*Long-range planning view used to organize themes, lessons, and sessions across weekly, monthly, and yearly timelines.*

### 3. Coordinator Dashboard

![Coordinator Dashboard](docs/screenshots/03-coordinator-dashboard.png)
*Coordinator-facing analytics and oversight view summarizing classroom activity, action items, teacher activity, and cross-classroom operational patterns.*

### 4. Individual Plans - Kanban

![Individual Plans Kanban](docs/screenshots/04-individual-plans-kanban.png)
*Board-based workflow for tracking presented, practiced, and review-needed activities in a structured format that supports individualized follow-through.*

### 5. Individual Plans - Progress Overview

![Individual Plans Progress Overview](docs/screenshots/05-individual-plans-progress.png)
*Progress review layer showing curriculum-level tracking and longitudinal skill progression for an individual student.*

### 6. Assessments - Analytics

![Assessments Analytics](docs/screenshots/06-assessments-analytics.png)
*Assessment analytics view turning grade and progress data into classroom-level summaries, focus areas, and performance insights.*

### 7. Configuration

![Configuration](docs/screenshots/07-configuration.png)
*Configuration workflows for managing operational school structure, including students and other reference data the platform depends on.*

### 8. Admin Panel

![Admin Panel](docs/screenshots/08-admin-panel.png)
*Administrative workflows for sync operations, approvals, debugging, and higher-trust maintenance tasks that support the system’s integration and data quality.*

## What This Repo Demonstrates

This repository reflects more than UI work. It shows:

- product thinking around messy real-world workflows
- translating operational pain points into application structure
- role-aware workflow design
- frontend architecture across multiple business views
- integration with external school data systems
- practical data modeling and operational sync logic
- normalization and structuring of messy real-world data
- logic for turning raw observations into more usable insight

## Application Overview

The app is a React + Vite frontend backed by Supabase. It loads school, classroom, student, curriculum, term plan, and planning data, then exposes different workflows depending on the user role.

At a high level, the app supports:

- authenticated access
- role-based navigation
- school switching
- curriculum-aware planning
- student-level tracking
- student-specific progress review
- individualized instructional follow-up
- class and coordination dashboards
- assessment entry and analytics
- observation review and action-item extraction
- smart matching and normalization workflows
- configuration management
- admin syncing and approvals

## Roles and Access Model

The application includes role-aware behavior for different users:

- teachers use planning and student tracking workflows
- coordinators get access to the coordinator dashboard
- supervisors and super admins get configuration and admin-level control
- parents can be locked to a specific student context
- pending users are held in an approval state before full access

The product is intentionally shaped around real responsibilities inside a school rather than a generic one-size-fits-all dashboard.

## Main Views

### Home

The home screen acts as the operational landing page and routes users into the main working areas of the application.

### Scope & Sequence

This is the macro planning layer of the product. It supports planning across week, month, and year views, and helps structure the academic sequence over time.

### Coordinator Dashboard

This view is designed for coordinator-level oversight. It combines activity history, follow-up visibility, action items, and analytics to give a higher-level view across classrooms and teachers.

### Individual Plans

This view is built around the student as the core unit. It includes a dashboard, activity log, progress overview, assessments, board and list layouts, and follow-up workflows. It is where planning becomes actionable at the individual-child level.

### Assessments

The assessments module includes templates, grade grid workflows, and analytics. It captures structured evaluation data and turns it into usable reporting and review.

### Configuration

The configuration area manages the school’s operating structure and reference data, including school calendar, curriculum, students, staff, classrooms, and schools.

### Admin Panel

The admin area handles higher-trust operational and integration tasks such as approvals, syncs, debugging, and maintenance workflows.

## Workflow, Logic, and Data Design

Several themes repeat across the product:

- planning at different levels of granularity
- tracking status progression over time
- linking curriculum structure to classroom work
- preserving teacher notes and observations
- turning raw activity into usable oversight
- supporting individualized next steps for each student
- surfacing patterns through summaries and analytics
- supporting both operational execution and management visibility

The codebase also includes logic for:

- normalizing statuses and activity labels across inconsistent source data
- enriching planning items with curriculum references
- grouping classroom activity into coordinator-facing summaries
- surfacing action items and follow-ups from observations
- generating student-level progress views across multiple data sources
- aggregating assessment results into classroom analytics
- matching sessions and lesson/activity records using scoring logic rather than naive string equality
- supporting confidence-based mapping structures in the database for reviewed matches

## Data Flow and Integration

The application is backed by Supabase and uses it for:

- authentication
- profile and role management
- relational data storage
- RPC-based workflows
- edge/function invocations
- loading and mutating planning records

Main data sources include:

- schools
- classrooms
- students
- curriculum activities
- curriculum areas
- curriculum categories
- term plans
- term plan sessions
- planning items

The app also includes helper logic for:

- curriculum reference enrichment
- status normalization
- week/date calculations
- subject mapping
- matching and normalization of planning records

A major part of the work here is structuring school data into a more usable schema so that planning, progress review, analytics, and cross-view consistency become possible.

One of the central product constraints is that the school already works with Transparent Classroom. Instead of ignoring that, this project integrates around it.

The repository includes sync and mapping workflows for:

- student and parent data
- curriculum levels
- activity history
- observation notes
- grid statuses
- curriculum uploads

It also includes logic for handling ambiguity in real school data by normalizing naming and statuses, enriching curriculum references, and converting inconsistent source records into usable planning and review entities.

## Repository Structure

```text
src/
  components/
    ui/              Reusable UI building blocks
    business/        Domain-specific workflow components
  context/           Authentication and session state
  ui/                Theme and presentation system
  utils/             Shared helpers, normalization, matching logic
  views/             Main application modules and operational screens
  supabaseClient.js  Supabase client setup

supabase/
  sql/               Database-related scripts and schema helpers

scripts/             Local support scripts for integration and data work
```

## Local Development

### Prerequisites

- Node.js 18+
- npm
- a Supabase project
- environment variables for Supabase
- any credentials/configuration required for external integration workflows

### Install dependencies

```bash
npm install
```

### Start the app

```bash
npm run dev
```

### Build for production

```bash
npm run build
```

### Lint

```bash
npm run lint
```

## Demo and Review Notes

This app depends on authentication and a configured backend environment, so some workflows are not fully reviewable from the repository alone.

If you are reviewing this project without a live login:

- the best way to understand it is through the screenshots and main workflow descriptions
- some features depend on Supabase data and external sync processes
- the repository is best read as an active product build, not as a polished template or toy app

## Current Status

This is an active in-progress product. The core architecture, multi-view workflow structure, analytics layer, smart matching logic, and integration backbone are already in place. Ongoing work includes refining data quality, continuing workflow polish, strengthening presentation, and expanding the product toward broader school and parent use cases.

The product is being developed around a real school workflow and is currently in early live testing with a teacher.

## Why This Project Matters

If you are reviewing this repository as part of a job application, the most relevant signal is not the education domain itself. The relevant signal is how this project reflects my approach to:

- ambiguous real-world problems
- workflow-heavy product design
- structured thinking
- operational tooling
- data-backed application logic
- normalization and modeling of messy source data
- building intelligent workflow support instead of passive screens
- building around constraints instead of ignoring them

## License

This repository is currently shared as a portfolio and demonstration project.
