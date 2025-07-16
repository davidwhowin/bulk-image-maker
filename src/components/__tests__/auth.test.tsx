import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from '../auth/LoginForm'
import { RegisterForm } from '../auth/RegisterForm'
import { ProtectedRoute } from '../auth/ProtectedRoute'

// Mock auth store
const mockLogin = vi.fn()
const mockRegister = vi.fn()
const mockIsAuthenticated = vi.fn()
const mockIsLoading = vi.fn()

vi.mock('../../lib/auth-store', () => ({
  useAuthStore: () => ({
    login: mockLogin,
    register: mockRegister,
    isAuthenticated: mockIsAuthenticated(),
    isLoading: mockIsLoading(),
    user: mockIsAuthenticated() ? { email: 'test@example.com', id: '123' } : null
  })
}))

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsAuthenticated.mockReturnValue(false)
    mockIsLoading.mockReturnValue(false)
  })

  it('should render login form fields', () => {
    render(<LoginForm />)
    
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('should call login function when form is submitted', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123')
    })
  })

  it.skip('should show validation errors for invalid email', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    
    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    await user.type(emailInput, 'invalid-email')
    await user.type(passwordInput, 'validpassword123')
    await user.click(submitButton)
    
    expect(await screen.findByText(/please enter a valid email address/i)).toBeInTheDocument()
  })

  it('should show validation errors for short password', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), '123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    
    expect(screen.getByText(/at least 6 characters/i)).toBeInTheDocument()
  })
})

describe('RegisterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsAuthenticated.mockReturnValue(false)
    mockIsLoading.mockReturnValue(false)
  })

  it('should render registration form fields', () => {
    render(<RegisterForm />)
    
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('should call register function when form is submitted', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)
    
    await user.type(screen.getByLabelText(/email/i), 'newuser@example.com')
    await user.type(screen.getByLabelText(/^password/i), 'password123')
    await user.type(screen.getByLabelText(/confirm password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('newuser@example.com', 'password123')
    })
  })

  it('should show error when passwords do not match', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)
    
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/^password/i), 'password123')
    await user.type(screen.getByLabelText(/confirm password/i), 'different')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    
    expect(screen.getByText(/passwords must match/i)).toBeInTheDocument()
  })
})

describe('ProtectedRoute', () => {
  const TestComponent = () => <div>Protected Content</div>

  it('should render children when user is authenticated', () => {
    mockIsAuthenticated.mockReturnValue(true)
    mockIsLoading.mockReturnValue(false)
    
    render(
      <ProtectedRoute>
        <TestComponent />
      </ProtectedRoute>
    )
    
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('should render login prompt when user is not authenticated', () => {
    mockIsAuthenticated.mockReturnValue(false)
    mockIsLoading.mockReturnValue(false)
    
    render(
      <ProtectedRoute>
        <TestComponent />
      </ProtectedRoute>
    )
    
    expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument()
    expect(screen.getByText(/sign up for free/i)).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('should toggle between login and registration modes', async () => {
    mockIsAuthenticated.mockReturnValue(false)
    mockIsLoading.mockReturnValue(false)
    const user = userEvent.setup()
    
    render(
      <ProtectedRoute>
        <TestComponent />
      </ProtectedRoute>
    )
    
    // Should start in login mode
    expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument()
    
    // Click sign up button
    await user.click(screen.getByText(/sign up for free/i))
    
    // Should switch to registration mode
    expect(screen.getByText(/create your account/i)).toBeInTheDocument()
    expect(screen.getByText(/sign in here/i)).toBeInTheDocument()
    
    // Click sign in link
    await user.click(screen.getByText(/sign in here/i))
    
    // Should switch back to login mode
    expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument()
  })

  it('should show loading state when authentication is loading', () => {
    mockIsAuthenticated.mockReturnValue(false)
    mockIsLoading.mockReturnValue(true)
    
    render(
      <ProtectedRoute>
        <TestComponent />
      </ProtectedRoute>
    )
    
    expect(screen.getByTestId('auth-loading')).toBeInTheDocument()
  })
})