# When to Mock

Adapted from `tdd/mocking.md`, https://github.com/mattpocock/skills.
MIT License, Copyright (c) 2026 Matt Pocock.
Choose real dependencies, test infrastructure or doubles from the approved seam, existing repository pattern and specification.
The following boundary examples are options, not a requirement to mock every external dependency or add a new abstraction.

When a double is justified, prefer **system boundaries**:

- External APIs (payment, email, etc.)
- Databases (sometimes - prefer test DB)
- Time/randomness
- File system (sometimes)

Avoid mocking internal collaborators merely to assert implementation structure.
A repository-approved boundary can be owned by the application; ownership alone does not determine whether a double is appropriate.

## Designing for Mockability

Reuse established interfaces at system boundaries.
When an interface change is justified by current requirements, these examples illustrate testability; do not introduce DI or an SDK wrapper solely for speculative mockability:

**1. Use dependency injection**

Pass external dependencies in rather than creating them internally:

```typescript
// Easy to mock
function processPayment(order, paymentClient) {
  return paymentClient.charge(order.total);
}

// Hard to mock
function processPayment(order) {
  const client = new StripeClient(process.env.STRIPE_KEY);
  return client.charge(order.total);
}
```

**2. Prefer SDK-style interfaces over generic fetchers**

Create specific functions for each external operation instead of one generic function with conditional logic:

```typescript
// GOOD: Each function is independently mockable
const api = {
  getUser: (id) => fetch(`/users/${id}`),
  getOrders: (userId) => fetch(`/users/${userId}/orders`),
  createOrder: (data) => fetch('/orders', { method: 'POST', body: data }),
};

// BAD: Mocking requires conditional logic inside the mock
const api = {
  fetch: (endpoint, options) => fetch(endpoint, options),
};
```

The SDK approach means:
- Each mock returns one specific shape
- No conditional logic in test setup
- Easier to see which endpoints a test exercises
- Type safety per endpoint
