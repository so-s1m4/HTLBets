import { createServer } from 'node:http';

import { app } from './app';
import { env } from './config/env';
import { createSocketServer } from './modules/websocket/socket.server';

const httpServer = createServer(app);
createSocketServer(httpServer);

httpServer.listen(env.PORT, () => {
  console.log(`Server running on http://localhost:${env.PORT}`);
});
