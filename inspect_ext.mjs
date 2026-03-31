import WebSocket from 'ws';
const ws = new WebSocket('ws://localhost:9222/devtools/page/8A598741ECD1635420751476BF2F5F10');
ws.on('open', () => {
    ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
            expression: `(() => {
                return {
                    firstLevelNodes: Array.from(document.body.children).map(c => ({tag: c.tagName, id: c.id, cls: c.className}))
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
