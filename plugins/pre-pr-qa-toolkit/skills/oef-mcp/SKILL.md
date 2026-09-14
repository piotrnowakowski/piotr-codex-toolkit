---
name: oef-mcp
description: Use the connected OEF MCP app to search OEF knowledge, work tracking, Notion, Google Workspace, emissions data, and team information. Use when a task requires current OEF organizational or CityCatalyst data that is available through OEF MCP.
---

# OEF MCP

## Prerequisite

This skill requires the **OEF MCP** connector to be connected in Codex. The connector is account-scoped and is not bundled with this marketplace package; do not add endpoints, access tokens, or credentials to this repository.

If its tools are unavailable, tell the user to connect OEF MCP in Codex, then continue with the task. Do not substitute a stale local copy for current organizational data.

## Tool routing

Use the narrowest OEF MCP tool that answers the question:

- Search internal knowledge first with `search_knowledge`; use `read_file` only for a returned path that needs its full context.
- For people or reporting lines, use `get_team_member`.
- For current CityCatalyst emissions information, start with `list_datasources`, then use `get_city_emissions` with a verified source identifier.
- For live Notion content, use `search_notion` and then `query_notion_database` when the user needs structured OKR, directory, initiative, epic, or sprint information.
- For ON Jira work, use `search_jira`; use `get_sprint_status`, `get_epic_status`, `get_ticket_details`, or `get_carryover_report` when their more specific view is needed.
- For a Google Doc, Sheet, or Drive folder the user identifies, use the corresponding OEF MCP Google Workspace reader.

## Knowledge updates

When the user supplies a durable fact that is missing from or conflicts with the knowledge base, call `propose_knowledge_update` before any submission. Submit a knowledge update only after the user approves the proposed change; OEF MCP creates that change as a GitHub pull request.

## Evidence

Treat OEF MCP results as the source for the current answer. Identify the returned file, ticket, database, document, datasource, or city in the response when it materially supports the conclusion. Clearly distinguish a connector lookup from an inference.
