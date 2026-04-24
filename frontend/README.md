# Acufy CRM Frontend

This is the fully rebuilt and functional frontend for the Acufy CRM, an advanced, AI-powered customer relationship management platform.

## Architecture & Technology Stack

- **Framework**: React with Vite
- **Styling**: Vanilla CSS (`index.css`) built around an advanced design system ("Obsidian Intelligence") leveraging native CSS variables for seamless Light/Dark mode transitions.
- **State Management**: Zustand (`lib/store.ts`) handles global UI states such as sidebar toggle, theme, active user role, notifications, AI simulation state, and pending approvals.
- **Data Fetching**: React Query (`@tanstack/react-query`) handles all data fetching and caching with an Axios API client mapping to the backend.

## Design System

The application strictly adheres to the requested premium aesthetic:
- **Color Palette**: Cyan (`#38BDF8`), Purple (`#A78BFA`), Emerald (`#34D399`) across glowing elements and gradients.
- **Typography**: Display elements use `Syne`, body text uses `DM Sans`, and numerical/data points use `JetBrains Mono`.
- **Interactions**: GSAP is heavily utilized across all views to provide a premium, dynamic entrance animation and layout transition experience.

## AI Agent Simulation (Prototype Notice)

**IMPORTANT:** The AI functionalities presented in this frontend—including the AI Command Center missions, Approval Workflows, and AI-generated drafting—are currently operating in a **client-side simulation mode**.

- The backend APIs for these actions (e.g., launching an outbound campaign) act as mock receivers. 
- The actual lifecycle of an AI run (progressing through steps, simulating latency, deducting cost, and generating drafts) is managed entirely by the `useAgentSimulation.ts` hook within the frontend.
- When an agent finishes a run that produces a draft, it triggers a state update in the Zustand store (`incrementApprovals`) and pushes a mock notification, keeping the workflow completely functional from a UX perspective without requiring real LLM integration at this stage.

## Features Implemented

1. **Dashboard Overview**: KPI tracking, active pipeline breakdown, dynamic meeting schedules, and quick insights.
2. **Deals Kanban**: A fully interactive pipeline view with real data, calculated days-in-stage, and Won/Lost stage toggles.
3. **Accounts & Contacts**: Comprehensive data tables with robust filtering, CSV Import Wizard (4-step mapping process), and bulk actions.
4. **AI Command Center**: Form-based mission launcher with real-time progress indicators for agent tasks.
5. **AI Approvals Inbox**: Compliance-driven draft review system with manual edit capabilities and strict honesty checks.
6. **Task Management**: Filterable task lists with overdue indicators and direct links to deals and contacts.
7. **Product Catalog**: Standardized product listing with multi-currency support.
8. **Global Search**: Accessible via `Cmd+K` anywhere in the app, searching across Contacts, Accounts, Deals, and Products simultaneously.
9. **Role-Based Access Control**: UI changes dynamically depending on the selected user role (Admin, Manager, Rep), restricting access to AI features and bulk actions accordingly. You can swap roles in the TopBar user menu.

## Development

```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Build for production
npm run build
```
