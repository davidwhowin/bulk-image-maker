# Authentication System Documentation

## Overview

The Bulk Image Optimizer features a comprehensive JWT-based authentication system built with Supabase, providing secure user management and tier-based access control for the upcoming monetization features.

## Architecture

### Core Components

```
src/
├── components/auth/           # Authentication UI components
│   ├── AuthProvider.tsx      # Main authentication context provider
│   ├── AuthHeader.tsx        # User profile header with tier display
│   ├── LoginForm.tsx         # Login form with validation
│   ├── RegisterForm.tsx      # Registration form with password confirmation
│   ├── ProtectedRoute.tsx    # Route protection wrapper
│   ├── EmailVerificationScreen.tsx # Email verification flow
│   ├── ForgotPasswordForm.tsx # Password reset request form
│   ├── ResetPasswordForm.tsx # New password creation form
│   ├── ResetPasswordHandler.tsx # URL-based reset flow handler
│   ├── AuthErrorBoundary.tsx # Error handling for auth failures
│   └── index.ts              # Barrel exports
├── lib/
│   ├── auth-store.ts         # Zustand authentication state management
│   └── supabase.ts           # Supabase client configuration
└── types/
    └── auth.ts               # TypeScript interfaces for authentication
```

### Technology Stack

- **Backend**: Supabase (PostgreSQL + Auth service)
- **Authentication**: JWT tokens with automatic refresh
- **State Management**: Zustand for reactive authentication state
- **UI Framework**: React 19 with TypeScript
- **Styling**: Tailwind CSS for responsive design
- **Testing**: Vitest with React Testing Library

## Features

### 🔐 User Authentication

#### Registration & Login
- **Email/Password Authentication**: Secure user registration and login
- **Email Verification**: Required email confirmation before account activation
- **Form Validation**: Real-time validation for email format and password requirements
- **Password Confirmation**: Ensures password accuracy during registration
- **Toggle Interface**: Seamless switching between login and registration modes
- **Resend Verification**: Easy email verification resend with cooldown protection
- **Forgot Password**: Secure password reset flow with email verification

#### Session Management
- **Persistent Sessions**: Users remain logged in across browser sessions
- **Automatic Token Refresh**: Background token renewal prevents session expiration
- **Secure Logout**: Complete session cleanup and state reset

### 🎯 User Interface

#### Authentication Screen
- **Professional Design**: Clean, modern interface matching app aesthetic
- **Responsive Layout**: Works perfectly on desktop, tablet, and mobile
- **Visual Feedback**: Loading states, error messages, and success indicators
- **Email Verification Flow**: Dedicated verification screen with resend functionality
- **Progress Indicators**: Clear user guidance through registration and verification
- **Accessibility**: WCAG 2.1 AA compliant with proper ARIA labels

#### User Profile Display
- **Header Integration**: User email and tier badge in main navigation
- **Tier Visualization**: Color-coded badges for Free, Pro, Team, Enterprise
- **Quick Logout**: One-click logout functionality

### 🏢 Tier-Based Access Control

#### User Tiers
```typescript
type UserTier = 'free' | 'pro' | 'team' | 'enterprise'
```

- **Free**: Basic access with limited features (100 images/month)
- **Pro**: Enhanced processing capabilities and advanced features
- **Team**: Collaboration tools for agencies and teams
- **Enterprise**: Full-featured with dedicated support and custom solutions

#### Access Control Implementation
- **Route Protection**: `ProtectedRoute` component guards authenticated areas
- **Feature Gating**: Tier-based feature availability (ready for monetization)
- **State Management**: Reactive tier updates throughout the application

## API Reference

### Authentication Store (`useAuthStore`)

