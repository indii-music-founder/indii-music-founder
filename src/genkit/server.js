import { startFlowServer } from "@genkit-ai/express";
import { flows } from "./flows.js";

const port = Number(process.env.PORT) || 8080;

export const server = startFlowServer({
    flows,
    port,
    cors: { origin: "*" },
});

export default server;
