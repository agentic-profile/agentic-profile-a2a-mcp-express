import {
    b64u,
    ClientAgentSession,
    ClientAgentSessionStore,
    createChallenge,
    handleAuthorization
} from "@agentic-profile/auth";
import { Resolver } from 'did-resolver';
import { Request, Response } from 'express';
import {
    prettyJson,
    getLogger,
    isServerError
} from "@agentic-profile/common";

import { jrpcError, describeJsonRpcRequestError, serverErrorToJsonRpcResponse } from './utils.js';
import { ExpressRequestHandler, AGENTIC_AUTH_REQUIRED_JSON_RPC_CODE, JsonRpcRequestHandler } from "./types.js";
import { JsonRpcRequest, JsonRpcResponse } from '../json-rpc-client/types.js';


const log = getLogger('a2a-mcp-express.json-rpc-service');

export function createAuthenticatingExpressRequestHandler(clientAgentSessionStore: ClientAgentSessionStore, didResolver: Resolver): ExpressRequestHandler {
    return async (req: Request, res: Response, handleJsonRpcRequest: JsonRpcRequestHandler) => {
        const jrpcRequest = req.body as JsonRpcRequest;
        const { id, method } = jrpcRequest;
        const logContext = `${req.url} ${id} ${method}`;

        try {
            // Validate JSON-RPC request
            const requestError = describeJsonRpcRequestError(jrpcRequest);
            if (requestError) {
                log.warn('Authenticating express request error:', requestError, logContext);
                res.json(jrpcError(id || 'unknown', -32700, requestError));
                return;
            }
            log.debug('Authenticating express request', logContext, typeof req.body, prettyJson(req.body));

            // Are they providing an agentic session?
            let session: ClientAgentSession | undefined;
            const { authorization } = req.headers;
            if (authorization)
                session = await handleAuthorization(authorization, clientAgentSessionStore, didResolver) ?? undefined;

            const jrpcResponse = await handleJsonRpcRequest(jrpcRequest, { session, req, res });
            if (!jrpcResponse) { // quick sanity check, should never happen ;)
                // has the response already been handled/closed?
                if( res.headersSent || res.writableEnded )
                    return;

                log.error(`handleJsonRpcRequest() returned null for ${logContext}`);
                res.json(jrpcError(id!, -32603, `JSON RPC handler returned null for ${logContext}`));
                return;
            }

            if ('result' in jrpcResponse) {
                log.debug('Success result:', logContext, prettyJson(jrpcResponse));
                res.json(jrpcResponse); // Return response as-is with 200 status
                return;
            }

            // Error?
            if ('error' in jrpcResponse) {
                const { error } = jrpcResponse as JsonRpcResponse;
                if (error?.code === AGENTIC_AUTH_REQUIRED_JSON_RPC_CODE) {
                    log.debug('Auth required, creating challenge', logContext);
                    const challenge = await createChallenge(clientAgentSessionStore);

                    // ugh... breaking out of normal 200 response pattern for JSON-RPC
                    res.status(401)
                        .set('WWW-Authenticate', `Agentic ${b64u.objectToBase64Url(challenge)}`)
                        .set('Access-Control-Expose-Headers', 'WWW-Authenticate')
                        .json(jrpcResponse);
                    return;
                }

                // Other errors...
                log.debug(`JSON-RPC error code ${error?.code} for ${logContext}`, prettyJson(jrpcResponse));
                res.json(jrpcResponse);
                return;
            }

            // Should never get there... bad JSON-RPC response...
            const warning = `Invalid JSON-RPC response ${logContext}`;
            log.error( warning, prettyJson(jrpcResponse));
            res.json(jrpcError(id || 'unknown', -32603, warning, jrpcResponse));
        } catch (error) {
            if( isServerError(error) ) {
                const result = serverErrorToJsonRpcResponse(error);
                log.info(`JSON-RPC method handler server error: ${logContext}`, prettyJson(result));
                res.json(result);
            } else {
                log.error(`JSON-RPC method handler unhandled error: ${logContext}`, error);
                res.json(jrpcError(req.body.id || 'unknown', -32603, `Internal error: ${error}`));
            }
        }
    }
}
