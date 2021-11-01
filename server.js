const http = require('http');
const Koa = require('koa');
const koaBody = require('koa-body');
const WS = require('ws');
const Router = require('koa-router');
const cors = require('@koa/cors');

const app = new Koa();

// handle post requests
app.use(koaBody({
  text: true,
    urlencoded: true,
    multipart: true,
    json: true,
}));

// Cors
app.use(cors());

// // create router
const router = new Router();

// create server and websocket
const server = http.createServer(app.callback())
const wsServer = new WS.Server({ server });

app.use(router.routes()).use(router.allowedMethods());

// array with names of users
const userNames = [];

// check connection
router.get('/ping', async (ctx) => {
  ctx.response.body = 'pong';
  ctx.response.status = 200;
});

// add new user to the chat
router.post('/users', async (ctx) => {
  const name = ctx.request.body.name;
  const parsedName = name.toLowerCase();
  const existedName = userNames.some((name) => {
    return name.toLowerCase() === parsedName;
  });
  if (existedName) {
    ctx.throw(400, 'error! user with this name already exists');
  }
  userNames.push(name);
  ctx.response.status = 204;
  console.log(userNames);
});

// create Map's for each pair user/ws
const clients = new Map();

wsServer.on('connection', (ws) => { // add a pair user/ws to the list of clients
  
  clients.set(ws, userNames[userNames.length - 1]);

  // send new list of clients to all the clients
  [...wsServer.clients]
    .filter(o => clients.has(o))
    .forEach(o => o.send(JSON.stringify(userNames)));

  ws.on('message', (message) => {
    // send new message to every client in the chat
    [...wsServer.clients]
      .filter(o => clients.has(o))
      .forEach(o => o.send(message));
  });

  ws.on('close', function () {
    // index of the one that's left
    const quitedUserName = clients.get(ws);
    const userIndex = userNames.findIndex((userName) => userName === quitedUserName);

    // delete client from the list
    userNames.splice(userIndex, 1);
    clients.delete(ws);

    // refresh the list (send new list to active clients)
    [...wsServer.clients]
      .filter(o => clients.has(o))
      .forEach(o => o.send(JSON.stringify(userNames)));
  });
});

// start the port
const port = process.env.PORT || 7070;
server.listen(port);
