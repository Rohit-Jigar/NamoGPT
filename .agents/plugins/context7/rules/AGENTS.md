# Context7 Documentation & Code Rules

These rules govern the retrieval and application of third-party library documentation and examples using Context7.

## Core Directives

1. **Mandatory Documentation Retrieval**:
   - Always query Context7 when working with external packages, frameworks, and SDKs (e.g., React, Next.js, FastAPI, LiteLLM, Supabase, Tailwind CSS, LangChain, Prisma).
   - Never rely solely on training knowledge or assume API signatures for evolving modern packages.

2. **Version Pinning & Verification**:
   - Inspect package manifests (`package.json`, `requirements.txt`, `pyproject.toml`) to determine the exact version installed or targeted in the project.
   - Always pass the resolved version to Context7 queries to retrieve version-pinned docs and avoid deprecated patterns or premature major version features.

3. **Workflow Sequence**:
   - **Step 1 - Resolve Library ID**: Query Context7 to match the package name to its authoritative library identifier.
   - **Step 2 - Fetch Pinned Docs**: Retrieve documentation, API reference, or code snippets for the specific topics required.
   - **Step 3 - Synthesize Code**: Implement solutions adhering strictly to official idiomatic patterns, TypeScript typings, and security recommendations from the fetched docs.

4. **Error & Migration Handling**:
   - When encountering deprecation warnings, compile errors, or breaking changes after library upgrades, query Context7 migration guides and changelogs before refactoring.
