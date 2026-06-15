# Roadmap — Confirmação de E-mail e Recuperação de Senha

## Objetivo
Tornar o cadastro e a recuperação de acesso prontos para produção, com confirmação real por e-mail e fluxo seguro de redefinição de senha.

## Fase 1 — Base no Backend
- Adicionar campos de verificação no usuário:
  - `emailVerificadoEm`
  - `emailVerificationTokenHash`
  - `emailVerificationExpires`
- Adicionar variáveis de ambiente no Railway:
  - `FRONTEND_URL`
  - `EMAIL_FROM`
  - `RESEND_API_KEY` ou provedor equivalente
- Criar serviço de envio de e-mail transacional.
- Gerar tokens aleatórios com expiração e salvar apenas hash no banco.

## Fase 2 — Confirmação de E-mail
- Ajustar `POST /api/auth/register` para criar usuário não verificado.
- Enviar e-mail com link de ativação:
  - `https://dominio/verificar-email.html?token=...`
- Criar endpoint:
  - `POST /api/auth/verify-email`
- Bloquear login de usuários não verificados com mensagem clara.
- Criar endpoint:
  - `POST /api/auth/resend-verification`

## Fase 3 — Frontend de Confirmação
- Ajustar `cadastro.html`:
  - remover botão "Acessar o painel agora" após cadastro;
  - mostrar orientação para confirmar o e-mail;
  - adicionar ação para reenviar e-mail.
- Criar `verificar-email.html`:
  - ler token da URL;
  - chamar `/auth/verify-email`;
  - mostrar sucesso/erro;
  - direcionar para login.
- Ajustar `login.html` para exibir mensagem de e-mail pendente.

## Fase 4 — Recuperação de Senha Real
- Criar endpoint:
  - `POST /api/auth/forgot-password`
- Criar endpoint:
  - `POST /api/auth/reset-password`
- Adicionar campos/tabela de token de reset:
  - `passwordResetTokenHash`
  - `passwordResetExpires`
- Enviar e-mail com link:
  - `https://dominio/resetar-senha.html?token=...`
- Invalidar token após uso.

## Fase 5 — Frontend de Recuperação
- Trocar o modal visual de recuperação em `login.html` por chamada real à API.
- Criar `resetar-senha.html`.
- Validar senha forte no frontend e no backend.
- Mostrar estados claros:
  - enviado;
  - token inválido;
  - token expirado;
  - senha alterada.

## Fase 6 — Segurança e Produção
- Aplicar rate limit nos endpoints:
  - login;
  - registro;
  - reenvio de confirmação;
  - esqueci senha;
  - reset de senha.
- Nunca revelar se um e-mail existe no endpoint de recuperação.
- Registrar auditoria mínima:
  - e-mail enviado;
  - e-mail verificado;
  - senha redefinida.
- Testar links com domínio Netlify e domínio próprio.

## Ordem Recomendada
1. Backend: provedor de e-mail e tokens.
2. Backend: confirmação de e-mail.
3. Frontend: `cadastro.html` e `verificar-email.html`.
4. Backend: recuperação de senha.
5. Frontend: `login.html` e `resetar-senha.html`.
6. Testes finais em Railway + Netlify.

