import { Request, Response } from 'express';

// Server does not support SSE, so we return a 405
export async function handleMcpGet(req: Request, res: Response) {
    console.log('🔍 MCP GET request received', req.body);
    //res.status(405).json({});
        // jrpcError( id || 'unknown', -32600, requestError )
    res.set('Content-Type', 'text/event-stream').json({})
}

// Simply return a 200 for deletes, but this should never be called because GET returns a 405
export async function handleMcpDelete(_req: Request, res: Response) {
    console.log('🔍 MCP DELETE request received');
    res.status(200).json({});
}