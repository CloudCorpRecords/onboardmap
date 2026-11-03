/**
 * onboardmap MCP server. Tools: build_onboard_map.
 *
 * Why the low-level Server instead of McpServer: the high-level
 * helper converts zod schemas to JSON Schema and injects keys
 * not in this tool's defined spec ("$schema" and
 * "additionalProperties"), which breaks exact tool-list/schema
 * parity with the spec. This file serves tools/list with the
 * spec's exact input schema as an explicit literal, and every
 * tools/call is validated by the core, which names the
 * offending path on invalid input.
 *
 * The computation is pure and local: no repository, no
 * filesystem, no network, and no configuration — the caller
 * supplies every repository fact the map is based on.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { buildOnboardMap, formatPayload, VERSION } from "./onboardmap.js";

const TOOLS = [
  {
    name: "build_onboard_map",
    description:
      "Build a newcomer map from caller-supplied repository facts: files grouped into areas, entry points, where the tests live, and who owns what. Returns the map only; no repository is read.",
    inputSchema: {
      type: "object" as const,
      properties: {
        files: {
          type: "array",
          description:
            "Repository file paths, repo-relative, in the caller's order",
          items: {
            type: "string",
          },
        },
        entry_points: {
          type: "array",
          description: "Paths the caller names as entry points (optional)",
          items: {
            type: "string",
          },
        },
        test_command: {
          type: "string",
          description:
            "Command that runs the test suite, echoed into the map (optional)",
        },
        owners: {
          type: "object",
          description: "Map from path prefix to owner name (optional)",
          additionalProperties: {
            type: "string",
          },
        },
      },
      required: ["files"],
    },
  },
];

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "onboardmap", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let out: unknown;
    if (name === "build_onboard_map") {
      out = buildOnboardMap(args ?? {});
    } else {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return textResult(formatPayload(out));
  } catch (err) {
    if (err instanceof McpError) throw err;
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
