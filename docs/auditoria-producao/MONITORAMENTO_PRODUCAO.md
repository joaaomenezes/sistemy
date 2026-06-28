# Monitoramento de Producao

## Objetivo

Garantir um aviso rapido se a API sair do ar e manter logs de producao uteis sem expor dados sensiveis.

## Healthcheck oficial

URL:

```text
https://nexoerp-api-production.up.railway.app/health
```

Resposta esperada:

```json
{
  "ok": true,
  "ts": "ISO_DATE"
}
```

Status esperado: `200 OK`.

## Monitor ativo

Foi criado um monitor inicial via GitHub Actions no repositorio `nexoerp-api`:

```text
.github/workflows/healthcheck.yml
```

Esse workflow:

- Executa automaticamente a cada 5 minutos.
- Tambem pode ser executado manualmente pelo GitHub em `Actions`.
- Faz `GET` em `https://nexoerp-api-production.up.railway.app/health`.
- Falha se o status HTTP nao for `200` ou se a resposta nao contiver `"ok":true`.

Importante: o alerta depende das notificacoes do GitHub estarem ativas para falha de workflow.

## Monitor externo ativo

Foi configurado monitor externo no UptimeRobot para redundancia:

- Tipo: HTTP/HTTPS.
- Metodo: `GET`.
- URL: `https://nexoerp-api-production.up.railway.app/health`.
- Intervalo: 5 minutos.
- Alerta: `alertas@azzys.com.br`.

O e-mail `alertas@azzys.com.br` foi criado como alias do e-mail principal do dominio. Assim, alertas tecnicos ficam separados do e-mail pessoal.

Servicos alternativos futuros:

- Better Stack.
- Railway observability, quando disponivel no plano.

## Logs seguros

Regras aplicadas no backend:

- `/health` nao entra no log HTTP para evitar ruido.
- Em producao, o log HTTP registra caminho sem query string.
- Em producao, erros registram apenas status, metodo, path, nome, codigo e mensagem.
- Stack trace completo fica restrito ao ambiente local/desenvolvimento.

Dados que nao devem aparecer em logs:

- Senhas.
- PIN de supervisor.
- Token JWT.
- Token de confirmacao de e-mail.
- Chaves do Mercado Pago.
- `DATABASE_URL`.
- Headers `Authorization`.
- Corpo completo de requests.

## Validacao realizada

Em 2026-06-28:

- API publica respondeu `200 OK` em `/health`.
- `npx prisma migrate status` confirmou banco principal atualizado.
- Testes criticos do backend passaram com `19/19`.
- GitHub Actions configurado para healthcheck a cada 5 minutos.
- UptimeRobot configurado para monitor externo com alerta em `alertas@azzys.com.br`.

## Rotina recomendada

Antes de cliente oficial:

- Confirmar periodicamente que o monitor externo continua ativo.
- Confirmar periodicamente que o alias `alertas@azzys.com.br` continua recebendo e-mails.
- Revisar logs apos uma venda teste, um erro 4xx esperado e um erro 5xx simulado em ambiente controlado.

Durante operacao:

- Conferir incidentes de uptime diariamente no inicio.
- Investigar qualquer queda recorrente.
- Nunca colar logs com segredos em canais publicos ou tickets externos.
