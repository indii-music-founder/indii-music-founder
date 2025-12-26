const { spawn } = require('child_process');

console.log('Spawning Docker MCP client...');

const docker = spawn('/Applications/Docker.app/Contents/Resources/bin/docker', [
    'run',
    '-l', 'mcp.client=claude-desktop',
    '--rm',
    '-i',
    'alpine/socat',
    '-d', '-d',
    'STDIO',
    'TCP:host.docker.internal:8811'
], {
    env: {
        ...process.env,
        PATH: `${process.env.PATH}:/Applications/Docker.app/Contents/Resources/bin`
    }
});

docker.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
        if (line.trim()) {
            handleMessage(line);
        }
    });
});

docker.stderr.on('data', (data) => {
    console.error(`Docker stderr: ${data}`);
});

docker.on('close', (code) => {
    console.log(`Docker process exited with code ${code}`);
});

// 1. Send Initialize Request
const initRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
        protocolVersion: "2024-11-05",
        capabilities: {
            roots: {
                listChanged: true
            },
            sampling: {}
        },
        clientInfo: {
            name: "mcp-verifier",
            version: "1.0.0"
        }
    }
};

send(initRequest);

function send(msg) {
    console.log('Sending:', JSON.stringify(msg).substring(0, 100) + '...');
    docker.stdin.write(JSON.stringify(msg) + '\n');
}

function handleMessage(line) {
    try {
        const msg = JSON.parse(line);
        console.log('Received:', JSON.stringify(msg).substring(0, 100) + '...');

        if (msg.id === 1 && msg.result) {
            console.log('Initialization successful.');

            // 2. Send Initialized Notification
            send({
                jsonrpc: "2.0",
                method: "notifications/initialized"
            });

            // 3. List Tools
            console.log('Requesting tool list...');
            send({
                jsonrpc: "2.0",
                id: 2,
                method: "tools/list"
            });
        } else if (msg.id === 2 && msg.result) {
            console.log('\n--- Available Tools ---');
            if (msg.result.tools) {
                msg.result.tools.forEach(tool => {
                    console.log(`- ${tool.name}: ${tool.description ? tool.description.substring(0, 50) + '...' : 'No description'}`);
                });
            } else {
                console.log('No tools found in response.');
            }
            console.log('-----------------------\n');
            console.log('Verification Complete.');
            docker.stdin.end();
            process.exit(0);
        }
    } catch (e) {
        console.error('Error parsing message:', e);
    }
}
