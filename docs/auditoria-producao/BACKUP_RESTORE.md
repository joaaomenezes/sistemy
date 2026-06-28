# Backup e Restore - Neon / NexoERP

Data: 2026-06-28

## Objetivo

Garantir que existe um caminho testado para recuperar o banco antes de aplicar migrations sensiveis, como a migracao monetaria de `Float` para `Decimal`.

## Regra de seguranca

- Nunca restaurar backup diretamente no banco principal.
- Sempre restaurar em um branch/banco separado, por exemplo `restore-test`.
- Nunca versionar `.env`, `.env.backup`, `.env.restore`, arquivos `.dump` ou pasta `backups/`.

## Arquivos locais

No backend `nexoerp-api`, criar manualmente:

```env
# .env.backup
DATABASE_URL="connection string do banco origem"
```

```env
# .env.restore
DATABASE_URL="connection string do branch/banco restore-test"
```

Os scripts recusam restore quando `.env.restore` aponta para a mesma URL de `.env` ou `.env.test`.

## Dependencia local

Os comandos abaixo exigem PostgreSQL client tools no Windows:

- `pg_dump`
- `pg_restore`

Nesta maquina, em 2026-06-28, os binarios foram encontrados em `C:\Program Files\PostgreSQL\18\bin`. Os scripts tambem procuram automaticamente em pastas comuns do PostgreSQL no Windows. Para confirmar manualmente:

```bash
where pg_dump
where pg_restore
```

## Backup

No backend:

```bash
cd C:\Users\Administrador\Desktop\nexoerp-api
npm run backup:db
```

Resultado esperado:

```text
backups/nexoerp-YYYY-MM-DDTHH-MM-SS-sssZ.dump
```

## Restore em branch separado

1. Criar no Neon um branch/banco separado, por exemplo `restore-test`.
2. Copiar a connection string desse branch para `.env.restore`.
3. Executar:

```bash
npm run restore:db -- --file backups/nexoerp-YYYY-MM-DDTHH-MM-SS-sssZ.dump
```

4. Validar:

```bash
npm run restore:validate
```

## Validacao minima

O restore e considerado valido quando:

- `npm run restore:validate` confirma tabelas essenciais;
- a API consegue conectar nesse banco restaurado;
- `npx prisma migrate deploy` consegue aplicar migrations pendentes no branch restaurado;
- os testes criticos seguem passando em banco separado.

## Status atual

- Scripts de backup/restore/validacao criados.
- Arquivos sensiveis e pasta `backups/` ignorados pelo Git.
- Backup real gerado em 2026-06-28:
  - `backups/nexoerp-2026-06-28T20-50-14-344Z.dump`
- Restore real validado em 2026-06-28 usando `.env.restore` apontando para branch separado.
- Validacao retornou tabelas essenciais presentes e contagens:
  - empresas: 2
  - usuarios: 2
  - produtos: 681
  - clientes: 5
  - vendas: 38
  - lancamentos: 37