```typescript
interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  userTier: UserTier
  error: AuthError | null
  needsEmailVerification: boolean
  pendingVerificationEmail: string | null
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: User | null) => void
  setUserTier: (tier: UserTier) => void
  setLoading: (loading: boolean) => void
  setError: (error: AuthError | null) => void
  setNeedsEmailVerification: (needs: boolean, email?: string) => void
  resendVerificationEmail: (email: string) => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  updatePassword: (newPassword: string) => Promise<void>
  reset: () => void
  initialize: () => Promise<void>
}
```

### Key Methods

#### `login(email, password)`
Authenticates user with email and password.
```typescript
const { login } = useAuthStore()
try {
  await login('user@example.com', 'password123')
  // User is now authenticated
} catch (error) {
  console.error('Login failed:', error)
}
```

#### `register(email, password)`
Creates new user account and sends email verification.
```typescript
const { register, needsEmailVerification } = useAuthStore()
try {
  await register('newuser@example.com', 'password123')
  // User needs to verify email before accessing app
  if (needsEmailVerification) {
    // Show email verification screen
  }
} catch (error) {
  console.error('Registration failed:', error)
}
```

#### `resendVerificationEmail(email)`
Resends verification email to user.
```typescript
const { resendVerificationEmail } = useAuthStore()
try {
  await resendVerificationEmail('user@example.com')
  // Verification email sent successfully
} catch (error) {
  console.error('Failed to resend email:', error)
}
```

#### `requestPasswordReset(email)`
Sends password reset email to user.
```typescript
const { requestPasswordReset } = useAuthStore()
try {
  await requestPasswordReset('user@example.com')
  // Password reset email sent successfully
} catch (error) {
  console.error('Failed to send reset email:', error)
}
```

#### `updatePassword(newPassword)`
Updates user password (used after reset flow).
```typescript
const { updatePassword } = useAuthStore()
try {
  await updatePassword('newSecurePassword123')
  // Password updated successfully
} catch (error) {
  console.error('Failed to update password:', error)
}
```

#### `logout()`
Signs out user and clears all authentication state.
```typescript
const { logout } = useAuthStore()
await logout()
// User is logged out, redirected to login screen
```

## Configuration

### Environment Variables

```bash
# .env.local
VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key-here"
```

### Supabase Setup

