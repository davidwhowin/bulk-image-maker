# User Tiers System Documentation

## Overview

The User Tiers System provides comprehensive subscription management with usage-based limits, tier enforcement, and upgrade/downgrade functionality for the Bulk Image Optimizer platform.

## Architecture

### Core Components

```
src/
├── types/
│   ├── tiers.ts              # Tier limits and usage types
│   ├── subscription.ts       # Subscription management types
│   └── auth.ts               # Extended auth types with tier support
├── lib/
│   ├── tier-config.ts        # Tier configuration and limits
│   ├── tier-service.ts       # Core tier enforcement logic
│   ├── subscription-service.ts # Subscription management
│   ├── tier-error-handler.ts # Comprehensive error handling
│   ├── tier-performance.ts   # Performance monitoring
│   └── auth-store.ts         # Extended with tier actions
└── components/tiers/
    ├── TierStatusDisplay.tsx  # Usage and limits display
    ├── TierLimitChecker.tsx   # Real-time limit enforcement
    ├── UpgradePrompt.tsx      # Upgrade recommendations
    └── SubscriptionManager.tsx # Complete subscription UI
```

## Tier Structure

### Available Tiers

| Feature | Free | Pro ($29/mo) | Team ($149/mo) | Enterprise ($499/mo) |
|---------|------|--------------|----------------|----------------------|
| **Images/Month** | 100 | 3,000 | 15,000 | 75,000 |
| **Processing Speed** | 2-3 min | 10-15 sec | 3-5 sec | 1-2 sec |
| **File Size Limit** | 5MB | 25MB | 100MB | 500MB |
| **Batch Processing** | 1 image | 10 images | 50 images | 500 images |
| **Formats** | JPEG, PNG | All formats | All + early access | All + custom |
| **Team Features** | ❌ | ❌ | ✅ | ✅ |
| **Priority Support** | ❌ | Email | Live chat | Phone + manager |

### Tier Configuration

```typescript
// src/lib/tier-config.ts
export const TIER_LIMITS: TierConfig = {
  free: {
    maxImagesPerMonth: 100,
    maxFileSize: 5 * 1024 * 1024, // 5MB
    maxBatchSize: 1,
    processingPriority: 'low',
    processingDelay: 2 * 60 * 1000, // 2 minutes
    supportedFormats: ['image/jpeg', 'image/png'],
    teamFeatures: false,
    prioritySupport: 'none'
  },
  // ... other tiers
}
```

## Key Features

### 1. Real-Time Usage Tracking

```typescript
import { useAuthStore } from '@/lib/auth-store'

function ExampleComponent() {
  const { currentUsage, tierLimits, updateUsageStats } = useAuthStore()
  
  // Track usage after processing
  await updateUsageStats(imageCount, totalStorageUsed)
  
  // Check current usage
  const usagePercentage = (currentUsage.imagesProcessed / tierLimits.maxImagesPerMonth) * 100
}
```

### 2. Tier Enforcement

```typescript
import { useAuthStore } from '@/lib/auth-store'

function FileUploadComponent() {
  const { checkFileUploadLimits } = useAuthStore()
  
  const handleFileSelection = async (files: File[]) => {
    const result = await checkFileUploadLimits(files)
    
    if (!result.canProcess) {
      // Show upgrade prompt or error message
      console.log(result.message) // User-friendly error message
      console.log(result.limitType) // 'images' | 'fileSize' | 'batchSize' | 'format'
    }
  }
}
```

### 3. Subscription Management

```typescript
import { useAuthStore } from '@/lib/auth-store'

function UpgradeComponent() {
  const { upgradeUserTier, userTier } = useAuthStore()
  
  const handleUpgrade = async (targetTier: UserTier) => {
    const success = await upgradeUserTier(targetTier)
    if (success) {
      // User upgraded successfully
      // Tier limits automatically updated
    }
  }
}
```

### 4. Smart Recommendations

