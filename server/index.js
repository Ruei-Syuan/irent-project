'use strict';

const { createApp } = require('./app');
const { createDatabase } = require('./database');

const port = Number(process.env.PORT) || 3000;
const database = createDatabase();
const app = createApp({ database });

const server = app.listen(port, () => {
  console.log(`iRent 管理後台已啟動：http://localhost:${port}`);
});

function shutdown() {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
