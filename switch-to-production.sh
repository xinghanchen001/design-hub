#!/bin/bash
echo "🏭 Switching to Production Database..."

cat > .env << 'EOF'
VITE_SUPABASE_URL=https://pwysjzyhhyfxhbymmklz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3eXNqenloaHlmeGhieW1ta2x6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyNjY3MjksImV4cCI6MjA2Nzg0MjcyOX0.hXWWxhuH1p7TsHIxpV1YfKg_YHMa0SX9sT8MZQq9s14
EOF

echo "✅ Local project now connects to PRODUCTION database"
echo "⚠️  Database: pwysjzyhhyfxhbymmklz (REAL DATA - be careful!)"
echo "🔄 Restart your dev server: npm run dev" 