```typescript
import { useAuthStore } from '@/lib/auth-store'

function RecommendationComponent() {
  const { getSubscriptionRecommendation } = useAuthStore()
  
  useEffect(() => {
    const loadRecommendation = async () => {
      const recommendation = await getSubscriptionRecommendation()
      if (recommendation) {
        // Show upgrade or downgrade suggestion
        console.log(recommendation.recommendedTier)
        console.log(recommendation.reason)
        console.log(recommendation.potentialSavings) // For downgrades
      }
    }
    loadRecommendation()
  }, [])
}
```

## Usage Examples

### Basic Tier Status Display

```tsx
import { TierStatusDisplay } from '@/components/tiers'

function UserDashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <TierStatusDisplay className="mb-6" />
      {/* Rest of dashboard */}
    </div>
  )
}
```

### File Upload with Tier Checking

```tsx
import { TierLimitChecker } from '@/components/tiers'

function FileUploadArea() {
  const [files, setFiles] = useState<File[]>([])
  const [canProcess, setCanProcess] = useState(false)
  
  return (
    <TierLimitChecker 
      files={files}
      onLimitCheckResult={(result) => setCanProcess(result.canProcess)}
    >
      <div className={`upload-area ${canProcess ? 'enabled' : 'disabled'}`}>
        {/* Upload UI */}
      </div>
    </TierLimitChecker>
  )
}
```

### Complete Subscription Management

```tsx
import { SubscriptionManager } from '@/components/tiers'

function SettingsPage() {
  return (
    <div>
      <h1>Subscription Settings</h1>
      <SubscriptionManager 
        onUpgradeSuccess={(tier) => {
          console.log(`Upgraded to ${tier}`)
          // Show success message, redirect, etc.
        }}
      />
    </div>
  )
}
```

## Error Handling

### Comprehensive Error Types

```typescript
import { TierErrorCode, TierErrorHandler } from '@/lib/tier-error-handler'

// Automatic error handling with retries
try {
  const result = await tierService.checkUsageLimit(userId, tier, imageCount, fileSize)
} catch (error) {
  if (error.code === TierErrorCode.MONTHLY_LIMIT_EXCEEDED) {
    // Show upgrade prompt
  } else if (error.code === TierErrorCode.NETWORK_ERROR && error.isRetryable) {
    // Automatic retry with exponential backoff
  }
}
```

### Error Recovery

- **Automatic Retries**: Network and timeout errors automatically retry with exponential backoff
- **Data Validation**: Corrupted usage data is automatically reset with user notification
- **Graceful Degradation**: System continues to function even with partial failures
- **User-Friendly Messages**: Technical errors converted to actionable user messages

## Performance Optimizations

### Memory Management

- **LRU Caching**: Usage data cached with automatic eviction
- **Data Validation**: Prevents memory leaks from corrupted data
- **Batch Operations**: Efficient handling of concurrent requests

### Network Optimization

- **Request Debouncing**: Prevents excessive API calls
- **Intelligent Caching**: Reduces redundant tier lookups
- **Offline Handling**: Graceful degradation when offline

### Performance Monitoring

```typescript
import { tierPerformanceMonitor } from '@/lib/tier-performance'

// Automatic performance tracking
const metrics = tierPerformanceMonitor.getMetrics()
console.log(`Cache hit rate: ${metrics.cacheHitRate * 100}%`)
console.log(`Average response time: ${metrics.averageResponseTime}ms`)
console.log(`Error rate: ${metrics.errorRate * 100}%`)
```

## Testing

### Comprehensive Test Coverage

- **Unit Tests**: 21 tests covering tier limits and usage logic
- **Integration Tests**: 12 tests covering auth store integration
- **Subscription Tests**: 24 tests covering subscription management
- **Error Handling Tests**: 20+ tests covering edge cases and failures

### Running Tests

