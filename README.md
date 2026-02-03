## Prerequisites
- Node.js (latest LTS version preferred, older versions may cause issues)
- Yarn
- Docker & Docker Compose (for PostgreSQL database)

## Getting Started

### 1. Install Dependencies
```bash
yarn install
```

### 2. Start PostgreSQL Database
Start the local PostgreSQL instance using Docker Compose:
```bash
docker-compose up -d
```

This starts a PostgreSQL 15 container with:
- **Host**: localhost
- **Port**: 5432
- **Database**: mtgcardloader
- **Username**: mtguser
- **Password**: mtgpassword

To stop the database:
```bash
docker-compose down
```

To stop and remove all data:
```bash
docker-compose down -v
```

### 3. Run Database Migrations
The `knexfile.js` is pre-configured for local development. Run migrations to create the database schema:
```bash
yarn db:migrate
```

To create a new migration:
```bash
yarn db:migrate:make migration_name
```

To rollback the last migration:
```bash
yarn db:rollback
```

### 4. Start the Application
In one terminal, start the backend server:
```bash
node server.js
```

In another terminal, start the frontend:
```bash
yarn start
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode. Set to `production` to use production database config. | `development` |
| `RATE_LIMIT_DEBUG` | Set to `true` to enable rate limiter logging. Shows queue position and wait times for Scryfall API requests. | `false` |
| `DATABASE_URL` | PostgreSQL connection string. Used directly in production; in development, falls back to local Docker credentials. | `postgresql://mtguser:mtgpassword@localhost:5432/mtgcardloader` |
| `JWT_SECRET` | Secret key for JWT token signing. | (required in production) |

Example:
```bash
RATE_LIMIT_DEBUG=true node server.js
```

For production, set secure values:
```bash
DATABASE_URL=postgresql://user:password@host:5432/dbname JWT_SECRET=your-secure-secret node server.js
```

## External APIs
This project utilizes the Scryfall API via the Scryfall SDK found [here](https://github.com/ChiriVulpes/scryfall-sdk).

The application implements rate limiting (100ms delay between requests) to comply with [Scryfall's rate limit policy](https://scryfall.com/docs/api).
