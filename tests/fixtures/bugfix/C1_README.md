# Category C1: Bug Fix (Calculator)

Project structure:

```
bugfix/calculator-broken/
├── calculator.py
└── test_calculator.py
```

calculator.py (intentionally buggy):

```python
def add(a, b):
    return a - b  # Bug

def multiply(a, b):
    result = 0
    for _ in range(b):
        result += a
    return result

def divide(a, b):
    if b == 0:
        raise ValueError("Cannot divide by zero")
    return a * b  # Bug

def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)
```

test_calculator.py:

```python
import pytest
from calculator import add, multiply, divide, factorial

def test_add():
    assert add(2, 3) == 5
    assert add(-1, 1) == 0

def test_multiply():
    assert multiply(3, 4) == 12
    assert multiply(0, 5) == 0

def test_divide():
    assert divide(10, 2) == 5
    assert divide(9, 3) == 3
    with pytest.raises(ValueError):
        divide(5, 0)

def test_factorial():
    assert factorial(0) == 1
    assert factorial(1) == 1
    assert factorial(5) == 120
```

Task: Fix calculator.py so that all tests pass.

Evaluation:
- All tests must pass (pytest)
- Number of iterations (guess attempts) is counted
- Time to fix is measured
- The agent must not modify test_calculator.py
