@AGENTS.md

# Agent Workflow

Code-change requests are implemented directly by the main session — no orchestrator/harness dispatch. Use subagents only ad hoc (e.g. `Explore` for research, or a focused agent for a well-scoped independent chunk of work), the same way you would on any other project.

## Rules & hooks

General coding rules still live in `.claude/rules/` (coding-style, testing, typescript, security-triggers, lsp-usage, english-only, git-policy, web-patterns, web-security). The harness-specific ones (worktree-scope, agent-output-format) no longer apply since there's no orchestrator/developer/merger pipeline, but are left in place in case the harness is reinstated later.
