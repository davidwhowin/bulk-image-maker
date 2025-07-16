# Getting Started with Authentication

This guide walks you through setting up and using the authentication system in the Bulk Image Optimizer.

## 🎯 Quick Setup

### 1. Environment Configuration

Create a `.env.local` file in your project root:

```bash
# Supabase Configuration
VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key-here"
```

**Important**: Use the Project URL (https://...), not the database URL (postgresql://...)

### 2. Supabase Project Setup

1. **Create Account**: Visit [supabase.com](https://supabase.com) and sign up
2. **New Project**: Create a new project and wait for setup to complete
3. **Get Credentials**: 
   - Go to Settings → API
   - Copy the "Project URL" and "anon/public" key
   - Add them to your `.env.local` file

### 3. Start Development Server

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` to see the authentication screen.

## 🔐 User Experience Flow

### First Visit
Users see a professional login screen with:
- **Toggle buttons**: Switch between "Sign In" and "Sign Up"
- **Feature preview**: Shows key benefits of the platform
- **Clean design**: Professional, trustworthy appearance

### Registration Process
1. **Click "Sign Up"** tab or "Sign up for free" link
2. **Fill out form**:
   - Email address (validated in real-time)
   - Password (minimum 6 characters)
   - Confirm password (must match)
3. **Submit form**: Automatic validation and account creation
4. **Email verification**: Check email and click verification link
5. **Account activation**: Access granted after email confirmation

### Email Verification
- **Check Email**: Look for verification email (check spam folder)
- **Click Link**: Click the verification link in the email
- **Automatic Redirect**: Returned to app with full access
- **Resend Option**: Can resend verification email if needed (60s cooldown)

### Login Process
1. **Enter credentials**: Email and password
2. **Automatic session**: Users stay logged in across browser sessions
3. **Access granted**: Immediate access to the image optimizer

### Authenticated Experience
- **Header display**: Shows user email and tier badge
- **Tier indication**: Color-coded badges (Free, Pro, Team, Enterprise)
- **Easy logout**: One-click sign out from header

## 🏗️ Technical Implementation

### Core Components

```typescript
// Wrap your app with authentication
import { AuthProvider } from '@/components/auth'

function App() {
  return (
    <AuthProvider>
      <YourMainApplication />
    </AuthProvider>
  )
}
```

### Accessing Authentication State

```typescript
import { useAuthStore } from '@/lib/auth-store'

function YourComponent() {
  const { 
    user,           // User object or null
    isAuthenticated, // Boolean auth status
    isLoading,      // Loading state
    userTier,       // 'free' | 'pro' | 'team' | 'enterprise'
    login,          // Login function
    logout          // Logout function
  } = useAuthStore()

  if (isLoading) return <LoadingSpinner />
  if (!isAuthenticated) return <LoginPrompt />
  
  return (
    <div>
      <h1>Welcome, {user.email}!</h1>
      <p>Your tier: {userTier}</p>
    </div>
  )
}
```

### Protecting Routes

The `ProtectedRoute` component automatically handles authentication:

```typescript
// Routes are automatically protected when wrapped with AuthProvider
function ProtectedFeature() {
  return <div>This content requires authentication</div>
}
```

## 🎨 Customizing the UI

### Styling Authentication Components

The authentication components use Tailwind CSS classes. You can customize:

```typescript
// Example: Custom login form styling
import { LoginForm } from '@/components/auth'

function CustomAuthScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <LoginForm />
      </div>
    </div>
  )
}
```

### Adding Custom Fields

Extend the registration form:

```typescript
// Create custom registration form
import { useState } from 'react'
import { useAuthStore } from '@/lib/auth-store'

function ExtendedRegisterForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [company, setCompany] = useState('')
  const { register } = useAuthStore()

  const handleSubmit = async (e) => {
    e.preventDefault()
    await register(email, password)
    // Save additional data to user profile
  }

  return (
    <form onSubmit={handleSubmit}>
      <input 
        type="email" 
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input 
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      <input 
        type="text"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        placeholder="Company Name"
      />
      <button type="submit">Sign Up</button>
    </form>
  )
}
```

## 🔧 Advanced Configuration

### Custom Supabase Configuration

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      // Custom configuration
      flowType: 'pkce',
      storage: window.localStorage,
      storageKey: 'supabase.auth.token',
    }
  }
)
```

