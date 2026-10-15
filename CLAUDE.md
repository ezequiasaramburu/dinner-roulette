# Agent Development Rules & Workflow

## Automated Feature Pipeline

When the user requests a new feature, bug fix, or code enhancement, you must act as an autonomous agent and execute the development pipeline sequentially and automatically without stopping for step-by-step confirmation.

Stream the output of each skill directly into the next one using this strict sequence:

1. **`/spec`**: Generate the complete technical specification and requirements document for the feature.
2. **`/plan`**: Consume the output from `/spec` and break it down into atomic, actionable tasks with clear acceptance criteria.
3. **`/build`**: Consume the plan from `/plan` and implement the code incrementally in the workspace.
4. **`/test`** (or **`/review`**): Run tests on the generated code and validate it against the acceptance criteria.

## Execution Guidelines

- **Autonomy**: Do not ask the user "Should I proceed to the next step?". Pass the context automatically and move forward.
- **Error Handling**: Only interrupt the sequential execution if a critical error occurs that requires human architectural decisions.
- **Context Preservation**: Ensure the final output of the previous tool is explicitly referenced in the input payload of the next tool.
