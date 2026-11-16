---
name: "prompt-schema-authoring"
description: "Create or update any LLM prompt file in a repo using role/task/input/output block structure, optional tools block, and explicit model-aligned field contracts. Use for prompts in markdown, Python templates, or YAML/JSON config."
---

# prompt-schema-authoring

Use this skill to keep prompts explicit, contract-driven, and context-efficient.

## Workflow

1. Identify the runtime contract before editing the prompt.

- Open the target prompt in `*/prompts/`.
- Open the corresponding model in `app/modules/*/models.py` or any other schema used for the LLM input/output definitions.

2. Write prompt sections in this order.

- `<role>`
- `<task>`
- `<input>`
- `<tools>` (optional but preferred when tools are available)
- `<output>`
- Add `<example_output>` whenever possible.

3. Define `<input>` from real runtime payload only.

- List only fields actually passed in code.
- Add type and short purpose for each field.
- Exclude context-junk/internal fields unless the model truly needs them (for example `path`, `chunk_index`, `chunk_count`).

4. Define `<tools>` when tool selection/policy exists.

- Add `<tools>` for tool-capable prompts.
- List each tool and when to use it.
- List when not to use it.
- Keep user-facing formatting rules in `<output>`, not `<tools>`.
- Keep exact argument schemas in one place: `<output>`. In `<tools>`, focus on usage policy.

5. Define `<output>` from model contract only.

- State tool invocation requirements explicitly:
  - pass a JSON object or JSON list depending on the tool definition
  - return only the desired output
- Enumerate required and optional fields exactly as expected by the model.
- Explain field behavior clearly.
- Exclude internal/auto fields that should not come from the LLM (for example `created_at`).

6. Add one valid `<example_output>` that conforms to the model.

7. Keep contracts aligned end-to-end.

- If you change prompt output fields, update models, coercion/parsing, runtime logic, and tests in the same change.

8. Verify cheapest first.

- Run the existing unit tests for the prompt, its models, and its parsing first. They need no server and no LLM call.
- Run a live LLM check only when the change affects model behavior that tests cannot show. Start the app or dev server as a background process, wait for readiness with one bounded check (a health endpoint with a timeout), and run all probe cases from one script in one call.
- Do not poll logs or endpoints with `sleep`, `Start-Sleep`, or `until`/`while` loops. Run any check that can take over a minute in the background and wait for that task.

## Required Prompt Rules

- Keep instructions explicit and operational.
- Keep output contract field-by-field and typed.
- Keep required prompt blocks: `<role>`, `<task>`, `<input>`, `<output>`.
- Add `<tools>` for tool-capable prompts, and use it for tool usage policy.
- Avoid asking for wrappers/status/error fields unless the model requires them.
- Avoid asking for timestamps from the LLM.
- Avoid meta phrasing requirements that conflict with downstream synthesis.

## Prompt Skeleton

```md
<role>
...
</role>

<task>
...
</task>

<input>
Input is a JSON object with:
- `field_name` (type): purpose
</input>

<tools>
Available tools:
- `tool_name`: when to use, when not to use.
</tools>

<output>
You must call tool `tool_name` and pass a JSON object (not a JSON string).
Return only that tool call.

The tool argument must match `ModelName`:

- `field_name` (...)
  </output>

<example_output>
{
"field_name": "..."
}
</example_output>
```
