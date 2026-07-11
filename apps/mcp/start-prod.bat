@echo off
rem Wrapper MCP prod — les credentials viennent du .env racine via launch.mjs (pas de secret ici).
node "C:/_dev/spok/apps/mcp/launch.mjs"
