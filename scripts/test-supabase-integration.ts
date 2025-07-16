// Test script for Supabase integration
// Run with: npx tsx scripts/test-supabase-integration.ts

import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// Polyfill __dirname for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables from .env.local
config({ path: resolve(__dirname, '../.env.local') })

// Create Supabase client for testing
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

async function testSupabaseConnection() {
  console.log('Testing Supabase connection...')
  
  try {
    // Test basic connection
    const { data, error } = await supabase
      .from('user_profiles')
      .select('count')
      .limit(1)
    
    if (error) {
      console.error('❌ Connection failed:', error.message)
      return false
    }
    
    console.log('✅ Connection successful')
    return true
  } catch (error) {
    console.error('❌ Connection error:', error)
    return false
  }
}

async function testDatabaseSchema() {
  console.log('Testing database schema...')
  
  try {
    // Test if tables exist by querying them
    const tables = [
      'user_profiles',
      'usage_stats', 
      'subscriptions',
      'billing_info',
      'processing_history'
    ]
    
    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(1)
      
      if (error) {
        console.error(`❌ Table ${table} error:`, error.message)
        return false
      }
      
      console.log(`✅ Table ${table} exists`)
    }
    
    return true
  } catch (error) {
    console.error('❌ Schema test error:', error)
    return false
  }
}

async function testRPCFunctions() {
  console.log('Testing RPC functions...')
  
  try {
    // Test get_current_usage function with dummy UUID
    const dummyUserId = '00000000-0000-0000-0000-000000000000'
    
    const { data, error } = await supabase.rpc('get_current_usage', {
      user_uuid: dummyUserId
    })
    
    if (error) {
      console.error('❌ RPC function test failed:', error.message)
      return false
    }
    
    console.log('✅ RPC functions working')
    console.log('Sample usage data:', data)
    return true
  } catch (error) {
    console.error('❌ RPC test error:', error)
    return false
  }
}

async function runTests() {
  console.log('🚀 Starting Supabase integration tests...\n')
  
  const connectionTest = await testSupabaseConnection()
  if (!connectionTest) {
    console.log('\n❌ Connection test failed. Check your .env.local file.')
    process.exit(1)
  }
  
  const schemaTest = await testDatabaseSchema()
  if (!schemaTest) {
    console.log('\n❌ Schema test failed. Run the migration in Supabase dashboard.')
    process.exit(1)
  }
  
  const rpcTest = await testRPCFunctions()
  if (!rpcTest) {
    console.log('\n❌ RPC test failed. Check if functions were created properly.')
    process.exit(1)
  }
  
  console.log('\n🎉 All tests passed! Supabase integration is working correctly.')
  console.log('\nNext steps:')
  console.log('1. Apply the migration using the Supabase dashboard')
  console.log('2. Test the application with user registration/login')
  console.log('3. Verify tier limits and usage tracking work correctly')
}

// Run the tests
runTests().catch(console.error)