### Error Handling

```typescript
import { useAuthStore } from '@/lib/auth-store'

function AuthErrorHandler() {
  const { error, setError } = useAuthStore()

  useEffect(() => {
    if (error) {
      // Custom error handling
      console.error('Auth error:', error)
      
      // Show user-friendly message
      toast.error(error.message)
      
      // Clear error after showing
      setTimeout(() => setError(null), 5000)
    }
  }, [error, setError])

  return null
}
```

## 🧪 Testing Authentication

### Unit Testing

```typescript
import { renderHook, act } from '@testing-library/react'
import { useAuthStore } from '@/lib/auth-store'

test('should login user successfully', async () => {
  const { result } = renderHook(() => useAuthStore())
  
  await act(async () => {
    await result.current.login('test@example.com', 'password123')
  })
  
  expect(result.current.isAuthenticated).toBe(true)
  expect(result.current.user?.email).toBe('test@example.com')
})
```

### Integration Testing

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AuthProvider } from '@/components/auth'
import App from '@/App'

test('should allow user registration and login', async () => {
  render(
    <AuthProvider>
      <App />
    </AuthProvider>
  )
  
  // Click sign up
  fireEvent.click(screen.getByText(/sign up/i))
  
  // Fill form
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: 'test@example.com' }
  })
  fireEvent.change(screen.getByLabelText(/password/i), {
    target: { value: 'password123' }
  })
  
  // Submit
  fireEvent.click(screen.getByRole('button', { name: /create account/i }))
  
  // Verify authentication
  await waitFor(() => {
    expect(screen.getByText(/welcome/i)).toBeInTheDocument()
  })
})
```

## 🚨 Common Issues & Solutions

### Issue: "URL with embedded credentials" Error

**Problem**: Using database URL instead of project URL
```bash
❌ VITE_SUPABASE_URL="postgresql://postgres.user:pass@host:port/db"
```

**Solution**: Use the project URL
```bash
✅ VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
```

### Issue: Users Logged Out on Refresh

**Problem**: Session persistence not working

**Solution**: Check environment variables are loaded
```typescript
// Verify in browser console
console.log(import.meta.env.VITE_SUPABASE_URL)
```

### Issue: CORS Errors

**Problem**: Domain not configured in Supabase

**Solution**: Add your domain to Supabase settings:
1. Go to Authentication → URL Configuration
2. Add `http://localhost:3000` for development
3. Add your production domain for deployment

### Issue: Slow Authentication

**Problem**: Network latency or configuration issues

**Solution**: Optimize Supabase client
```typescript
export const supabase = createClient(url, key, {
  global: {
    headers: {
      'X-Client-Info': 'bulk-image-optimizer'
    }
  },
  db: {
    schema: 'public'
  }
})
```

## 📱 Mobile Considerations

### Responsive Design
The authentication screens are fully responsive:
- **Mobile**: Single column layout, larger touch targets
- **Tablet**: Optimized spacing and typography
- **Desktop**: Multi-column with feature preview

### Touch Optimization
- **Button Size**: Minimum 44px touch targets
- **Form Inputs**: Large, easy-to-tap inputs
- **Spacing**: Adequate spacing between interactive elements

### Performance
- **Lazy Loading**: Authentication components load only when needed
- **Bundle Splitting**: Auth code separated from main app bundle
- **Caching**: Aggressive caching of authentication assets

## 🔒 Security Best Practices

### Development
- **Environment Variables**: Never commit credentials to version control
- **HTTPS**: Use HTTPS in production for secure token transmission
- **Validation**: Always validate user input on both client and server

### Production
- **Domain Restrictions**: Configure allowed domains in Supabase
- **Rate Limiting**: Enable rate limiting for auth endpoints
- **Monitoring**: Set up alerts for failed authentication attempts

### User Data
- **Minimal Data**: Collect only necessary user information
- **Data Retention**: Follow GDPR guidelines for data retention
- **Encryption**: All sensitive data encrypted in transit and at rest

---

*Need help? Check our [troubleshooting guide](./authentication-system.md#troubleshooting) or create an issue on GitHub.*