#!/usr/bin/env node

const command = process.argv[2] || 'mcp';

switch (command) {
  case 'mcp': {
    const { startServer } = await import('../src/server.js');
    await startServer();
    break;
  }
  case 'serve': {
    const { startWebServer } = await import('../src/web.js');
    await startWebServer();
    break;
  }
  case 'auto-retrieve': {
    await import('../hooks/auto-retrieve.js');
    break;
  }
  case 'auto-persist': {
    await import('../hooks/auto-persist.js');
    break;
  }
  default:
    console.error(`Usage: dude-claude [mcp|serve|auto-retrieve|auto-persist]

Commands:
  mcp            Start the MCP stdio server (default)
  serve          Start the web UI server on http://127.0.0.1:${process.env.DUDE_PORT || 3456}
  auto-retrieve  Run the auto-retrieve hook (reads prompt from stdin)
  auto-persist   Run the auto-persist hook (reads classification from stdin)`);
    process.exit(1);
}
