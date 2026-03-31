const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:9222/devtools/page/BA85B3E948BA046284DB2B6E35F9570C');
ws.on('open', () => {
    ws.send(JSON.stringify({id: 1, method: 'Runtime.evaluate', params: {expression: 'document.body.innerHTML.substring(0, 1000)'}}));
});
ws.on('message', m => { console.log(m.toString()); process.exit(); });
