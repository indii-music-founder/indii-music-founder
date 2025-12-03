const net = require('net');

const PORT = 8811;
const HOST = '127.0.0.1';

function test(name, payload) {
    return new Promise((resolve) => {
        console.log(`\n--- Test: ${name} ---`);
        const client = new net.Socket();
        let received = false;

        client.connect(PORT, HOST, () => {
            console.log('Connected');
            if (payload) {
                console.log('Sending payload...');
                client.write(payload);
            }
        });

        client.on('data', (data) => {
            console.log('Received:', data.toString());
            received = true;
            client.destroy();
        });

        client.on('close', () => {
            console.log('Connection closed');
            resolve();
        });

        client.on('error', (err) => {
            console.log('Error:', err.message);
            resolve();
        });

        // Timeout
        setTimeout(() => {
            if (!received) {
                console.log('Timeout waiting for data');
                client.destroy();
            }
        }, 2000);
    });
}

async function run() {
    // 1. Just connect and wait
    await test('Connect and Wait', null);

    // 2. JSON-RPC Initialize
    const initMsg = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "debug", version: "1.0" }
        }
    }) + '\n';
    await test('JSON-RPC Initialize', initMsg);

    // 3. HTTP GET
    await test('HTTP GET', 'GET / HTTP/1.1\r\nHost: localhost\r\n\r\n');
}

run();
