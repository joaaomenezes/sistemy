# Auditoria Final da Fase 1

Data: 2026-06-28

## Objetivo

Fechar a etapa de fundacao/seguranca antes de pensar em usuario oficial.

## Validacoes executadas

- Repositorios `sistemy` e `nexoerp-api` limpos e sincronizados com `origin/main`.
- API publica validada em `https://nexoerp-api-production.up.railway.app/health`.
- Resposta do healthcheck: HTTP `200` com `"ok":true`.
- Banco principal validado com `npx prisma migrate status`.
- Resultado: schema atualizado, sem migration pendente.
- Backup/restore validado em branch separado do Neon.
- Monitoramento ativo:
  - GitHub Actions a cada 5 minutos.
  - UptimeRobot a cada 5 minutos.
  - Alerta em `alertas@azzys.com.br`.

## Achados da auditoria

### 1. `.env.example` continha uma chave com formato real do Resend

O arquivo de exemplo do backend continha um valor `RESEND_API_KEY` com formato de chave real.

Acao executada:

- Substituido por placeholder em `.env.example`.

Acao obrigatoria no painel:

- Revogar/rotacionar essa chave no Resend se ela existir ou ja tiver sido usada.
- Atualizar `RESEND_API_KEY` no Railway com a nova chave.

### 2. Variaveis sensiveis estao ignoradas pelo Git

Confirmado no backend:

- `.env`
- `.env.test`
- `.env.backup`
- `.env.restore`
- `backups/`

Esses arquivos nao devem ser versionados.

### 3. Variaveis locais ausentes nao provam erro de producao

Na maquina local, alguns valores podem estar ausentes porque o ambiente real fica no Railway.

Mesmo assim, conferir no Railway:

- `DATABASE_URL`
- `JWT_SECRET`
- `INTEGRATION_ENCRYPTION_KEY`
- `PUBLIC_API_URL`
- `PUBLIC_APP_URL`
- `CORS_ORIGIN`
- `EMAIL_VERIFICATION_REQUIRED`
- `EMAIL_FROM`
- `RESEND_API_KEY`
- `LOGIN_RATE_LIMIT_MAX`
- `REGISTER_RATE_LIMIT_MAX`

## Checklist Railway

Valores esperados em producao:

- `NODE_ENV=production`
- `DATABASE_URL`: Neon branch principal de producao.
- `JWT_SECRET`: valor forte, nao compartilhado.
- `INTEGRATION_ENCRYPTION_KEY`: chave com pelo menos 32 caracteres.
- `PUBLIC_API_URL=https://nexoerp-api-production.up.railway.app`
- `PUBLIC_APP_URL`: URL real do Netlify ou dominio proprio.
- `CORS_ORIGIN`: URL real do frontend, sem barra final.
- `EMAIL_VERIFICATION_REQUIRED=true`
- `EMAIL_FROM`: remetente validado no provedor de e-mail.
- `RESEND_API_KEY`: chave ativa e nao exposta.
- `LOGIN_RATE_LIMIT_MAX`: valor restritivo para producao.
- `REGISTER_RATE_LIMIT_MAX`: valor restritivo para producao.

Deploy:

- Pre-deploy command: `npx prisma migrate deploy`
- Start command: pode usar o padrao do `package.json`, desde que o Railway rode `npm start`.

## Checklist Netlify

- Frontend aponta para `https://nexoerp-api-production.up.railway.app/api`.
- Deploy publicado a partir do branch correto.
- Se usar build command, confirmar que `API_URL` aponta para a API de producao.
- Se usar dominio proprio, atualizar tambem `CORS_ORIGIN` e `PUBLIC_APP_URL` no Railway.

## Checklist Neon

- Branch principal de producao identificado.
- Branches `nexoerp-test` e `restore-test` usados apenas para teste.
- Backup/restore documentado e validado.
- Antes de novas migrations sensiveis, repetir backup/restore.

## Status

Fase 1 tecnicamente pronta pelo codigo e pelas validacoes automatizadas, com duas pendencias operacionais obrigatorias:

- Rotacionar a chave Resend caso a chave antiga do `.env.example` seja real.
- Conferir visualmente as variaveis nos paineis Railway, Netlify, Neon e Resend.

Depois dessa rotacao e da conferencia visual das variaveis, a Fase 1 pode ser marcada como fechada para avancar para Fase 2 ou teste manual guiado em producao.
