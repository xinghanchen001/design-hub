#!/bin/bash
echo "🔧 Switching to Development Database..."

cat > .env << 'EOF'
VITE_SUPABASE_URL=https://avlqnenlkwfvqvrwwhhh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2bHFuZW5sa3dmdnF2cnd3aGhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1OTExNTcsImV4cCI6MjA2ODE2NzE1N30.yAcPZHIKUCCuuDYK9proU-ISFVTjtgmHJtN6rDzfDT4
EOF

echo "✅ Local project now connects to DEVELOPMENT database"
echo "🗂️  Database: avlqnenlkwfvqvrwwhhh (isolated testing environment)"
echo "📝 TODO: Get development anon key from Supabase dashboard"
echo "🔄 Restart your dev server: npm run dev" 