#!/bin/bash
# Cleanup orphaned Jupyter servers from tests

echo "🔍 Looking for orphaned Jupyter servers..."

# Find all jupyter lab/server processes
JUPYTER_PIDS=$(ps aux | grep -E 'jupyter (lab|server)' | grep -v grep | grep -E 'IdentityProvider.token=test|ServerApp.token=test' | awk '{print $2}')

if [ -z "$JUPYTER_PIDS" ]; then
    echo "✅ No orphaned test servers found"
    exit 0
fi

echo "⚠️  Found orphaned test server(s) with PIDs:"
echo "$JUPYTER_PIDS"

# Show the processes
ps aux | grep -E 'jupyter (lab|server)' | grep -v grep | grep -E 'IdentityProvider.token=test|ServerApp.token=test'

echo ""
read -p "Kill these processes? (y/N) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "$JUPYTER_PIDS" | xargs kill -TERM
    sleep 2

    # Check if any are still alive and force kill
    STILL_ALIVE=$(echo "$JUPYTER_PIDS" | xargs ps -p 2>/dev/null | grep jupyter | awk '{print $1}')
    if [ ! -z "$STILL_ALIVE" ]; then
        echo "⚠️  Some processes didn't stop, force killing..."
        echo "$STILL_ALIVE" | xargs kill -9
    fi

    echo "✅ Cleaned up orphaned servers"
else
    echo "❌ Cleanup cancelled"
fi
