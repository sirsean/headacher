# Security & Regression Test Suite

This test suite implements comprehensive security and regression testing for the Headacher application, focusing on user data isolation and basic functionality verification.

## Test Structure

### 1. Unit Tests - DB Helpers (`tests/unit/db-helpers.test.ts`)

**Purpose**: Ensure user filter functions work correctly at the SQL generation level.

**Key Tests**:
- `buildSelectWithUserScope`: Verifies user_id filters are always added to SELECT queries
- `buildInsertWithUserScope`: Ensures user_id is included in all INSERT operations
- `buildUpdateWithUserScope`: Confirms updates can only modify user's own records
- `buildDeleteWithUserScope`: Validates deletions are user-scoped
- `buildSelectByIdWithUserScope`: Tests individual record access is user-scoped
- Cross-user security validation

**Coverage**: 19 tests validating SQL generation patterns

### 2. Integration Tests - Cross-User Access (`tests/integration/cross-user-access.test.ts`)

**Purpose**: Verify that users cannot access another user's data through any API endpoint.

**Key Test Scenarios**:

#### Headache Cross-User Access Attempts
- GET requests for another user's headache return null (simulating 404)
- UPDATE requests for another user's headache return 0 changes
- DELETE requests for another user's headache return 0 changes

#### Event Cross-User Access Attempts  
- GET requests for another user's event return null (simulating 404)
- UPDATE requests for another user's event return 0 changes
- DELETE requests for another user's event return 0 changes

#### Data Isolation Verification
- LIST operations only return current user's data
- Dashboard queries only include current user's records
- Date range filters maintain user isolation

#### Authentication Token Validation
- Token extraction works correctly for valid tokens
- Invalid tokens are properly rejected

**Coverage**: 22 tests ensuring complete user data isolation

### 3. Smoke Tests - Basic Flows (`tests/smoke/basic-flows.test.ts`)

**Purpose**: Verify basic create/list functionality still works after security implementations.

**Key Test Areas**:

#### Headache CRUD Operations
- Create new headache records
- List user's headaches with proper ordering
- Retrieve individual headaches by ID
- Update existing headache records
- Delete headache records

#### Event CRUD Operations
- Create new event records
- List user's events with proper ordering
- Retrieve individual events by ID
- Update existing event records
- Delete event records

#### Dashboard Data Flow
- Retrieve dashboard data with date filtering
- Handle empty data sets gracefully

#### User Registration
- Register new users successfully
- Handle duplicate registrations properly

#### Pagination and Filtering
- Implement correct pagination logic
- Apply date range filtering
- Maintain sort ordering

#### Data Integrity
- Preserve referential integrity with user_id
- Handle concurrent operations correctly

**Coverage**: 18 tests validating core application functionality

## Security Guarantees

### User Data Isolation
1. **Database Level**: All queries include user_id conditions
2. **Authentication Level**: JWT tokens properly scope user access
3. **API Level**: No endpoint allows cross-user data access
4. **Authorization Level**: Operations fail for unauthorized records

### SQL Injection Prevention
- All queries use parameterized statements
- User input is properly escaped and validated
- No dynamic SQL construction from user input

### Authentication Security
- JWT tokens properly validated on all protected endpoints
- Token extraction handles malformed tokens gracefully
- Expired or invalid tokens are rejected

## Test Configuration

### Vitest Setup
```json
{
  "test": {
    "globals": true,
    "environment": "node",
    "coverage": {
      "reporter": ["text", "json", "html"],
      "exclude": [
        "node_modules/",
        "dist/",
        "tests/",
        "**/*.d.ts",
        "**/*.config.*"
      ]
    }
  }
}
```

### Available Scripts
- `npm run test`: Run tests in watch mode
- `npm run test:run`: Run all tests once
- `npm run test:coverage`: Run tests with coverage report
- `npm run test:ui`: Run tests with Vitest UI

## Mock Database Implementation

The test suite uses sophisticated mock D1 database implementations that:

1. **Simulate Real Database Behavior**: Proper SQL pattern matching and parameter binding
2. **Enforce User Scoping**: All queries respect user_id constraints
3. **Support Complex Queries**: Handle JOIN operations, date filtering, and sorting
4. **Maintain Data Integrity**: Proper foreign key relationships and constraints

## Test Data Management

### Test Users
- `user1Address`: `0x1111111111111111111111111111111111111111`
- `user2Address`: `0x2222222222222222222222222222222222222222`
- `testUser`: `0x1234567890123456789012345678901234567890`

### Data Isolation Strategy
Each test case creates isolated data sets to prevent test interference and ensure reliable results.

## Running the Tests

### Prerequisites
```bash
npm install
```

### Execute Test Suite
```bash
# Run all tests
npm run test:run

# Run specific test file
npx vitest tests/unit/db-helpers.test.ts
npx vitest tests/integration/cross-user-access.test.ts
npx vitest tests/smoke/basic-flows.test.ts

# Run with coverage
npm run test:coverage
```

### Expected Results
- **Unit Tests**: 19/19 passing
- **Integration Tests**: 22/22 passing  
- **Smoke Tests**: 18/18 passing
- **Total Coverage**: High coverage on security-critical paths

## Security Validation Checklist

- ✅ User data completely isolated by user_id
- ✅ Cross-user access attempts return 404/no changes
- ✅ All database helpers include user scoping
- ✅ Authentication tokens properly validated
- ✅ SQL injection prevention through parameterized queries
- ✅ Basic CRUD operations work correctly
- ✅ Dashboard data filtering maintains security
- ✅ Pagination and sorting preserve user isolation
- ✅ Concurrent operations handle user scoping properly

## Regression Prevention

This test suite prevents regressions in:

1. **Security Controls**: User isolation cannot be accidentally removed
2. **Authentication**: Token handling remains secure
3. **Core Functionality**: Basic operations continue working
4. **Data Integrity**: User associations remain intact
5. **API Behavior**: Endpoints maintain expected response patterns

## Future Enhancements

Potential improvements to the test suite:

1. **End-to-End Tests**: Full browser-based security testing
2. **Performance Tests**: Load testing with user isolation
3. **Fuzz Testing**: Random input validation for security holes
4. **Integration with Real Database**: Testing against actual D1 instances
5. **Security Audit Integration**: Automated security scanning

## Contributing

When adding new features that handle user data:

1. Add corresponding unit tests for DB helpers
2. Create integration tests for cross-user access attempts
3. Include smoke tests for basic functionality
4. Ensure all tests pass before merging
5. Update this documentation with new test scenarios
