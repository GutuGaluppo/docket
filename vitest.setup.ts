// Point the client at a real database when one is offered; the isolation
// integration test runs only then. Otherwise a syntactically valid placeholder
// is enough: SQL-shape tests build queries without ever connecting.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

process.env.DATABASE_URL ??=
  "postgresql://user:password@ep-test-pooler.eu-central-1.aws.neon.tech/docket?sslmode=require";
process.env.AUTH_SECRET ??= "test-secret";
