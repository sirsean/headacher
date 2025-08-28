# API Usage with Authentication

## Overview
All API functions in `src/api.ts` now support authenticated requests and automatic 401 handling.

## Usage in React Components

### 1. Import the required hooks and API functions
```typescript
import { useAuth } from './context/AuthContext'
import { listHeadaches, createHeadache } from './api'
```

### 2. Get the authenticated fetch function
```typescript
const { fetchWithAuth } = useAuth()
```

### 3. Pass fetchWithAuth to API functions
```typescript
// List headaches with authentication
const headaches = await listHeadaches({}, fetchWithAuth)

// Create a headache with authentication
const newHeadache = await createHeadache({ severity: 5, aura: 0 }, fetchWithAuth)
```

## Available API Functions
All functions accept an optional `fetchWithAuth` parameter as the last argument:

### Headaches
- `listHeadaches(params?, fetchWithAuth?)`
- `createHeadache(headache, fetchWithAuth?)`
- `getHeadache(id, fetchWithAuth?)`
- `updateHeadache(id, patch, fetchWithAuth?)`
- `deleteHeadache(id, fetchWithAuth?)`

### Events
- `listEvents(params?, fetchWithAuth?)`
- `createEvent(event, fetchWithAuth?)`
- `getEvent(id, fetchWithAuth?)`
- `updateEvent(id, patch, fetchWithAuth?)`
- `deleteEvent(id, fetchWithAuth?)`

### Dashboard
- `getDashboardData(days?, fetchWithAuth?)`

## Automatic 401 Handling
When any API call returns a 401 Unauthorized response:
1. The auth token is automatically cleared from localStorage
2. The user address is cleared from the auth context
3. The user is automatically redirected to the home page ('/') only if they're not already there (prevents infinite redirect loops)

## Backwards Compatibility
All API functions still work without the `fetchWithAuth` parameter for non-authenticated requests, but authenticated endpoints will fail without proper authorization headers.
