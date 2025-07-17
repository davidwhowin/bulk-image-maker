#!/bin/bash

# Stripe Webhook Forwarding Script
# This script forwards Stripe webhooks to your local development server

echo "🔌 Setting up Stripe webhook forwarding..."
echo "📝 Make sure your local server is running on http://localhost:3000"
echo ""

# Check if Stripe CLI is installed
if ! command -v stripe &> /dev/null; then
    if [ -f "$HOME/.local/bin/stripe" ]; then
        export PATH="$HOME/.local/bin:$PATH"
        echo "✅ Using Stripe CLI from ~/.local/bin"
    else
        echo "❌ Stripe CLI not found. Please install it first."
        exit 1
    fi
fi

# Check if user is logged in
if ! stripe config --list | grep -q "test_mode_api_key"; then
    echo "🔑 Please login to Stripe first:"
    echo "   stripe login"
    echo ""
    echo "📋 Then run this script again."
    exit 1
fi

echo "🎯 Forwarding webhooks to: http://localhost:3001/api/stripe/webhook"
echo "📡 Starting webhook listener..."
echo ""
echo "💡 Copy the webhook signing secret (whsec_...) to your .env.local file:"
echo "   STRIPE_WEBHOOK_SECRET=\"whsec_...\""
echo ""
echo "🔄 Press Ctrl+C to stop"
echo ""

# Forward webhooks to local API server
stripe listen --forward-to localhost:3001/api/stripe/webhook