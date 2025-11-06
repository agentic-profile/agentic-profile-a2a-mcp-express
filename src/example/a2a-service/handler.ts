import { v4 as uuidv4 } from 'uuid';
import {
    AgentExecutor,
    RequestContext,
    ExecutionEventBus,
} from "@a2a-js/sdk/server";
import { Message /*, TextPart */} from '@a2a-js/sdk';
import { resolveSession } from '../../a2a/handle-a2a-request.js';
import { AgentMessageEnvelope } from '@agentic-profile/common';
import { parseDid } from '../../misc.js';

export class A2AServiceHandler implements AgentExecutor {  
    public cancelTask = async (
        taskId: string,
        _eventBus: ExecutionEventBus
    ): Promise<void> => {
        console.log(`VentureExecutor:cancelTask is not supported: ${taskId}`);
    };
  
    async execute(
        requestContext: RequestContext,
        eventBus: ExecutionEventBus
    ): Promise<void> {
        // A2A message and session
        const { userMessage: a2aUserMessage } = requestContext;
        const envelope = a2aUserMessage.metadata?.envelope as AgentMessageEnvelope | undefined;
        const toAgentDid = envelope?.to;
        if( !toAgentDid )
            throw new Error("Message envelope is missing recipient id (toAgentDid property)");
        const { fragment: toFragment } = parseDid(toAgentDid);
        if( !toFragment )
            throw new Error("Invalid toAgentDid, missing fragment: " + toAgentDid);
        if( toFragment !== "venture" )
            throw new Error("Invalid toAgentDid, fragment is not 'venture': " + toAgentDid);

        // get the session
        const session = resolveSession(requestContext);
        const text = session ? pickRandomWelcomeMessage() : "Please authenticate, and I will say hello :)";

        const fromAgentDid = session?.agentDid ?? "unknown";  // might or might not include fragment...
        const contextId = `${toAgentDid}^${fromAgentDid}`;  // e.g. did:web:iamagentic.ai:1#venture^did:web:iamagentic.ai:1#venture

        const a2aAgentMessage: Message = {
            kind: "message",
            contextId,
            messageId: uuidv4(),
            role: "agent",
            parts: [
                {
                    kind: "text",
                    text
                }
            ],
            //metadata
        };

        eventBus.publish(a2aAgentMessage);
        eventBus.finished();
    }
}

const WELCOME_MESSAGES = [
    "Hello!", // English
    "Hola!", // Spanish
    "Bonjour!", // French
    "Guten Tag!", // German
    "Ciao!", // Italian
    "こんにちは!", // Japanese (Kon'nichiwa)
    "你好!", // Chinese (Nǐ hǎo)
    "안녕하세요!", // Korean (Annyeonghaseyo)
    "Olá!", // Portuguese
    "Привет!", // Russian (Privet)
    "مرحبا!", // Arabic (Marhaba)
    "नमस्ते!", // Hindi (Namaste)
    "Hej!", // Swedish
    "Hallo!", // Dutch
    "Γεια σας!", // Greek (Yia sas)
    "Merhaba!", // Turkish
    "Witaj!", // Polish
    "Hei!", // Finnish
    "Ahoj!", // Czech
    "Здравейте!", // Bulgarian (Zdraveĭte)
]

function pickRandomWelcomeMessage(): string {
    return WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
}