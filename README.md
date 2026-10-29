# Uptime Monitor

Plataforma de monitoramento de uptime: cadastre URLs, acompanhe disponibilidade e latência, receba alertas no Discord ou Slack quando algo cair e publique uma página de status pública.

## Funcionalidades

- **Monitores HTTP** — checagens `GET`, `HEAD` ou `POST` com intervalo (30s a 24h), timeout e status esperado configuráveis.
- **Detecção sem flapping** — o monitor só é marcado como fora do ar após N falhas consecutivas, evitando alertas por oscilações pontuais.
- **Alertas por webhook** — notificações de queda e de recuperação (com tempo de indisponibilidade) no Discord ou Slack.
- **Dashboard** — status atual, gráfico de latência, uptime em 24h / 7d / 30d e histórico de incidentes.
- **Página pública de status** — em `/status/:slug`, com barras de uptime dos últimos 90 dias.

## Stack

| Camada   | Tecnologias |
| -------- | ----------- |
| API      | Node.js, Fastify 5, Zod, JWT |
| Worker   | BullMQ sobre Redis |
| Banco    | PostgreSQL 18 + Prisma 7 |
| Frontend | React 19, Vite, TanStack Query, Tailwind CSS 4, Recharts |

## Arquitetura

```
┌────────────┐   /api (proxy Vite)   ┌────────────┐
│  web       │ ────────────────────▶ │  API       │──┐
│  (React)   │                       │  (Fastify) │  │ agenda/remove jobs
└────────────┘                       └─────┬──────┘  │
                                           │         ▼
                                     ┌─────▼─────┐ ┌───────┐
                                     │ Postgres  │ │ Redis │
                                     └─────▲─────┘ └───┬───┘
                                           │           │ filas BullMQ
                                     ┌─────┴───────────▼───┐
                                     │  Worker             │──▶ Discord / Slack
                                     └─────────────────────┘
```

A API grava os monitores no Postgres e agenda as checagens no Redis. O worker executa os requests, registra o resultado, dispara os alertas e remove logs antigos.

## Como rodar

Pré-requisitos: [Node.js](https://nodejs.org/) 22.12+ e [Docker](https://www.docker.com/).

```bash
# 1. Suba Postgres e Redis
docker compose up -d

# 2. Backend
cd server
npm install                  # também roda `prisma generate`
cp .env.example .env         # depois troque o JWT_SECRET
npm run db:migrate
npm run db:seed              # opcional: conta demo com 90 dias de histórico

# 3. Frontend
cd ../web
npm install
```

Em desenvolvimento são três processos, cada um em um terminal:

```bash
cd server && npm run dev:api      # API em http://localhost:3333
cd server && npm run dev:worker   # worker de checagens
cd web && npm run dev             # frontend em http://localhost:5173
```

As variáveis de ambiente estão documentadas em [`server/.env.example`](server/.env.example). No frontend, `VITE_API_URL` define a URL da API em produção; em desenvolvimento o Vite repassa `/api/*` para a API.

O Postgres fica exposto na porta **5433** do host e o Redis na **6379**.

### Testes

Os testes de rota usam um banco separado (`uptime_monitor_test`) no mesmo Postgres do Docker:

```bash
cd server
cp .env.test.example .env.test   # .env.test não é versionado
npm run db:test:prepare          # cria o banco de teste e aplica as migrations
npm test
```

### Conta demo

Depois do `npm run db:seed`, entre com `demo@example.com` / `demo12345`. A página pública fica em http://localhost:5173/status/demo.

## API

As rotas de `/monitors` exigem o header `Authorization: Bearer <token>`.

| Método | Rota | Descrição |
| ------ | ---- | --------- |
| `GET` | `/health` | Saúde da API, do Postgres e do Redis |
| `POST` | `/auth/register` | Cria conta |
| `POST` | `/auth/login` | Autentica e retorna o token |
| `GET` / `PATCH` | `/auth/me` | Lê / atualiza o perfil (incluindo o slug da página pública) |
| `GET` / `POST` | `/monitors` | Lista / cria monitores |
| `GET` / `PATCH` / `DELETE` | `/monitors/:id` | Lê / atualiza / remove um monitor |
| `POST` | `/monitors/:id/pause` | Pausa as checagens |
| `POST` | `/monitors/:id/resume` | Retoma as checagens |
| `GET` | `/monitors/:id/checks` | Histórico de checagens (`limit`, `before`, `status`) |
| `GET` | `/monitors/:id/stats` | Uptime e latência (`range` = `24h`, `7d` ou `30d`) |
| `GET` | `/monitors/:id/daily` | Uptime por dia (`days`, até 90) |
| `GET` | `/public/status/:slug` | Página pública de status (sem autenticação) |

## Problemas comuns

**`Cannot find module '.../src/generated/prisma/client.js'`**
O Prisma Client é gerado localmente e não é versionado. Rode `npm run db:generate` em `server/`, também depois de alterar o `schema.prisma`.

**Monitores não são checados**
O worker (`npm run dev:worker`) precisa estar rodando. A API apenas agenda as checagens.

## Licença

[MIT](LICENSE)
