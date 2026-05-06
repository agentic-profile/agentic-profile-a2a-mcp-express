import {
    NextFunction,
    Request, 
    Response
} from "express";
import {
    prettyJson, 
    getLogger,
    resolveServerErrorHttpStatus
} from "@agentic-profile/common";

const log = getLogger('a2a-mcp-express.express');

export type AsyncMiddleware = (req: Request, res: Response, next: NextFunction) => Promise<any>;

export const asyncHandler = (fn: AsyncMiddleware) => function( req: Request, res: Response, next: NextFunction ) {
    const fnReturn = fn(req,res,next)
    return Promise.resolve(fnReturn).catch( err => {
        signalError(req,res,err);
    });
}

export function baseUrl( req: Request ) {
    return (req.protocol + "://" + req.get('host')).toLowerCase();
}


//
// Handle errors that bubble to the top
//

// Use this method when we have an Error object
export function signalError( req: Request, res: Response, err:any ) {
    const {
        kind = "InternalError", details, name, // custom
        message, stack, cause                  // standard Error object properties
    } = err;
    
    const httpStatusCode = resolveServerErrorHttpStatus(err);

    const msg = cause ? `${message ?? name} [cause] ${cause.message}` : message ?? name;
    
    const failure = {
        kind,
        message: msg,
        details: mergeDetails( details, stack )
    }
    if( cause )
        (failure as any).cause = cause;

    logFailure( req, failure, err );
    res.status( httpStatusCode ).json({ failure });
}

function mergeDetails( details: any, stack: string ) {
    return {
        ...(details ?? {}),
        stack: stack?.split(/\n/).map((e:string)=>e.trim()).slice(0,7)
    }
}

function logFailure( req: Request, failure: any, err?: any ) {
    log.error( 'ERROR:', prettyJson({
        url: req.originalUrl,
        headers: req.headers,
        body: req.body,
        failure,
        errorMessage: err?.message
    }) );
}
