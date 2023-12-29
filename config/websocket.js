// websocket.js

const WebSocket = require('ws');

let wss; 

function setupWebSocketServer(server) {
  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });

  });

  return wss;
}

function getWss() {
  if (!wss) {
    throw new Error('WebSocket server not initialized. Call setupWebSocketServer first.');
  }
  return wss;
}

module.exports = { setupWebSocketServer, getWss };
