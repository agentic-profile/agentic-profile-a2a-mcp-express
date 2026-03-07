import { Router, Request, Response, type Router as ExpressRouter } from 'express';
import { jrpcResult, createAuthenticatingExpressRequestHandler, jrpcError } from '../json-rpc-service/index.js';
import { ClientAgentSessionStore } from '@agentic-profile/auth';
import { handleMcpGet, handleMcpDelete } from './mcp-stream.js';
import { DEFAULT_MCP_INITIALIZE_RESPONSE } from './misc.js';
import { Resolver } from 'did-resolver';
import { JsonRpcRequestContext } from '../json-rpc-service/types.js';
import { JsonRpcRequest, JsonRpcResponse } from '../json-rpc-client/types.js';


type Lists = {
    prompts?: any[];
    resources?: any[];
    tools?: any[];
}

type InitializeResponse = {
    serverInfo?: {
        name?: string;
        title?: string;
        version?: string;
    };
}

type MethodHandler = (req: JsonRpcRequest, context: JsonRpcRequestContext) => Promise<JsonRpcResponse | null>;

type Handlers = {
    toolsCall?: MethodHandler;
    initialize?: MethodHandler;
    notificationsInitialized?: MethodHandler;
    loggingSetLevel?: MethodHandler;
    promptsList?: MethodHandler;
    resourcesList?: MethodHandler;
    resourcesRead?: MethodHandler;
    toolsList?: MethodHandler;
}

export type McpServiceRouterParams = {
    handlers: Handlers;
    initializeResponse?: InitializeResponse;
    lists?: Lists;
    store: ClientAgentSessionStore;
    didResolver: Resolver;
}

export function createMcpServiceRouter({ handlers, initializeResponse, lists, store, didResolver }: McpServiceRouterParams) {
    const router: ExpressRouter = Router();

    const authenticatingRequestHandler = createAuthenticatingExpressRequestHandler(store, didResolver);

    async function handleMcpRequest(req: Request, res: Response) {
        await authenticatingRequestHandler(req, res, async (jrpcRequest: JsonRpcRequest, context: JsonRpcRequestContext): Promise<JsonRpcResponse | null> => {
            const requestId = jrpcRequest.id!;
            switch (jrpcRequest.method) {
                case 'initialize':
                    return handlers?.initialize ? await handlers.initialize(jrpcRequest, context) : jrpcResult(requestId, {
                        ...DEFAULT_MCP_INITIALIZE_RESPONSE,
                        ...initializeResponse,
                    });
                case 'notifications/initialized':
                    return handlers?.notificationsInitialized ? await handlers.notificationsInitialized(jrpcRequest, context) : jrpcResult(requestId, {});
                case 'logging/setLevel':
                    return handlers?.loggingSetLevel ? await handlers.loggingSetLevel(jrpcRequest, context) : jrpcResult(requestId, {});
                case 'prompts/list':
                    return handlers?.promptsList ? await handlers.promptsList(jrpcRequest, context) : jrpcResult(requestId, { prompts: lists?.prompts ?? [] });
                case 'resources/list':
                    return handlers?.resourcesList ? await handlers.resourcesList(jrpcRequest, context) : jrpcResult(requestId, { resources: lists?.resources ?? [] });
                case 'resources/read':
                    return handlers?.resourcesRead ? await handlers.resourcesRead(jrpcRequest, context) : jrpcResult(requestId, {});
                case 'tools/list':
                    return handlers?.toolsList ? await handlers.toolsList(jrpcRequest, context) : jrpcResult(requestId, { tools: lists?.tools ?? [] });
                case 'tools/call':
                    if (handlers?.toolsCall)
                        return await handlers.toolsCall(jrpcRequest, context);
                default:
                    return jrpcError(requestId, -32600, `Invalid method: ${jrpcRequest.method}`);
            }
        });
    };

    router.post('/', handleMcpRequest);
    router.get('/', handleMcpGet);
    router.delete('/', handleMcpDelete);

    return router;
}

/*
const INITIALIZE_RESPONSE = {
    ...DEFAULT_MCP_INITIALIZE_RESPONSE,
    "serverInfo": {
        "name": "Volunteer Service",
        "title": "Publish and query volunteer profiles",
        "version": "1.0.0"
    }
};
*/