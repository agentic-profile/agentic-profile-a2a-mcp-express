import {
    AgentExecutor,
    RequestContext,
    ExecutionEventBus,
    AgentExecutionEvent
} from '@a2a-js/sdk/server';
import { TaskStatus } from '@a2a-js/sdk';
import { v4 as uuidv4 } from 'uuid';
import { jrpcErrorAuthRequired, JsonRpcRequestHandler } from '../json-rpc-service/index.js';
import { JsonRpcRequest, JsonRpcResponse } from '../json-rpc-client/types.js';
import { ClientAgentSession } from '@agentic-profile/auth';
import { JsonRpcRequestContext } from '../json-rpc-service/types.js';
import { getLogger } from '@agentic-profile/common';

const log = getLogger('a2a-mcp-express.a2a-service');

export function createA2AExecutorHandler(executor: AgentExecutor, requireAuth: boolean = true): JsonRpcRequestHandler {

    const handler = async (jrpcRequest: JsonRpcRequest, { session, req }: JsonRpcRequestContext): Promise<JsonRpcResponse> => {
        log.debug('Handling A2A request with executor...');
        log.debug('Request body:', JSON.stringify(jrpcRequest, null, 4));

        // Required authentication
        if (requireAuth && !session)
            return jrpcErrorAuthRequired(jrpcRequest.id!);

        // Create A2A request context from request body
        const { params, id } = jrpcRequest;
        const { contextId = uuidv4(), includeAllUpdates = false } = req.body
        const requestContext = {
            taskId: id ? `${id}` : '', // RequestContext doesn't support null/undefined, even though A2A allows it
            contextId,
            userMessage: params.message,
            task: params.task,
            session,
            params
        } as RequestContext;

        // Create an event bus to collect updates
        const updates: AgentExecutionEvent[] = [];
        const eventBus: ExecutionEventBus = {
            publish: (event: AgentExecutionEvent) => {
                updates.push(event);
                log.debug('Task event:', event);
            },
            finished: () => {
                log.debug('Task execution finished');
            },
            on: (_eventName: "event" | "finished", _listener: (event: AgentExecutionEvent) => void) => {
                return eventBus;
            },
            off: (_eventName: "event" | "finished", _listener: (event: AgentExecutionEvent) => void) => {
                return eventBus;
            },
            once: (_eventName: "event" | "finished", _listener: (event: AgentExecutionEvent) => void) => {
                return eventBus;
            },
            removeAllListeners: (_eventName?: "event" | "finished") => {
                return eventBus;
            }
        };

        // Execute the task using the executor
        await executor.execute(requestContext, eventBus);

        // Find the final update
        let result;
        if (updates.length == 0) {
            throw new Error('No task updates received from executor');
        } else if (updates.length == 1 && updates[0].kind === "message") {
            result = updates[0];
        } else {
            const finalUpdate = updates.find(update => update.kind === "status-update" && update.status.state === "completed") || updates[updates.length - 1];
            if (!finalUpdate) {
                throw new Error('No task updates received from executor');
            }

            const status: TaskStatus | undefined = (finalUpdate as any).status as TaskStatus;

            result = {
                taskId: id,
                ...finalUpdate,
                final: status?.state === "completed",
                ...(includeAllUpdates && { allUpdates: updates })
            };
        }

        return {
            jsonrpc: '2.0',
            id: id ?? '',
            result
        };
    };

    return handler;
}

export function resolveSession(requestContext: RequestContext): ClientAgentSession | undefined {
    return (requestContext as any)?.session as ClientAgentSession | undefined;
}
