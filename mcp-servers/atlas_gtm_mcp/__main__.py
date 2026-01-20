"""Entry point for running the MCP server as a module.

Supports multiple modes:
    - REST mode (default): Run REST API wrapper for direct HTTP tool calls
    - MCP mode: Run native MCP protocol server
    - Combined mode: Run both REST API and MCP server on different ports

Usage:
    # REST API (for Meeting Prep Agent and other TypeScript agents)
    python -m atlas_gtm_mcp
    python -m atlas_gtm_mcp rest

    # Native MCP protocol
    python -m atlas_gtm_mcp mcp

    # Both servers
    python -m atlas_gtm_mcp combined

Environment variables:
    REST_PORT: Port for REST API (default: 8100)
    MCP_PORT: Port for MCP server (default: 8001)
"""

import asyncio
import os
import sys

from dotenv import load_dotenv

load_dotenv()


def run_rest_server():
    """Run only the REST API server."""
    import uvicorn
    from .rest_api import rest_app

    port = int(os.getenv("REST_PORT", "8100"))
    print(f"\n{'=' * 50}")
    print(f"Atlas GTM MCP REST API Server")
    print(f"{'=' * 50}")
    print(f"REST API: http://0.0.0.0:{port}")
    print(f"Health:   http://0.0.0.0:{port}/health")
    print(f"Tools:    http://0.0.0.0:{port}/tools")
    print(f"{'=' * 50}\n")

    uvicorn.run(rest_app, host="0.0.0.0", port=port, log_level="info")


def run_mcp_server():
    """Run only the native MCP server."""
    from .server import create_server

    port = int(os.getenv("MCP_PORT", "8001"))
    print(f"\n{'=' * 50}")
    print(f"Atlas GTM Native MCP Server")
    print(f"{'=' * 50}")
    print(f"MCP Server: http://0.0.0.0:{port}/mcp")
    print(f"{'=' * 50}\n")

    server = create_server()
    server.run(transport="http", host="0.0.0.0", port=port)


async def run_combined():
    """Run both REST API and MCP server concurrently."""
    import uvicorn
    from .rest_api import rest_app
    from .server import create_server

    rest_port = int(os.getenv("REST_PORT", "8100"))
    mcp_port = int(os.getenv("MCP_PORT", "8001"))

    print(f"\n{'=' * 50}")
    print(f"Atlas GTM Combined Server")
    print(f"{'=' * 50}")
    print(f"REST API:   http://0.0.0.0:{rest_port}")
    print(f"MCP Server: http://0.0.0.0:{mcp_port}/mcp")
    print(f"Health:     http://0.0.0.0:{rest_port}/health")
    print(f"Tools:      http://0.0.0.0:{rest_port}/tools")
    print(f"{'=' * 50}\n")

    # Create tasks for both servers
    async def run_rest():
        config = uvicorn.Config(rest_app, host="0.0.0.0", port=rest_port, log_level="info")
        server = uvicorn.Server(config)
        await server.serve()

    async def run_mcp():
        # MCP server uses its own event loop, so we run it in a thread
        import threading

        def mcp_thread():
            server = create_server()
            server.run(transport="http", host="0.0.0.0", port=mcp_port)

        thread = threading.Thread(target=mcp_thread, daemon=True)
        thread.start()

        # Keep the task alive while the thread runs
        while thread.is_alive():
            await asyncio.sleep(1)

    await asyncio.gather(run_rest(), run_mcp())


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "rest"

    if mode == "rest":
        run_rest_server()
    elif mode == "mcp":
        run_mcp_server()
    elif mode == "combined":
        asyncio.run(run_combined())
    else:
        print(f"Unknown mode: {mode}")
        print("Usage: python -m atlas_gtm_mcp [rest|mcp|combined]")
        sys.exit(1)
