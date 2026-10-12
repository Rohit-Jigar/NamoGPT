---
name: context7-docs
description: Step-by-step workflow for querying library IDs and fetching version-pinned documentation, API references, and code examples using Context7 MCP. Use when working with external packages, verifying APIs, or resolving deprecations.
---

# Context7 Documentation Workflow

Follow this procedure to look up up-to-date documentation and version-specific code examples for third-party libraries.

## Workflow Steps

### Step 1: Identify Library and Version
1. Check the project configuration files (`package.json`, `pnpm-lock.yaml`, `requirements.txt`, `Pipfile`, `pyproject.toml`) to locate the exact package name and version range.
2. Note the targeted version (e.g., `litellm@1.40.0`, `@supabase/supabase-js@2.39.0`, `tailwindcss@4.0.0`).

### Step 2: Query Context7 for Library Resolution
1. Use Context7 tools to query the library index:
   - Provide the library name and runtime ecosystem (Node/NPM, Python/PyPI, Go, etc.).
   - Obtain the canonical library ID or slug recognized by Context7.

### Step 3: Fetch Version-Pinned Documentation
1. Request documentation for the specific library ID pinned to the verified version.
2. Filter the query by relevant topic, module, or method name (e.g., streaming responses, auth callback handling, route handlers).
3. Extract official code snippets, parameter definitions, and return types.

### Step 4: Validate and Implement
1. Compare fetched signatures with existing project code.
2. Replace outdated or hallucinated implementations with verified patterns.
3. Validate through type checking or local tests.
