# 🔎🧭 PolicyTrace

An internal **Vite + React** support tool for insurance software engineers. Type a policy number and PolicyTrace pulls everything every system did to that policy into one view: **Seq** logs and **NServiceBus** messages (through ServiceControl), conversation flows, saga history and related **Jira** tickets. You can also retry, edit-and-retry or delete failed messages without leaving the page.

**Live:** [guilherme.stracini.com.br/policy-trace](https://guilherme.stracini.com.br/policy-trace/) (runs on mock data)

> The domain language used across the app and this repo (Policy, Risk, Term, Rerate, Transaction reference, Failure record…) is defined in [`CONTEXT.md`](CONTEXT.md).

---

## ✨ Features

- **🔎 Policy Lookup:** Search one policy number across Seq and ServiceControl over a time window (up to ~30 days, the sources' retention). Messages and log events are merged into a single chronological **Timeline**, with infrastructure **noise** hidden by default, per-source health and truncation warnings.
- **✉ Messages:** Browse all messages with filters for endpoint, status and free-text search, plus sorting and paging.
- **⚠ Failed Messages:** Triage unresolved, retry-issued and deleted failures, with single and bulk retry/delete.
- **🧾 Message Detail:** Overview, body, headers, exception and stack trace, correlated Seq logs, flow and related tickets, all in a drawer or on a full page.
- **✎ Edit & Retry:** Fix a failed message's body or headers (locked headers stay read-only) and resubmit it as a replacement message.
- **🕸 Conversation Diagram:** An interactive graph of every message in a conversation (send / publish / reply), with its status, endpoints and sagas.
- **⏱ Saga History:** Each state change of a saga, with the initiating message, outgoing messages, timeouts and the state after the change.
- **🎫 Related Jira Tickets:** Tickets that mention the policy, match the error, or are recent changes to the failing endpoint, each labelled as a possible cause, possible fix, or related.
- **🛡 Environment-aware actions:** Retry, edit and delete can each be enabled or disabled per environment (INT / STG / PROD), with batch-size limits. Every action sends the operator's handle in the `X-Operator` header for auditing.
- **🌗 Light / dark theme**, keyboard shortcut `/` to focus the policy search.

---

## 🧱 Tech Stack

- [Vite](https://vitejs.dev/) – Frontend build tool
- [React 19](https://react.dev/) + TypeScript – UI library
- [React Router](https://reactrouter.com/) – Client-side routing
- [React Flow (@xyflow/react)](https://reactflow.dev/) – Conversation diagrams
- [Tailwind CSS v4](https://tailwindcss.com/) – Utility-first CSS
- [lucide-react](https://lucide.dev/) – Icons
- [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/) – Unit/component tests
- ESLint + typescript-eslint – Linting

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 24 (see `.nvmrc`; run `nvm use` if you use nvm)

### Installation

```bash
git clone https://github.com/guibranco/policy-trace.git
cd policy-trace
npm install
```

### Run locally

```bash
npm run dev
```

Open the printed local URL (default [http://localhost:5173/policy-trace/](http://localhost:5173/policy-trace/)). You land on a demo policy that has realistic mock data.

---

## 🔌 Data Sources & Backend API

PolicyTrace is a frontend for a small backend that talks to Seq, ServiceControl and Jira on its behalf. For now the app runs entirely on **built-in mock data** (`USE_MOCK = true` in `src/api/client.ts`), so it works with no backend.

Set `USE_MOCK` to `false` to call the real backend. It must expose:

| Method | Endpoint | Returns |
| ------ | -------- | ------- |
| `GET` | `/api/config` | Environment config: name, Seq / ServicePulse URLs, enabled actions, lookback, policy number pattern, Jira settings |
| `GET` | `/api/endpoints` | Known NServiceBus endpoints |
| `GET` | `/api/lookup/{policyNumber}?from=&to=&includeNoise=` | Timeline of messages + logs for a policy |
| `GET` | `/api/messages?endpoint=&status=&q=&page=&pageSize=&sort=&direction=` | Paged message list |
| `GET` | `/api/messages/{id}` | Message detail (headers, body, stack trace) |
| `GET` | `/api/conversations/{conversationId}` | Conversation graph |
| `GET` | `/api/sagas/{sagaId}` | Saga history |
| `GET` | `/api/logs?policyNumber=&conversationId=&messageId=&…` | Seq log events |
| `GET` | `/api/tickets/related?policyNumber=&messageId=&from=&to=` | Related Jira tickets |
| `POST` | `/api/messages/{id}/retry`, `/api/messages/retry` | Retry one or many |
| `POST` | `/api/messages/{id}/edit-retry` | Edit body/headers and retry |
| `POST` | `/api/messages/{id}/archive`, `/api/messages/archive`, `/api/messages/{id}/unarchive` | Delete / restore (ServiceControl calls this *archive*) |

Every `POST` sends `X-Requested-With: PolicyTrace` and, when it's set, the operator's handle in `X-Operator`. Errors are returned as RFC 7807 problem details (`title`, `detail`, `status`), and `403` means the action is disabled in the current environment.

---

## 🧪 Testing

```bash
npm run test        # run the test suite once
npm run test:watch  # watch mode
npm run coverage    # run tests with coverage
npm run lint        # lint the codebase
```

---

## 📦 Build for Production

```bash
npm run build
```

The static site will be available in the `dist/` folder. Preview it locally with `npm run preview`.

Merges to `main` deploy to GitHub Pages at [guilherme.stracini.com.br/policy-trace](https://guilherme.stracini.com.br/policy-trace/), so the app is built with the `/policy-trace/` base path. The build also writes `dist/404.html` (a copy of `index.html`), so deep links such as `/policy-trace/messages/…` work on refresh.

---

## 📂 Folder Structure

```text
policy-trace/
├── public/
├── src/
│   ├── api/
│   │   ├── client.ts      # Backend API client (+ USE_MOCK switch)
│   │   ├── mock.ts        # In-memory mock data and actions
│   │   └── types.ts       # API contract types
│   ├── components/        # AppShell, ConversationDiagram, MessageDetailView,
│   │                      # RelatedTicketsPanel, ActionModals, Common
│   ├── context/           # AppContext (config, drawer, actions)
│   ├── pages/             # PolicyLookup, Messages, FailedMessages,
│   │                      # MessageDetail, Conversation, Saga
│   ├── utils/             # Formatting helpers
│   ├── App.tsx            # Routes
│   ├── index.css          # Tailwind v4 theme (design tokens)
│   └── main.tsx
├── tests/                 # Vitest + Testing Library suites
├── docs/agents/           # Agent skill configuration
├── CONTEXT.md             # Domain glossary
├── index.html
└── vite.config.ts
```

---

## 📄 License

MIT License © Guilherme Branco Stracini

---

## 🙌 Contributions

Feel free to open issues or submit pull requests! Suggestions and improvements are always welcome.
