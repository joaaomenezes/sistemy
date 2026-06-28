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

## Uptime monitor

Configurar um monitor externo com estes parametros:

- Tipo: HTTP/HTTPS.
- Metodo: `GET`.
- URL: `https://nexoerp-api-production.up.railway.app/health`.
- Intervalo recomendado: 1 a 5 minutos.
- Timeout recomendado: 20 segundos.
- Alerta minimo: e-mail do dono/responsavel tecnico.

Servicos possiveis:

- UptimeRobot.
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

## Rotina recomendada

Antes de cliente oficial:

- Confirmar monitor externo ativo.
- Confirmar recebimento de alerta por e-mail.
- Revisar logs apos uma venda teste, um erro 4xx esperado e um erro 5xx simulado em ambiente controlado.

Durante operacao:

- Conferir incidentes de uptime diariamente no inicio.
- Investigar qualquer queda recorrente.
- Nunca colar logs com segredos em canais publicos ou tickets externos.
