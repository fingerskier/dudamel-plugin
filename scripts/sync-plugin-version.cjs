const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const plugin = JSON.parse(fs.readFileSync('.claude-plugin/plugin.json', 'utf8'));
plugin.version = pkg.version;
fs.writeFileSync('.claude-plugin/plugin.json', JSON.stringify(plugin, null, 2) + '\n');
