Set up the repo for public release.

1. git init, apply the full .gitignore we agreed (spk\_debug\_key.pem,
.virtual-scene.json, *.esproj.*.lock, Cache/, Workspaces/,
PluginsUserPreferences/, .font\_tmp/, .icon\_tmp/, tempAssetGen/,
performance\_traces/\*.pftrace, and the MCP config files). Commit Support/.
2. Show me `git status` and the full list of files that WILL be committed
before you commit anything. I want to read it.
3. Confirm Assets/Scene.scene is in that list and contains placeholders, not
tokens.

Also, from the audit: .gitignore MUST include spk\_debug\_key.pem (Ed25519

signing key), .virtual-scene.json, and Orbit.esproj.\*.lock. Confirm all three

are excluded in the file list you show me before committing.

