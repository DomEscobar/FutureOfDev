---
name: Deletion Policy
trigger:
  intent: [delete]
  tags: [delete, remove, purge, cleanup]
inject: [planning, execution]
---

# Deletion Policy

## Default Behavior
Do NOT delete existing code unless the task explicitly says "delete", "remove", or "purge".

## When Deletion Is Requested
If the task explicitly requests deletion:

### Step 1: Identify All Targets
- List every file, route, store, component, and import related to the feature being deleted
- Check for cross-references (other files importing from the deleted module)

### Step 2: Delete in Dependency Order
1. Remove route registrations first
2. Remove navigation/menu references
3. Delete page/view components
4. Delete feature components
5. Delete stores/composables
6. Delete API modules
7. Delete backend handlers/services/models (if requested)

### Step 3: Clean Up Orphaned References
After deletion, search for imports or references to deleted files:
- Remove `import` statements that reference deleted modules
- Remove route entries pointing to deleted pages
- Remove navigation items linking to deleted views

### Step 4: Verify Build
The project must still build after deletion. A deletion task that breaks the build is a failure.

## Anti-Patterns
- Deleting more than what was requested
- Leaving broken imports after deletion
- Deleting backend code when only frontend deletion was requested
- "Preserving" code by commenting it out instead of deleting