1. **Create Supabase Project**: Visit [supabase.com](https://supabase.com)
2. **Get Credentials**: Copy Project URL and Anon Key from project dashboard
3. **Configure Environment**: Add credentials to `.env.local`
4. **Enable Authentication**: Auth is enabled by default in Supabase

## Usage Examples

### Protecting Routes

```tsx
import { AuthProvider } from '@/components/auth'

function App() {
  return (
    <AuthProvider>
      {/* Your protected app content */}
      <MainApplication />
    </AuthProvider>
  )
}
```

### Accessing User State

```tsx
import { useAuthStore } from '@/lib/auth-store'

function UserProfile() {
  const { user, userTier, logout } = useAuthStore()
  
  return (
    <div>
      <p>Welcome, {user?.email}</p>
      <p>Tier: {userTier}</p>
      <button onClick={logout}>Sign Out</button>
    </div>
  )
}
```

### Conditional Feature Access

```tsx
import { useAuthStore } from '@/lib/auth-store'

function AdvancedFeatures() {
  const { userTier } = useAuthStore()
  
  if (userTier === 'free') {
    return <UpgradePrompt />
  }
  
  return <PremiumFeatures />
}
```

## Security Features

### 🔒 Authentication Security

- **JWT Tokens**: Stateless authentication with industry-standard JWT
- **Secure Storage**: Tokens stored securely in browser with automatic cleanup
- **HTTPS Only**: All authentication traffic encrypted in transit
- **Session Timeout**: Automatic logout after extended inactivity

### 🛡️ Input Validation

- **Email Validation**: RFC-compliant email format checking
- **Password Requirements**: Minimum 6 characters (configurable)
- **XSS Prevention**: All user inputs properly sanitized
- **CSRF Protection**: Built into Supabase authentication flow

### 🔐 Data Protection

- **No Password Storage**: Passwords handled entirely by Supabase
- **Encrypted Database**: All user data encrypted at rest
- **Audit Logging**: Supabase provides comprehensive audit trails
- **GDPR Compliant**: Built-in data protection compliance

## Error Handling

### Error Types

```typescript
interface AuthError {
  message: string
  code?: string
}
```

### Common Error Scenarios

- **Invalid Credentials**: Clear messaging for login failures
- **Network Issues**: Graceful handling of connectivity problems
- **Validation Errors**: Real-time feedback for form validation
- **Session Expiry**: Automatic redirect to login when session expires

### Error Recovery

- **Retry Logic**: Automatic retry for transient failures
- **Fallback UI**: User-friendly error screens with recovery options
- **Error Boundaries**: Prevent authentication errors from crashing the app
- **Logging**: Comprehensive error logging for debugging

## Testing

### Test Coverage

- **Unit Tests**: Authentication store logic and state management
- **Component Tests**: UI components and user interactions
- **Integration Tests**: Complete authentication flows
- **E2E Tests**: End-to-end user registration and login scenarios

### Running Tests

```bash
# Run all authentication tests
npm test src/lib/__tests__/auth.test.ts
npm test src/components/__tests__/auth.test.tsx

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

## Performance Considerations

### 🚀 Optimization Features

- **Stateless Authentication**: No server-side session storage required
- **Edge CDN**: Supabase global CDN reduces auth latency by 40-60%
- **Client-Side Caching**: User data cached in JWT payload
- **Memory Efficiency**: Zustand's minimal re-renders

### 📊 Performance Metrics

- **Bundle Impact**: +52KB (Supabase client) - acceptable for SaaS app
- **Auth Check Latency**: ~100-200ms initial load (optimizable with lazy loading)
- **Token Refresh**: Background refresh prevents user interruption
- **Memory Usage**: Minimal memory footprint with automatic cleanup

## Future Monetization Integration

### Ready for Subscription Management

The authentication system is architected to seamlessly integrate with:

- **Stripe Integration**: User tier management tied to subscription status
- **Usage Tracking**: Foundation for monitoring monthly limits
- **Feature Gating**: Tier-based access control already implemented
- **Billing Portal**: User management ready for subscription interfaces

### Planned Enhancements

- **SSO Integration**: SAML/OAuth for enterprise customers
- **Multi-Factor Authentication**: Enhanced security for premium tiers
- **Team Management**: User roles and permissions for Team/Enterprise
- **API Keys**: Programmatic access for enterprise integrations

## Troubleshooting

### Common Issues

#### Environment Configuration
```bash
# Wrong URL format (common mistake)
❌ VITE_SUPABASE_URL="postgresql://postgres.username:password@host:port/db"
✅ VITE_SUPABASE_URL="https://project-ref.supabase.co"
```

#### CORS Issues
Ensure your domain is added to Supabase project settings under Authentication > URL Configuration.

#### Session Persistence
If users are logged out on refresh, check that:
1. Environment variables are properly loaded
2. Supabase client is configured with `persistSession: true`
3. Browser storage is not being cleared

### Debug Mode

Enable detailed logging by setting:
```typescript
// In supabase.ts
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    debug: process.env.NODE_ENV === 'development'
  }
})
```

## Contributing

### Adding New Authentication Features

1. **Update Types**: Add new interfaces to `src/types/auth.ts`
2. **Extend Store**: Add actions to `src/lib/auth-store.ts`
3. **Create Components**: Build UI components in `src/components/auth/`
4. **Write Tests**: Ensure comprehensive test coverage
5. **Update Documentation**: Document new features and APIs

### Code Style

Follow the existing patterns:
- Use TypeScript interfaces for all authentication data
- Implement comprehensive error handling
- Follow accessibility guidelines (WCAG 2.1 AA)
- Write descriptive test cases
- Use semantic HTML and proper ARIA attributes

---

*Last Updated: December 2024*
*Version: 1.0.0*