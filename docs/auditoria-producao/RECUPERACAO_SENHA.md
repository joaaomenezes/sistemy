# Recuperacao de Senha - NexoERP

## Status

Implementado em 2026-06-29 e validado em producao em 2026-06-30 com e-mail real via Resend.

## Fluxo

1. Usuario clica em "Esqueceu a senha?" no `login.html`.
2. Frontend envia o e-mail para `POST /api/auth/forgot-password`.
3. Backend sempre responde com mensagem generica, sem revelar se o e-mail existe.
4. Se existir usuario com o e-mail, a API cria token aleatorio, salva apenas o hash e envia link via Resend.
5. Link abre `resetar-senha.html?token=...`.
6. Frontend envia nova senha para `POST /api/auth/reset-password`.
7. Backend valida token, expiracao, uso unico e politica minima de senha.
8. Senha e atualizada com bcrypt, tokens pendentes sao invalidados e o usuario recebe aviso de senha alterada.

## Backend

Arquivos:

- `src/routes/auth.js`
- `src/services/passwordReset.js`
- `src/middleware/rateLimit.js`
- `prisma/schema.prisma`
- `prisma/migrations/20260629120000_add_password_reset_tokens/migration.sql`

Rotas:

- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

Tabela:

- `password_reset_tokens`

Regras de seguranca:

- Token puro nunca e salvo no banco.
- Token expira em 30 minutos por padrao.
- Token e de uso unico.
- Tokens pendentes do mesmo usuario sao invalidados ao criar novo token ou apos redefinir senha.
- Rate limit por IP e por e-mail.
- Resposta do forgot password e sempre generica.

## Frontend

Arquivos:

- `auth.js`
- `login.html`
- `resetar-senha.html`

Comportamento:

- Modal de recuperacao no login envia e-mail real.
- Pagina de reset valida senha minima no frontend.
- Erros de token invalido/expirado sao exibidos de forma amigavel.
- Apos sucesso, usuario volta para o login.

## Variaveis de ambiente

Railway/API:

- `RESEND_API_KEY`
- `EMAIL_FROM`
- `PUBLIC_APP_URL`
- `PASSWORD_RESET_TOKEN_MINUTES` opcional, padrao `30`
- `PASSWORD_RESET_RATE_LIMIT_WINDOW_MS` opcional, padrao `3600000`
- `PASSWORD_RESET_RATE_LIMIT_MAX` opcional, padrao `5`

Valor esperado de `PUBLIC_APP_URL`:

- URL real do frontend na Vercel, sem barra no final.

## Validacao em producao

Validado em 2026-06-30:

- API de producao respondeu `POST /api/auth/forgot-password`.
- Token foi criado em `password_reset_tokens` para o e-mail cadastrado.
- E-mail de recuperacao chegou quando usado o endereco correto.
- Link de recuperacao abriu a tela `resetar-senha.html`.
- Comportamento generico para e-mail inexistente mantido por seguranca.

Observacao: durante o diagnostico, a ausencia de e-mail foi causada por teste com endereco diferente do cadastrado, nao por falha no backend ou Resend.

## Deploy

1. Subir backend no GitHub.
2. Railway deve executar `npx prisma migrate deploy` antes do start.
3. Conferir se `PUBLIC_APP_URL`, `RESEND_API_KEY` e `EMAIL_FROM` estao configuradas.
4. Subir frontend na Vercel.
5. Testar com uma conta real:
   - solicitar recuperacao;
   - receber e-mail;
   - abrir link;
   - criar senha nova;
   - logar com a senha nova;
   - confirmar que o mesmo link nao funciona novamente.

## Risco

Baixo. A mudanca nao altera o login atual, adiciona uma tabela nova e duas rotas publicas com rate limit. Migration, geracao de token e envio real foram validados em producao.
