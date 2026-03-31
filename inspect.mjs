import WebSocket from 'ws';
const ws = new WebSocket('ws://localhost:9222/devtools/page/BA85B3E948BA046284DB2B6E35F9570C');
ws.on('open', () => {
    ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
            expression: `(() => {
                const root = document.querySelector('#root') || document.body;
                return {
                    first1000Html: root.innerHTML.substring(0, 1000),
                    firstLevelNodes: Array.from(root.children).map(c => ({tag: c.tagName, id: c.id, cls: c.className}))
                };
            })()`,
            returnByValue: true
        }
    }));
});
ws.on('message', m => {
    console.log(JSON.stringify(JSON.parse(m.toString()).result.result.value, null, 2));
    process.exit();
});