```bash
# Run all tier-related tests
npm test src/lib/__tests__/tier-system.test.ts
npm test src/lib/__tests__/auth-tier-integration.test.ts
npm test src/lib/__tests__/subscription-service.test.ts

# Run with coverage
npm run test:coverage
```

## Security Considerations

### Data Protection

- **Input Validation**: All user inputs validated and sanitized
- **Rate Limiting**: Prevents abuse with configurable rate limits
- **Error Message Sanitization**: Technical details hidden from users
- **Usage Data Encryption**: Sensitive usage data properly protected

### Subscription Security

- **Payment Method Validation**: Secure payment processing
- **Subscription State Verification**: Prevents unauthorized tier changes
- **Audit Logging**: Complete audit trail for subscription changes

## Production Deployment

### Environment Configuration

```bash
# Required environment variables
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key

# Optional: Stripe integration (for production)
VITE_STRIPE_PUBLIC_KEY=your-stripe-key
```

### Database Schema

```sql
-- Usage tracking table (to be created in Supabase)
CREATE TABLE user_usage (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  current_month TEXT NOT NULL,
  images_processed INTEGER DEFAULT 0,
  storage_used BIGINT DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  tier TEXT NOT NULL CHECK (tier IN ('free', 'pro', 'team', 'enterprise')),
  status TEXT NOT NULL,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Migration Guide

### From Mock to Production

1. **Replace TierService storage**: Update `tier-service.ts` to use Supabase instead of in-memory Map
2. **Add Stripe integration**: Replace mock subscription service with Stripe integration
3. **Update error handling**: Add production-specific error handling and monitoring
4. **Enable analytics**: Integrate with your analytics platform for usage tracking

### Backward Compatibility

- All existing users default to 'free' tier
- Existing usage patterns continue to work
- Gradual migration path for premium features

## Troubleshooting

### Common Issues

1. **Usage not updating**: Check `updateUsageStats` calls after image processing
2. **Tier limits not enforced**: Verify `checkFileUploadLimits` integration
3. **Subscription not reflecting**: Check subscription service and auth store sync

### Debug Mode

```typescript
// Enable debug logging
localStorage.setItem('tier-debug', 'true')

