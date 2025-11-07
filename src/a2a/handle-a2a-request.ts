import {
    AgentExecutor,
    RequestContext,
    ExecutionEventBus,
    AgentExecutionEvent
} from '@a2a-js/sdk/server';
import { Request } from 'express';
import { TaskStatus } from '@a2a-js/sdk';
import { v4 as uuidv4 } from 'uuid';
import { jrpcErrorAuthRequired, JsonRpcRequest, JsonRpcRequestHandler, JsonRpcResponse } from '../json-rpc/index.js';
import { ClientAgentSession } from '@agentic-profile/auth';

export function createA2ARequestHandler( executor: AgentExecutor, requireAuth: boolean = true ): JsonRpcRequestHandler {

    const handler = async ( jrpcRequest: JsonRpcRequest, session: ClientAgentSession | null, req: Request ): Promise<JsonRpcResponse | null> => {
        console.log('💼 Handling A2A request with executor...');
        console.log('💼 Request body:', JSON.stringify(jrpcRequest, null, 4));

        // Required authentication
        if( requireAuth && !session )
            return jrpcErrorAuthRequired( jrpcRequest.id! );
        
        // Create request context from request body
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
                console.log('💼 Task event:', event);
            },
            finished: () => {
                console.log('💼 Task execution finished');
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
        if( updates.length == 0 ) {
            throw new Error('No task updates received from executor');
        } else if( updates.length == 1 && updates[0].kind === "message" ) {
            result = updates[0];
        } else {
            const finalUpdate = updates.find(update => update.kind === "status-update" && update.status.state === "completed") || updates[updates.length - 1];
            if( !finalUpdate ) {
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
