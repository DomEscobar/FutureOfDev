# Category D1: Refactoring (Spaghetti Service)

Project structure:

```
refactor/spaghetti-service/
└── orders.py
```

orders.py (hard to read, high cyclomatic complexity):

```python
def process_order(order, user):
    total = 0
    for item in order['items']:
        if item['type'] == 'book':
            price = item['price'] * 0.9  # 10% discount
        elif item['type'] == 'electronics':
            if user['vip']:
                price = item['price'] * 0.8
            else:
                price = item['price']
        else:
            price = item['price']
        total += price

    if user['vip'] and total > 100:
        total = total * 0.95

    if user['country'] == 'DE':
        total = total * 1.19  # VAT
    elif user['country'] == 'FR':
        total = total * 1.20
    else:
        total = total * 1.10

    tax = total * 0.10
    grand_total = total + tax

    if grand_total > 500:
        shipping = 0
    else:
        shipping = 15

    return {
        'subtotal': total,
        'tax': tax,
        'shipping': shipping,
        'grand_total': grand_total
    }
```

Tests (must remain green):

```python
import pytest
from orders import process_order

def test_basic_order():
    order = {'items': [{'type': 'book', 'price': 20}]}
    user = {'vip': False, 'country': 'US'}
    result = process_order(order, user)
    assert result['subtotal'] == 18.0
    assert result['tax'] == pytest.approx(1.8)
    assert result['shipping'] == 15
    assert result['grand_total'] == pytest.approx(34.8)

def test_vip_electronics():
    order = {'items': [{'type': 'electronics', 'price': 200}]}
    user = {'vip': True, 'country': 'US'}
    result = process_order(order, user)
    assert result['subtotal'] == 160.0
    assert result['shipping'] == 0  # >500 after VIP discount? Actually 160*1.1 = 176 <500, shipping=15
```

Task:
Refactor `process_order` to:
- Reduce cyclomatic complexity by extracting functions (e.g., `apply_item_discount`, `apply_user_discount`, `apply_tax`, `compute_shipping`)
- Keep tests passing
- Improve readability without changing external behavior

Evaluation:
- Tests must pass
- Cyclomatic complexity should drop from ~8 to ~4-5
- Duplication reduced
- Code remains functionally equivalent on a set of 10 validation cases
