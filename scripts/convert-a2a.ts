import fs from 'fs';
import path from 'path';

const inputFile = 'a2a.json';
const outputFile = 'src/types/a2a.ts';

interface JsonSchema {
    type?: string;
    title?: string;
    description?: string;
    properties?: Record<string, JsonSchema>;
    additionalProperties?: boolean | JsonSchema;
    patternProperties?: Record<string, JsonSchema>;
    items?: JsonSchema;
    $ref?: string;
    enum?: any[];
    format?: string;
    default?: any;
    anyOf?: JsonSchema[];
    oneOf?: JsonSchema[];
    allOf?: JsonSchema[];
}

interface DefinitionBundle {
    definitions: Record<string, JsonSchema>;
}

function sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9]/g, ' ').split(' ').map(word => {
        if (word.toUpperCase() === 'O' && name.includes('OAuth')) return 'O';
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join('').replace(/OAuth/g, 'OAuth');
}

function sanitizePatternKey(name: string): string {
    return name.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}

function getRefName(ref: string): string {
    // Refs in this bundle use filenames like "lf.a2a.v1.AgentCard.jsonschema.json"
    // or internal pointers. We need to map them back to definition keys.
    const parts = ref.split('.');
    for (let i = 0; i < parts.length; i++) {
        if (parts[i] === 'v1' && i + 1 < parts.length) {
            let name = parts[i + 1];
            // Protocol definitions often have spaces in title but camelCase in filenames
            // We'll try to match by titles or sanitized names.
            return name;
        }
    }
    return ref.split('/').pop()?.replace('.jsonschema.json', '') || ref;
}

// Map of ref filenames to definition titles/keys
const refMap: Record<string, string> = {
    'lf.a2a.v1.AgentCapabilities.jsonschema.json': 'Agent Capabilities',
    'lf.a2a.v1.AgentCard.jsonschema.json': 'Agent Card',
    'lf.a2a.v1.AgentCardSignature.jsonschema.json': 'Agent Card Signature',
    'lf.a2a.v1.AgentExtension.jsonschema.json': 'Agent Extension',
    'lf.a2a.v1.AgentInterface.jsonschema.json': 'Agent Interface',
    'lf.a2a.v1.AgentProvider.jsonschema.json': 'Agent Provider',
    'lf.a2a.v1.AgentSkill.jsonschema.json': 'Agent Skill',
    'lf.a2a.v1.Artifact.jsonschema.json': 'Artifact',
    'lf.a2a.v1.AuthenticationInfo.jsonschema.json': 'Authentication Info',
    'lf.a2a.v1.AuthorizationCodeOAuthFlow.jsonschema.json': 'Authorization CodeOAuth Flow',
    'lf.a2a.v1.CancelTaskRequest.jsonschema.json': 'Cancel Task Request',
    'lf.a2a.v1.ClientCredentialsOAuthFlow.jsonschema.json': 'Client CredentialsOAuth Flow',
    'lf.a2a.v1.DeleteTaskPushNotificationConfigRequest.jsonschema.json': 'Delete Task Push Notification Config Request',
    'lf.a2a.v1.DeviceCodeOAuthFlow.jsonschema.json': 'Device CodeOAuth Flow',
    'lf.a2a.v1.GetExtendedAgentCardRequest.jsonschema.json': 'Get Extended Agent Card Request',
    'lf.a2a.v1.GetTaskPushNotificationConfigRequest.jsonschema.json': 'Get Task Push Notification Config Request',
    'lf.a2a.v1.GetTaskRequest.jsonschema.json': 'Get Task Request',
    'lf.a2a.v1.HTTPAuthSecurityScheme.jsonschema.json': 'HTTP Auth Security Scheme',
    'lf.a2a.v1.ImplicitOAuthFlow.jsonschema.json': 'ImplicitOAuth Flow',
    'lf.a2a.v1.ListTaskPushNotificationConfigsRequest.jsonschema.json': 'List Task Push Notification Configs Request',
    'lf.a2a.v1.ListTaskPushNotificationConfigsResponse.jsonschema.json': 'List Task Push Notification Configs Response',
    'lf.a2a.v1.ListTasksRequest.jsonschema.json': 'List Tasks Request',
    'lf.a2a.v1.ListTasksResponse.jsonschema.json': 'List Tasks Response',
    'lf.a2a.v1.Message.jsonschema.json': 'Message',
    'lf.a2a.v1.MutualTlsSecurityScheme.jsonschema.json': 'Mutual Tls Security Scheme',
    'lf.a2a.v1.OAuth2SecurityScheme.jsonschema.json': 'OAuth2 Security Scheme',
    'lf.a2a.v1.OAuthFlows.jsonschema.json': 'OAuth Flows',
    'lf.a2a.v1.OpenIdConnectSecurityScheme.jsonschema.json': 'Open Id Connect Security Scheme',
    'lf.a2a.v1.Part.jsonschema.json': 'Part',
    'lf.a2a.v1.PasswordOAuthFlow.jsonschema.json': 'PasswordOAuth Flow',
    'lf.a2a.v1.SecurityRequirement.jsonschema.json': 'Security Requirement',
    'lf.a2a.v1.SecurityScheme.jsonschema.json': 'Security Scheme',
    'lf.a2a.v1.SendMessageConfiguration.jsonschema.json': 'Send Message Configuration',
    'lf.a2a.v1.SendMessageRequest.jsonschema.json': 'Send Message Request',
    'lf.a2a.v1.SendMessageResponse.jsonschema.json': 'Send Message Response',
    'lf.a2a.v1.StreamResponse.jsonschema.json': 'Stream Response',
    'lf.a2a.v1.StringList.jsonschema.json': 'String List',
    'lf.a2a.v1.SubscribeToTaskRequest.jsonschema.json': 'Subscribe To Task Request',
    'lf.a2a.v1.Task.jsonschema.json': 'Task',
    'lf.a2a.v1.TaskArtifactUpdateEvent.jsonschema.json': 'Task Artifact Update Event',
    'lf.a2a.v1.TaskPushNotificationConfig.jsonschema.json': 'Task Push Notification Config',
    'lf.a2a.v1.TaskStatus.jsonschema.json': 'Task Status',
    'lf.a2a.v1.TaskStatusUpdateEvent.jsonschema.json': 'Task Status Update Event',
    'google.protobuf.Struct.jsonschema.json': 'Struct',
    'google.protobuf.Timestamp.jsonschema.json': 'Timestamp',
    'google.protobuf.Value.jsonschema.json': 'Value'
};

function resolveRef(ref: string): string {
    if (refMap[ref]) return sanitizeName(refMap[ref]);
    if (ref.startsWith('#/definitions/')) {
        return sanitizeName(ref.replace('#/definitions/', ''));
    }
    return 'any';
}

function jsonSchemaToTs(schema: JsonSchema, indent: string = ''): string {
    if (schema.$ref) {
        return resolveRef(schema.$ref);
    }

    if (schema.anyOf || schema.oneOf) {
        const types = (schema.anyOf || schema.oneOf || []).map(s => jsonSchemaToTs(s, indent));
        return types.join(' | ');
    }

    if (schema.allOf) {
        return schema.allOf.map(s => jsonSchemaToTs(s, indent)).join(' & ');
    }

    if (schema.enum) {
        return schema.enum.map(e => JSON.stringify(e)).join(' | ');
    }

    switch (schema.type) {
        case 'string':
            if (schema.format === 'date-time') return 'string'; // Or Date if you prefer
            return 'string';
        case 'number':
        case 'integer':
            return 'number';
        case 'boolean':
            return 'boolean';
        case 'array':
            const itemType = schema.items ? jsonSchemaToTs(schema.items, indent) : 'any';
            return `${itemType}[]`;
        case 'object':
            let result = '{\n';
            const nextIndent = indent + '    ';
            const propertyKeys = new Set(Object.keys(schema.properties || {}));
            
            if (schema.properties) {
                for (const [key, prop] of Object.entries(schema.properties)) {
                    if (prop.description) {
                        result += `${nextIndent}/** ${prop.description.replace(/\n/g, `\n${nextIndent} * `)} */\n`;
                    }
                    result += `${nextIndent}${key}?: ${jsonSchemaToTs(prop, nextIndent)};\n`;
                }
            }

            if (schema.patternProperties) {
                for (const [pattern, prop] of Object.entries(schema.patternProperties)) {
                    // Extract the property name from pattern like "^(extended_agent_card)$"
                    const match = pattern.match(/^\^\((\w+)\)\$$/);
                    const propName = match ? match[1] : null;
                    
                    // If the pattern property exists as an explicit property, skip the index signature
                    // to avoid "Property '...' of type '...' is not assignable to 'string' index type '...'"
                    if (propName && propertyKeys.has(sanitizePatternKey(propName))) {
                        continue;
                    }
                    
                    const propType = jsonSchemaToTs(prop, nextIndent);
                    result += `${nextIndent}[key: string]: ${propType}; // pattern: ${pattern}\n`;
                }
            }

            if (schema.additionalProperties && !schema.patternProperties) {
                const addType = typeof schema.additionalProperties === 'object' ? jsonSchemaToTs(schema.additionalProperties, nextIndent) : 'any';
                result += `${nextIndent}[key: string]: ${addType};\n`;
            }

            result += `${indent}}`;
            return result;
        default:
            return 'any';
    }
}

async function convert() {
    const data: DefinitionBundle = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    let tsCode = `/**\n * Anti-Gravity Generated A2A Types\n * Source: ${inputFile}\n */\n\n`;

    // Process definitions
    for (const [key, schema] of Object.entries(data.definitions)) {
        const typeName = sanitizeName(key);
        if (schema.description) {
            tsCode += `/**\n * ${schema.description.replace(/\n/g, '\n * ')}\n */\n`;
        }
        
        if (schema.type === 'object' && schema.properties) {
            tsCode += `export interface ${typeName} ${jsonSchemaToTs(schema)}\n\n`;
        } else {
            tsCode += `export type ${typeName} = ${jsonSchemaToTs(schema)};\n\n`;
        }
    }

    fs.writeFileSync(outputFile, tsCode);
    console.log(`Generated ${outputFile}`);
}

convert();
