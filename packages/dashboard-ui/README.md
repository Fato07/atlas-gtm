# Dashboard UI

React-based operator dashboard for Atlas GTM. Built with Vite, Tailwind CSS, and shadcn/ui.

## Overview

The Dashboard UI provides a modern interface for GTM operators to:
- Monitor agent health and activity
- Manage brains (vertical-specific knowledge bases)
- Edit ICP rules, response templates, and objection handlers
- View and approve pending validations
- Trigger manual agent actions
- View metrics and performance data

## Quick Start

```bash
# Install dependencies
bun install

# Start development server (port 5173)
bun run dev

# Build for production
bun run build
```

## Configuration

Environment variables (optional for development):

```bash
# API endpoint (defaults to localhost:4000)
VITE_API_URL=http://localhost:4000

# Dashboard secret for API auth
VITE_DASHBOARD_SECRET=your-secret-key
```

## Features

### Dashboard Home (US1, US2, US9)
- Agent status grid with real-time health indicators
- Activity feed showing recent agent actions
- Metrics summary with period selection (today/7d/30d)
- Command palette (Cmd+K) for quick navigation

### Brain Management (US3)
- List all brains with status and stats
- Create, edit, and delete brains
- Brain selector in header for context switching

### ICP Rules (US4)
- View and edit ICP scoring rules
- Drag-and-drop reordering
- Bulk import from JSON
- Weight and tier assignment

### Response Templates (US5)
- Create and manage email templates
- Variable placeholder support
- Preview mode with sample data
- Category-based organization

### Objection Handlers (US6)
- Pattern-based objection matching
- Test interface for pattern validation
- Response template linking
- Category filtering

### Market Research (US7)
- Store and organize research insights
- Rich text content support
- Source URL tracking
- Confidence scoring

### Pending Validations (US8)
- View items awaiting approval
- Approve/reject with reasons
- Bulk actions support

### Manual Actions (US10)
- Trigger lead scoring from command palette
- Generate meeting briefs on demand
- Force rescore/regenerate options

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build**: Vite
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui (Radix primitives)
- **Data Fetching**: @tanstack/react-query
- **Routing**: react-router-dom
- **Validation**: Zod

## Data Flow

Data contracts are defined in the **Dashboard API** (`packages/dashboard-api/src/contracts/`).
These Zod schemas ensure type-safety across the API boundary.

See the [Dashboard API README](/packages/dashboard-api/README.md) for contract patterns.

## Architecture

```
src/
├── main.tsx           # Entry point, routing setup
├── App.tsx            # Provider wrapper
├── styles/
│   └── globals.css    # Tailwind + custom styles
├── components/
│   ├── ui/            # shadcn/ui base components
│   ├── layout/        # Header, Layout, CommandPalette
│   ├── dashboard/     # Agent cards, activity feed, metrics
│   ├── brains/        # Brain management components
│   ├── icp-rules/     # ICP rule editor components
│   ├── templates/     # Template editor components
│   ├── handlers/      # Objection handler components
│   ├── research/      # Research viewer/editor
│   ├── pending/       # Validation queue components
│   ├── actions/       # Manual trigger dialogs
│   └── error/         # Error boundary
├── pages/
│   ├── Dashboard.tsx
│   ├── BrainList.tsx
│   ├── BrainDetail.tsx
│   ├── ICPRules.tsx
│   ├── Templates.tsx
│   ├── Handlers.tsx
│   └── Research.tsx
├── hooks/
│   ├── useAgentStatus.ts
│   ├── useActivity.ts
│   ├── useBrains.ts
│   ├── useICPRules.ts
│   ├── useTemplates.ts
│   ├── useHandlers.ts
│   ├── useResearch.ts
│   ├── usePending.ts
│   ├── useMetrics.ts
│   └── useActions.ts
├── contexts/
│   └── BrainContext.tsx
└── services/
    └── api.ts         # API client wrapper
```

## Components

### Core UI Components

Built on shadcn/ui (Radix primitives):
- Button, Card, Dialog, Input, Textarea
- Select, Switch, Slider, Tabs
- Dropdown Menu, Popover, Scroll Area
- Alert, Badge, Skeleton, Separator

### Layout Components

- `Header` - Navigation, brain selector, command palette trigger
- `Layout` - Main layout wrapper with sidebar potential
- `CommandPalette` - Cmd+K quick navigation and actions

### Feature Components

Each feature has a standard component set:
- `*List` - Table/grid view with actions
- `*Editor` - Create/edit form
- `*Row` or `*Card` - Individual item display
- `*Preview` - Read-only detailed view

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+K` | Open command palette |
| `G D` | Go to Dashboard |
| `G B` | Go to Brains |
| `S L` | Score Lead dialog |
| `G M` | Generate Brief dialog |

## Development

```bash
# Type checking
bun run typecheck

# Lint
bun run lint

# Build
bun run build

# Preview production build
bun run preview
```

## Related

- [Dashboard API](../dashboard-api/README.md) - Backend BFF API
- [Atlas GTM Docs](../../docs/) - Project documentation