// Check current state
console.log(useAuthStore.getState())
```

## Implementation Checklist

### Core Tier System Setup
- [ ] Define tier limits configuration in `tier-config.ts`
- [ ] Create tier types and interfaces in `types/tiers.ts`
- [ ] Set up subscription types in `types/subscription.ts`
- [ ] Implement TierService with usage tracking
- [ ] Create SubscriptionService with payment integration
- [ ] Set up tier error handling system
- [ ] Add performance monitoring utilities
- [ ] Configure database schema for user usage
- [ ] Create subscription management tables
- [ ] Test tier configuration loading

### Usage Tracking Implementation
- [ ] Implement real-time usage tracking
- [ ] Add monthly usage reset functionality
- [ ] Create usage statistics aggregation
- [ ] Set up usage history tracking
- [ ] Add usage prediction algorithms
- [ ] Implement usage alerts and notifications
- [ ] Create usage analytics dashboard
- [ ] Test usage tracking accuracy
- [ ] Add usage data backup and recovery
- [ ] Implement usage fraud detection

### Tier Enforcement
- [ ] Create file upload limit checking
- [ ] Implement batch size enforcement
- [ ] Add file size limit validation
- [ ] Set up format restrictions by tier
- [ ] Create processing speed differentiation
- [ ] Add feature gating logic
- [ ] Implement priority queuing system
- [ ] Test limit enforcement accuracy
- [ ] Add bypass mechanisms for emergencies
- [ ] Create limit override for admin users

### User Interface Components
- [ ] Create TierStatusDisplay component
- [ ] Implement TierLimitChecker component
- [ ] Add UpgradePrompt with smart recommendations
- [ ] Create SubscriptionManager interface
- [ ] Add tier badge display in header
- [ ] Implement usage progress indicators
- [ ] Create tier comparison charts
- [ ] Add upgrade flow UI
- [ ] Test responsive design across devices
- [ ] Implement accessibility features

### Subscription Management
- [ ] Integrate with payment processor (Stripe)
- [ ] Implement subscription creation flow
- [ ] Add subscription modification (upgrade/downgrade)
- [ ] Create subscription cancellation flow
- [ ] Add proration handling
- [ ] Implement subscription renewal
- [ ] Add payment failure handling
- [ ] Create subscription analytics
- [ ] Test subscription state synchronization
- [ ] Add subscription webhook handling

### Smart Recommendations
- [ ] Implement usage pattern analysis
- [ ] Create tier recommendation engine
- [ ] Add cost optimization suggestions
- [ ] Implement upgrade/downgrade timing
- [ ] Add seasonal usage predictions
- [ ] Create personalized recommendations
- [ ] Add recommendation A/B testing
- [ ] Test recommendation accuracy
- [ ] Implement recommendation tracking
- [ ] Add recommendation feedback loop

### Error Handling & Recovery
- [ ] Create comprehensive error types
- [ ] Implement automatic retry logic
- [ ] Add graceful degradation strategies
- [ ] Create user-friendly error messages
- [ ] Add error logging and monitoring
- [ ] Implement circuit breaker patterns
- [ ] Create fallback mechanisms
- [ ] Test error recovery scenarios
- [ ] Add error analytics dashboard
- [ ] Implement error rate limiting

### Performance Optimization
- [ ] Implement LRU caching for usage data
- [ ] Add request debouncing
- [ ] Create batch operation optimizations
- [ ] Implement database query optimization
- [ ] Add memory management for large datasets
- [ ] Create performance monitoring
- [ ] Add response time tracking
- [ ] Implement cache invalidation strategies
- [ ] Test performance under load
- [ ] Add performance regression testing

### Testing & Quality Assurance
- [ ] Write unit tests for tier logic (21+ tests)
- [ ] Create integration tests for auth store
- [ ] Add subscription service tests (24+ tests)
- [ ] Implement error handling tests (20+ tests)
- [ ] Create UI component tests
- [ ] Add end-to-end tier flow tests
- [ ] Test payment integration
- [ ] Verify limit enforcement accuracy
- [ ] Test subscription state management
- [ ] Achieve 90%+ test coverage

### Security & Data Protection
- [ ] Implement input validation for all tier data
- [ ] Add rate limiting for tier operations
- [ ] Create secure payment processing
- [ ] Implement subscription fraud detection
- [ ] Add data encryption for sensitive information
- [ ] Create audit logging for tier changes
- [ ] Test security vulnerabilities
- [ ] Implement GDPR compliance
- [ ] Add data retention policies
- [ ] Create security monitoring alerts

### Production Deployment
- [ ] Set up environment variables
- [ ] Configure database migrations
- [ ] Set up payment processor webhooks
- [ ] Configure monitoring and alerting
- [ ] Create deployment scripts
- [ ] Set up backup procedures
- [ ] Configure scaling policies
- [ ] Test production deployment
- [ ] Add rollback procedures
- [ ] Create post-deployment verification

### Monitoring & Analytics
- [ ] Set up tier usage analytics
- [ ] Create subscription metrics dashboard
- [ ] Add conversion rate tracking
- [ ] Implement churn prediction
- [ ] Create revenue analytics
- [ ] Add user behavior tracking
- [ ] Set up performance monitoring
- [ ] Create alerting for critical metrics
- [ ] Test analytics accuracy
- [ ] Add reporting automation

### Documentation & Maintenance
- [ ] Document tier system architecture
- [ ] Create user tier guides
- [ ] Add troubleshooting documentation
- [ ] Document subscription management
- [ ] Create admin operation guides
- [ ] Add performance tuning guide
- [ ] Document security practices
- [ ] Create migration procedures
- [ ] Add API documentation
- [ ] Schedule regular system reviews

---

*Last Updated: December 2024*  
*Version: 1.0.0*