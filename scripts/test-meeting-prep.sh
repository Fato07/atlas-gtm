#!/usr/bin/env bash

# =============================================================================
# Meeting Prep Agent Integration Test Script
# =============================================================================
#
# This script tests the end-to-end flow of the Meeting Prep Agent:
#   1. Starts the MCP REST API server
#   2. Starts the Meeting Prep Agent webhook server
#   3. Tests the health endpoints
#   4. Tests the MCP tools via REST API
#   5. Tests the brief generation webhook
#
# Prerequisites:
#   - Qdrant running on localhost:6333
#   - .env file with required variables
#   - bun installed
#   - Python environment with dependencies installed
#
# Usage:
#   ./scripts/test-meeting-prep.sh
#   ./scripts/test-meeting-prep.sh --skip-servers  # Skip starting servers (for manual testing)
#
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MCP_REST_PORT="${REST_PORT:-8100}"
MEETING_PREP_PORT="${MEETING_PREP_PORT:-3003}"
WEBHOOK_SECRET="${MEETING_PREP_SECRET:-test-secret-for-integration-testing-12345}"
TEST_PAYLOAD_DIR="$PROJECT_ROOT/packages/agents/src/__tests__/meeting-prep"

# Track PIDs for cleanup
MCP_PID=""
AGENT_PID=""

cleanup() {
    echo -e "\n${YELLOW}Cleaning up...${NC}"
    if [ -n "$MCP_PID" ]; then
        kill $MCP_PID 2>/dev/null || true
        echo "Stopped MCP REST server (PID: $MCP_PID)"
    fi
    if [ -n "$AGENT_PID" ]; then
        kill $AGENT_PID 2>/dev/null || true
        echo "Stopped Meeting Prep Agent (PID: $AGENT_PID)"
    fi
}

trap cleanup EXIT

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

wait_for_server() {
    local url=$1
    local name=$2
    local max_attempts=30
    local attempt=1

    log_info "Waiting for $name to be ready..."
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            log_success "$name is ready!"
            return 0
        fi
        sleep 1
        ((attempt++))
    done
    log_error "$name did not start in time"
    return 1
}

# =============================================================================
# Parse arguments
# =============================================================================

SKIP_SERVERS=false
for arg in "$@"; do
    case $arg in
        --skip-servers)
            SKIP_SERVERS=true
            shift
            ;;
    esac
done

# =============================================================================
# Main test script
# =============================================================================

echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE} Meeting Prep Agent Integration Tests${NC}"
echo -e "${BLUE}=============================================${NC}\n"

cd "$PROJECT_ROOT"

# Check prerequisites
log_info "Checking prerequisites..."

if ! command -v curl &> /dev/null; then
    log_error "curl is required but not installed"
    exit 1
fi

if ! command -v bun &> /dev/null; then
    log_error "bun is required but not installed"
    exit 1
fi

if [ ! -f ".env" ]; then
    log_warn ".env file not found, using defaults"
fi

log_success "Prerequisites check passed"

# =============================================================================
# Start servers (unless skipped)
# =============================================================================

if [ "$SKIP_SERVERS" = false ]; then
    echo -e "\n${BLUE}--- Starting Servers ---${NC}\n"

    # Start MCP REST API server
    log_info "Starting MCP REST API server on port $MCP_REST_PORT..."
    cd "$PROJECT_ROOT/mcp-servers"

    # Activate venv if it exists
    if [ -f ".venv/bin/activate" ]; then
        source .venv/bin/activate
    fi

    python -m atlas_gtm_mcp rest &
    MCP_PID=$!
    cd "$PROJECT_ROOT"

    wait_for_server "http://localhost:$MCP_REST_PORT/health" "MCP REST API"

    # Start Meeting Prep Agent
    log_info "Starting Meeting Prep Agent on port $MEETING_PREP_PORT..."
    cd "$PROJECT_ROOT"

    # Export required env vars for testing
    export MEETING_PREP_SECRET="$WEBHOOK_SECRET"
    export MCP_SERVER_URL="http://localhost:$MCP_REST_PORT"
    export MEETING_PREP_PORT="$MEETING_PREP_PORT"

    bun run meeting-prep:dev &
    AGENT_PID=$!

    wait_for_server "http://localhost:$MEETING_PREP_PORT/webhook/meeting-prep/health" "Meeting Prep Agent"
