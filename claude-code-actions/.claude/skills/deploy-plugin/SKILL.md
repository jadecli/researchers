# Skill: Deploy Plugin

Validate and publish plugins to the marketplace.

## When to Use

- A plugin is ready to be published to the marketplace
- You need to validate a plugin's structure and manifest before release
- You want to create a tagged release and marketplace PR

## Instructions

1. Ensure the plugin directory has the required structure:
   ```
   plugins/<plugin_name>/
   ├── manifest.json      # Required: name, version, description, entry_point
   ├── main.py            # Entry point (or whatever manifest specifies)
   ├── README.md          # Recommended for marketplace listing
   └── test_plugin.py     # Optional: tests
   ```

2. Validate locally before publishing:
   ```bash
   # Lint
   ruff check plugins/<plugin_name>/

   # Type check
   mypy plugins/<plugin_name>/ --ignore-missing-imports

   # Run tests
   pytest plugins/<plugin_name>/test_plugin.py -v

   # Validate manifest
   python -c "
   import json
   with open('plugins/<plugin_name>/manifest.json') as f:
       m = json.load(f)
   assert all(k in m for k in ['name', 'version', 'description', 'entry_point'])
   print(f'Valid: {m[\"name\"]} v{m[\"version\"]}')
   "
   ```

3. Publish via GitHub Actions:
   - Go to Actions > Plugin Publish > Run workflow
   - Enter plugin_name, version, and target marketplace

4. Or publish via GitLab CI:
   - Set `PLUGIN_NAME` and `PLUGIN_VERSION` variables
   - Trigger the pipeline manually

5. The workflow will:
   - Validate the plugin structure and manifest
   - Run linting and tests
   - Create a git tag: `plugin/<name>/v<version>`
   - Create a marketplace PR with the updated manifest

## Key Files

- `.github/workflows/plugin-publish.yml` -- GitHub Actions workflow
- `.gitlab-ci.yml` -- GitLab CI publish stage
- `chrome/form_automation.py` -- FormAutomator for web-based submission
