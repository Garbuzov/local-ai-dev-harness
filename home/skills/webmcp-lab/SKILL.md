---
name: webmcp-lab
description: "Use when you need to test or prototype a page's WebMCP tools from DeepSeek Harness through an MCP server that controls the browser."
whenToUse: "Debugging a page's WebMCP tools, your own prototype of tool registration, and moving the same logic into a stdio MCP server."
---

# WebMCP: an experiment lab

## 1. What WebMCP is and where the boundary runs

WebMCP is a proposal (W3C-oriented) that a page registers in the browser tools that an agent can call. It is Chrome-side and actively changing. The entry point in different versions of the prototype has been mentioned both as `navigator.modelContext` and as `document.modelContext`; which one is current in your Chrome build — check the Chrome documentation, not this file.

The boundary runs like this:

```
page --(registers WebMCP tools)--> Chrome browser
                                         ^
                            chrome-devtools-mcp (MCP server)
                                         |
DeepSeek Harness --(MCP: stdio / Streamable HTTP)--+
```

The key point: the harness MCP client (`@deepseek-ai/dsh-mcp-client`) talks only to MCP servers — via stdio or Streamable HTTP — and cannot reach a page's WebMCP tools directly: there is no browser transport in the harness today. Any experiment goes through an MCP server that controls the browser. The practical bridge is `chrome-devtools-mcp` (launched as `npx -y chrome-devtools-mcp@latest`): it works with a real Chrome instance, and Chrome has a documented "Debug WebMCP tools" scenario (https://developer.chrome.com/docs/devtools/application/webmcp).

## 2. Three experiment scenarios

### (a) Debugging a page's existing WebMCP tools

1. Verify in the Chrome documentation that your Chrome version supports WebMCP and what conditions are needed to enable the prototype.
2. Register `chrome-devtools-mcp` as an MCP server in the harness with the stdio launch `npx -y chrome-devtools-mcp@latest`. For the exact syntax of MCP server configuration, see the harness documentation — do not guess the keys.
3. Open the test page on your origin in a separate test Chrome profile.
4. In the `chrome-devtools-mcp` reference, find the tool that lists and/or calls the page's WebMCP tools, and enumerate the registered tools: names, descriptions, input schemas. MCP tool names are deliberately not given here — they change.
5. Call one tool with valid arguments, then with deliberately invalid ones.
6. Read the call result, then the page's console errors and network requests.
7. Record: what the tool was called, what it returned, what errors it gave.

### (b) Your own prototype: the page registers a tool

1. On your page, register one tool via the current WebMCP entry point. Verify the registration method name and schema format in the Chrome documentation: in the prototype they changed.
2. Make sure the registration falls within the page lifecycle moment required by the current version of the API.
3. In DevTools, check that the tool appeared in the list, that its input schema matches the expected one, and that the description is readable by an agent.
4. From the harness, via `chrome-devtools-mcp`, call the tool and compare the result with the call in DevTools.
5. Distinguish two failures:
   - "the tool is not registered" — the tool is absent from the DevTools list before the call; the cause is registration, origin, permissions or the API version;
   - "the call failed" — the tool is in the list, but the call returned an error: read the error text, the exception in the page console and the unhandled reject, not just the MCP status.
6. Check the behavior with invalid arguments and on a repeated call.

### (c) Your own MCP server over the same logic

If the logic does not require a browser, move it into your own stdio MCP server: then the harness calls it directly, without Chrome and without WebMCP. Verify the export names and signatures against the README of the installed version of `@modelcontextprotocol/sdk`: in other versions the same meaning was expressed differently (for example, through the low-level `Server` and request handlers).

```js
// package.json: "type": "module", dependencies @modelcontextprotocol/sdk and zod
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "webmcp-lab-bridge", version: "0.0.1" });

server.registerTool(
  "page_lookup",
  {
    description: "The same logic the page's WebMCP tool had.",
    inputSchema: { query: z.string() },
  },
  async ({ query }) => ({
    content: [{ type: "text", text: `query=${query}` }],
  }),
);

await server.connect(new StdioServerTransport());
```

Connect the server to the harness as a stdio MCP server. Keep stdout clean: only the protocol writes there, send diagnostics to stderr.

## 3. Limitations and pitfalls

- The API is not stable and changes between Chrome versions: entry points, registration methods, schemas, behavior. This file is not an API reference.
- Browser rights and permissions: tools that depend on permissions (geolocation, clipboard, camera) behave differently in an automated profile. Do not assume — verify.
- The page and its tools are visible to the agent exactly to the extent the user allowed: origin, profile, granted permissions.
- The bridge through an MCP server that controls the browser gives the agent access to the browser contents: sessions, cookies, internal pages. This is a data leak risk — isolate the profile and limit the accessible pages.
- Debug only your own pages and test profiles. Do not connect automation to a personal profile with real sessions.
- WebMCP tools and MCP tools are different things; the harness will only see the latter.
- Automation is not the same as a user scenario: focus, user activation and gestures may be absent.

## 4. Experiment checklist

- [ ] The Chrome version is known and verified against the Chrome WebMCP documentation.
- [ ] It is known what conditions or flags the prototype needs in this version.
- [ ] A separate test Chrome profile is up, the personal profile is not used.
- [ ] `chrome-devtools-mcp` runs as an MCP server and is visible to the harness.
- [ ] The list of `chrome-devtools-mcp` MCP tools is read from its reference, not guessed.
- [ ] The test page is open on your origin.
- [ ] The list of registered WebMCP tools is obtained and recorded.
- [ ] One tool is called with valid and with invalid arguments.
- [ ] The call result, console errors and network requests are read together.
- [ ] The difference between "not registered" and "the call failed" is recorded separately.
- [ ] Logic that does not require a browser is moved into a stdio MCP server.
- [ ] Your own server's stdout contains only the protocol.
- [ ] The result is recorded: Chrome version, tool names, schemas, output, errors.

## 5. Verify before use

Check against the current documentation, because the area changes:

- the current WebMCP entry point (`navigator.modelContext`, `document.modelContext` or another);
- the methods for registering and unregistering tools, the format of the name, description and input schema;
- the page lifecycle moment at which registration is allowed;
- the presence and conditions for enabling the prototype in your Chrome version;
- what the "Debug WebMCP tools" scenario looks like and is called now: https://developer.chrome.com/docs/devtools/application/webmcp;
- the current `chrome-devtools-mcp` reference: tool names, arguments, limitations;
- how MCP servers are registered in the harness (stdio) — per the harness documentation;
- the version of `@modelcontextprotocol/sdk` and the names of its exports;
- the security rules: what browser data will reach the agent and how that is limited.

Until this is verified, treat the API details as unknown, not as "roughly like this."
