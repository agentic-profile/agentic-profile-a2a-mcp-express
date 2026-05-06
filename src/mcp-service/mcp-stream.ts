import { Request, Response } from 'express';
import { getLogger } from '@agentic-profile/common';

const log = getLogger('a2a-mcp-express.mcp-service');

// Server does not support SSE, so we return a 405
export async function handleMcpGet(req: Request, res: Response) {
    log.info('MCP GET request received', req.url);
    //res.status(405).json({});
        // jrpcError( id || 'unknown', -32600, requestError )
    res.set('Content-Type', 'text/event-stream').json({})
}

// Simply return a 200 for deletes, but this should never be called because GET returns a 405
export async function handleMcpDelete(req: Request, res: Response) {
    log.info('MCP DELETE request received', req.url );
    res.status(200).json({});
}