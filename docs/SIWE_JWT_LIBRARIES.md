# SIWE & JWT Libraries - Version Documentation

This document outlines the library choices and locked versions for Sign-In with Ethereum (SIWE) authentication and JWT handling in this Cloudflare Workers project.

## Selected Libraries & Versions

### Core Authentication Libraries

#### `siwe` v3.0.0
- **Purpose**: Message formatting and validation for Sign-In with Ethereum
- **Cloudflare Workers Compatibility**: ✅ Excellent - Works with Web APIs
- **Key Features**:
  - EIP-4361 compliant message generation
  - Message parsing and validation
  - Nonce management
  - Domain and URI validation

#### `jose` v6.0.12
- **Purpose**: JWT creation, verification, and management
- **Cloudflare Workers Compatibility**: ✅ Excellent - Built for Web Crypto API
- **Key Features**:
  - Native Web Crypto API support (no Node.js dependencies)
  - JWS/JWE support
  - Key import/export
  - Optimized for edge runtime environments

### Frontend Wallet Integration

#### `viem` v2.33.3
- **Purpose**: TypeScript Interface for Ethereum (EIP-1193 provider utilities)
- **React Compatibility**: ✅ Excellent
- **Key Features**:
  - Type-safe Ethereum interactions
  - Built-in support for popular wallets
  - Lightweight and tree-shakeable
  - First-class TypeScript support

#### `@wagmi/core` v2.19.0
- **Purpose**: React hooks and utilities for Ethereum wallet interactions
- **Dependencies**: Requires `viem` v2.x (satisfied by our selection)
- **Key Features**:
  - React hooks for wallet connection
  - Account management
  - Chain switching
  - Transaction handling

### Required Peer Dependencies

#### `ethers` v6.15.0
- **Purpose**: Required peer dependency for `siwe`
- **Compatibility**: Satisfies `siwe` requirement for `^5.6.8 || ^6.0.8`
- **Note**: Only used by `siwe` internally for cryptographic operations

#### `@tanstack/query-core` v5.83.1
- **Purpose**: Required peer dependency for `@wagmi/core`
- **Compatibility**: Satisfies `@wagmi/core` requirement for `>=5.0.0`
- **Use**: Provides caching and synchronization for wallet state

## Version Locking Rationale

All versions are locked (no `^` or `~` prefixes) to ensure:
1. **Deterministic builds** across development and production environments
2. **Compatibility stability** between interdependent packages
3. **Security consistency** with known-good versions
4. **Cloudflare Workers compatibility** with tested library versions

## Cloudflare Workers Considerations

### Why `jose` over other JWT libraries:
- **jsonwebtoken**: Requires Node.js crypto module (not available in Workers)
- **node-jose**: Node.js specific implementation
- **jose**: Built specifically for Web Crypto API used by Cloudflare Workers

### Why `viem` over `ethers` for frontend:
- **Bundle size**: Smaller and more tree-shakeable
- **TypeScript**: Better type safety and developer experience
- **Modern APIs**: Uses modern Web APIs where possible
- **Wagmi integration**: First-class support in the Wagmi ecosystem

## Development Container

The `.devcontainer/devcontainer.json` configuration ensures:
- **Node.js 20**: Latest LTS version with Web API support
- **Locked dependencies**: `npm ci` uses exact versions from `package-lock.json`
- **TypeScript support**: Pre-configured extensions and settings
- **Port forwarding**: Development and Worker dev servers
- **Cloudflare types**: Automatic generation of Worker types

## Upgrade Path

When upgrading these libraries:
1. Check Cloudflare Workers compatibility
2. Verify peer dependency requirements
3. Test JWT operations with Web Crypto API
4. Validate SIWE message handling
5. Update this documentation

## Usage Examples

### Backend (Cloudflare Worker)
```typescript
import { SiweMessage } from 'siwe';
import { SignJWT, jwtVerify } from 'jose';

// SIWE message validation
const siweMessage = new SiweMessage(message);
await siweMessage.validate(signature);

// JWT creation with Web Crypto
const secret = new TextEncoder().encode(JWT_SECRET);
const jwt = await new SignJWT({ address: siweMessage.address })
  .setProtectedHeader({ alg: 'HS256' })
  .setExpirationTime('24h')
  .sign(secret);
```

### Frontend (React)
```typescript
import { useAccount, useSignMessage } from '@wagmi/core';
import { SiweMessage } from 'siwe';

// Wallet integration
const { address } = useAccount();
const { signMessage } = useSignMessage();

// SIWE message creation and signing
const message = new SiweMessage({
  domain: window.location.host,
  address,
  statement: 'Sign in with Ethereum',
  uri: window.location.origin,
  version: '1',
  chainId: 1,
});

const signature = await signMessage({ message: message.prepareMessage() });
```
