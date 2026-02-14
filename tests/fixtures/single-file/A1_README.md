# Category A1: Single-file function generation (Python)

Write a Python function `reverse_linked_list(head)` that reverses a singly linked list.

The linked list node is defined as:

```python
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next
```

Function signature:

```python
def reverse_linked_list(head: Optional[ListNode]) -> Optional[ListNode]:
    pass
```

Evaluation:
- The generated code will be tested on 10 random lists (length 0-100)
- Must handle edge cases: empty list, single node, long lists
- Must not use extra O(n) memory beyond O(1) for pointers
- Must run in O(n) time

Expected success rate: >= 9/10 test cases.
