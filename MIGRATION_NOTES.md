# Zero-cost infrastructure migration

This copy removes the local PostgreSQL/Redis + Docker dependency from the scaffold.

Changed:
- PostgreSQL/Drizzle removed.
- Redis/ioredis removed from the API scaffold.
- MongoDB Node.js Driver added.
- Health endpoint now checks MongoDB.
- Docker Compose and Drizzle config/migration scaffold removed.
- Environment configuration now uses `MONGODB_URI` and `MONGODB_DB_NAME`.

Next local setup:
1. Copy `.env.example` to `.env`.
2. Put the MongoDB Atlas connection string in `MONGODB_URI`.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open `http://localhost:5173` and verify the API health card.
