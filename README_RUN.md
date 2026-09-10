Instruções rápidas para inicializar e acessar a aplicação localmente

1) Preparar variáveis de ambiente

- Copie o arquivo de exemplo para o container da API (local):

```powershell
copy api\.env.example api\.env
```

2) Subir os serviços com Docker Compose

```powershell
docker compose up --build -d
```

Serviços expostos (por padrão):
- API: http://localhost:4000
- RabbitMQ Management: http://localhost:15672 (usuário/senha padrão: guest/guest)

3) Criar esquema do banco (Prisma migrate)

Execute uma vez para criar as tabelas:

```powershell
docker compose exec api npx prisma migrate dev --name init
```

4) (Opcional) Abrir Prisma Studio para criar contas e inspecionar dados

```powershell
docker compose exec api npx prisma studio
```

5) Registrar usuário e obter token (exemplo via curl)

```powershell
curl -X POST http://localhost:4000/auth/register -H "Content-Type: application/json" -d "{\"email\":\"usuario@exemplo.com\",\"senha\":\"123456\"}"

curl -X POST http://localhost:4000/auth/login -H "Content-Type: application/json" -d "{\"email\":\"usuario@exemplo.com\",\"senha\":\"123456\"}"
# resposta: { "token": "ey..." }
```

6) Criar uma `Account` para o usuário (via Prisma Studio ou inserção direta)

Depois de registrar o usuário, crie um registro em `Account` vinculado ao `userId` (use Prisma Studio ou `psql`).

7) Endpoints principais

- `POST /auth/register` — registra usuário
- `POST /auth/login` — obtém JWT
- `GET /contas/me` — consulta saldo (exige `Authorization: Bearer <token>`)
- `POST /transferencias` — solicita transferência (body: `fromAccountId, toAccountId, amount`)
- `GET /metrics` — métricas Prometheus expostas pela API

8) Ver logs e status

```powershell
docker compose logs -f api
docker compose logs -f worker
docker compose ps
```

9) Acesso ao RabbitMQ

Abra http://localhost:15672 e verifique a fila `transferencias` (envio e consumo de mensagens).

10) Parar e remover

```powershell
docker compose down
```

Observações
- O worker consome mensagens da fila `transferencias` e efetiva débitos/créditos no banco.
- A métrica `/metrics` está disponível na API; a instrumentação do worker ficará para a próxima etapa.
