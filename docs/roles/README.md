# Roles

Every agent on this project works in one of four roles. The dispatching
prompt names the role and points here; read your own file before anything
else, then `AGENTS.md`.

| Role        | File                             | Output                                 |
| ----------- | -------------------------------- | -------------------------------------- |
| Operator    | [operator.md](operator.md)       | Dispatches, decides, talks to the user |
| Planner     | [planner.md](planner.md)         | A plan. Never code.                    |
| Implementer | [implementer.md](implementer.md) | Working code on its own branch         |
| Reviewer    | [reviewer.md](reviewer.md)       | Applied fixes plus a report            |

The user is the only one who confirms a feature works. Nothing merges before
that confirmation.
