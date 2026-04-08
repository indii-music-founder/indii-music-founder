import { expressApp } from './mcp';

const port = 3001;
expressApp.listen(port, () => {
    console.log(`[Test Server] Local MCP test server running at http://localhost:${port}`);
});