else
    log_info "Skipping server startup (--skip-servers flag)"
fi

# =============================================================================
# Test 1: MCP REST API Health
# =============================================================================

echo -e "\n${BLUE}--- Test 1: MCP REST API Health ---${NC}\n"

response=$(curl -s "http://localhost:$MCP_REST_PORT/health")
echo "Response: $response"

if echo "$response" | grep -q '"status":"healthy"'; then
    log_success "MCP REST API health check passed"
else
    log_error "MCP REST API health check failed"
    exit 1
fi

# =============================================================================
# Test 2: List MCP Tools
# =============================================================================

echo -e "\n${BLUE}--- Test 2: List MCP Tools ---${NC}\n"

response=$(curl -s "http://localhost:$MCP_REST_PORT/tools")
echo "Response: $response" | head -c 500
echo "..."

if echo "$response" | grep -q '"count":'; then
    tool_count=$(echo "$response" | grep -o '"count":[0-9]*' | grep -o '[0-9]*')
    log_success "Found $tool_count MCP tools"
else
    log_error "Failed to list MCP tools"
    exit 1
fi

# =============================================================================
# Test 3: Call MCP Tool (list_brains)
# =============================================================================

echo -e "\n${BLUE}--- Test 3: Call MCP Tool (list_brains) ---${NC}\n"

response=$(curl -s -X POST "http://localhost:$MCP_REST_PORT/tools/list_brains" \
    -H "Content-Type: application/json" \
    -d '{}')
echo "Response: $response" | head -c 500
echo ""

if echo "$response" | grep -q '\['; then
    log_success "list_brains tool call succeeded"
else
    log_warn "list_brains returned unexpected format (may be empty if no brains exist)"
fi

# =============================================================================
# Test 4: Meeting Prep Agent Health
# =============================================================================

echo -e "\n${BLUE}--- Test 4: Meeting Prep Agent Health ---${NC}\n"

response=$(curl -s "http://localhost:$MEETING_PREP_PORT/webhook/meeting-prep/health")
echo "Response: $response"

if echo "$response" | grep -q '"status"'; then
    log_success "Meeting Prep Agent health check passed"
else
    log_error "Meeting Prep Agent health check failed"
    exit 1
fi

# =============================================================================
# Test 5: Brief Generation Webhook (dry run)
# =============================================================================

echo -e "\n${BLUE}--- Test 5: Brief Generation Webhook ---${NC}\n"

if [ -f "$TEST_PAYLOAD_DIR/test-webhook-payload.json" ]; then
    log_info "Sending test webhook payload..."

    response=$(curl -s -X POST "http://localhost:$MEETING_PREP_PORT/webhook/meeting-prep/brief" \
        -H "Content-Type: application/json" \
        -H "X-Webhook-Secret: $WEBHOOK_SECRET" \
        -d @"$TEST_PAYLOAD_DIR/test-webhook-payload.json")

    echo "Response: $response"

    if echo "$response" | grep -q '"success"'; then
        log_success "Brief generation webhook responded"
    else
        log_warn "Brief generation webhook returned unexpected response"
    fi
else
    log_warn "Test payload file not found, skipping webhook test"
fi

# =============================================================================
# Test 6: Unauthorized Request
# =============================================================================

echo -e "\n${BLUE}--- Test 6: Unauthorized Request (should fail) ---${NC}\n"

response=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    "http://localhost:$MEETING_PREP_PORT/webhook/meeting-prep/brief" \
    -H "Content-Type: application/json" \
    -H "X-Webhook-Secret: wrong-secret" \
    -d '{"test": true}')

if [ "$response" = "401" ] || [ "$response" = "403" ]; then
    log_success "Unauthorized request correctly rejected (HTTP $response)"
else
    log_warn "Unexpected status code for unauthorized request: $response"
fi

# =============================================================================
# Summary
# =============================================================================

echo -e "\n${BLUE}=============================================${NC}"
echo -e "${GREEN} All integration tests completed!${NC}"
echo -e "${BLUE}=============================================${NC}\n"

log_info "Servers will be stopped automatically on exit"
log_info "To keep servers running, use Ctrl+C and then manually stop them"

# Wait a moment before cleanup
sleep 2
