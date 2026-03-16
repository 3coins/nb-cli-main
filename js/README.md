# nb - Notebook CLI (TypeScript/Bun)

A fast, programmatic command-line interface for working with Jupyter notebooks, built with TypeScript and Bun. Designed for AI agents, automation scripts, and developers who need reliable notebook manipulation without opening a browser.

[![BSD-3-Clause License](https://img.shields.io/badge/license-BSD--3--Clause-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org)
[![Bun](https://img.shields.io/badge/Bun-1.3-orange.svg)](https://bun.sh)

## Features

- 🚀 **Fast**: Built with Bun for lightning-fast startup and execution
- 📝 **Full CRUD**: Create, read, update, and delete notebook cells
- ⚡ **Execute**: Run notebooks locally using Python's nbclient
- 🔌 **Remote Mode**: Connect to JupyterLab servers for real-time collaboration
- 🔍 **Search**: Find code patterns and error cells
- 💻 **CLI First**: Designed for automation and scripting
- 🎨 **Interactive**: Beautiful CLI prompts using Ink for server selection
- 🧪 **Well Tested**: Comprehensive test suite with 57+ tests

## Installation

### Prerequisites

- [Bun](https://bun.sh) 1.3 or later
- Python 3 (for local execution)
- Optional: JupyterLab (for remote mode)

### Install from source

```bash
git clone https://github.com/jupyter-ai-contrib/nb-cli.git
cd nb-cli
bun install
bun link
```

Now you can use `nb` from anywhere!

### For local execution

Install Python dependencies:

```bash
pip install nbclient nbformat
```

**Note**: These dependencies are **only** required for local execution. Remote mode doesn't need them.

## Quick Start

```bash
# Create and build a notebook
nb create analysis.ipynb
nb cell add analysis.ipynb --source "import pandas as pd"
nb cell add analysis.ipynb --source "# Analysis" --type markdown
nb read analysis.ipynb

# Execute and view results
nb execute analysis.ipynb
nb read analysis.ipynb --with-outputs
```

## Commands

| Command | Purpose |
|---------|---------|
| `nb create <path>` | Create a new notebook |
| `nb read <path>` | Read notebook cells and metadata |
| `nb execute <path>` | Execute cells in notebook |
| `nb search <path> <pattern>` | Search text and errors in notebook cells |
| `nb cell add <path> --source <code>` | Add a new cell |
| `nb cell update <path> --cell-index <index>` | Update an existing cell |
| `nb cell delete <path> --cell-index <index>` | Delete a cell |
| `nb execute <path> --cell-index <index>` | Execute a specific cell |
| `nb output clear <path>` | Clear cell outputs |
| `nb connect [--server URL --token TOKEN]` | Connect to Jupyter server (auto-detects if no args) |
| `nb status` | Show current connection status |
| `nb disconnect` | Disconnect from server |
| `nb self version` | Show version information |

Use `--help` with any command for full details and options.

## Local Mode

**Default behavior. Operations directly modify `.ipynb` files.**

Local mode lets you create, edit, execute, and query notebooks on disk without any server running. All changes are written directly to the `.ipynb` file.

```bash
# Create and edit
nb create notebook.ipynb
nb cell add notebook.ipynb --source "x = 1 + 1"
nb cell update notebook.ipynb --cell-index 0 --source "x = 2 + 2"

# Read and search
nb read notebook.ipynb                    # View structure
nb read notebook.ipynb --cell-index 0     # View specific cell
nb search notebook.ipynb "import"         # Find patterns
nb search notebook.ipynb --with-errors    # Find cells with errors

# Execute locally (requires Python dependencies)
nb execute notebook.ipynb --cell-index 0  # Execute specific cell
nb execute notebook.ipynb                 # Execute all cells
```

## Remote Mode

**Connect to a running JupyterLab server for real-time synchronization.**

When you connect to a Jupyter server, the CLI can execute code using the server's kernel.

### Connect to a Server

**Auto-detection (recommended):**
```bash
nb connect
```

Automatically finds running Jupyter servers, validates them, and presents an interactive selection UI if multiple servers are found.

**Manual connection:**
```bash
nb connect --server http://localhost:8888 --token your-jupyter-token
```

### Connection Persistence

Connection info is saved in `.jupyter/cli.json` in the current directory. All subsequent commands automatically use this connection until you disconnect or change directories.

```bash
# Connect once (auto-detect)
nb connect

# Future commands use saved connection
nb cell add notebook.ipynb --source "df.head()"
nb execute notebook.ipynb --cell-index 0

# Check current connection
nb status

# Disconnect when done
nb disconnect
```

## Key Features

### Cell Referencing

Two ways to reference cells:
- **Index**: `--cell-index 0` or `-i 0` (position-based, supports negative indexing: `-1` = last cell)
- **ID**: `--cell "my-cell"` or `-c "my-cell"` (stable, doesn't change when cells move)

### Output Format

Control output format for better integration with your workflow:
- **JSON** (default): Structured, nbformat-compliant for programmatic use
- **Text** (`-f text`): Human-readable for terminal viewing

```bash
nb read notebook.ipynb -f text
```

### Multi-line Code

Escape sequences are automatically interpreted:

```bash
# Add cell with proper formatting
nb cell add notebook.ipynb \
  --source 'def hello():\n    print("world")\n\nhello()'

# Append to existing cell
nb cell update notebook.ipynb --cell-index 0 \
  --append '\n# Added comment\nprint("more")'
```

## Common Workflows

**Build notebook programmatically:**
```bash
nb create analysis.ipynb --template basic
nb cell add analysis.ipynb --source "import pandas as pd"
nb cell add analysis.ipynb --source "# Analysis" --type markdown
nb execute analysis.ipynb
```

**Debug and fix cells:**
```bash
# Find problematic cells
nb search notebook.ipynb --with-errors

# Inspect specific cell with outputs
nb read notebook.ipynb --cell-index 5 --with-outputs

# Fix the cell
nb cell update notebook.ipynb --cell-index 5 --source "fixed code"

# Re-execute
nb execute notebook.ipynb --cell-index 5
```

**Extract specific content:**
```bash
nb read notebook.ipynb --only-code         # All code cells
nb read notebook.ipynb --only-markdown     # All markdown
nb read notebook.ipynb --cell-index -1     # Last cell
```

**For AI agents:**
```bash
# Analyze all code in a notebook
nb read notebook.ipynb --only-code

# Find cells with errors
nb search notebook.ipynb --with-errors

# Add analysis cell and execute
nb cell add experiment.ipynb --source "df.describe()"
nb execute experiment.ipynb --cell-index -1
```

## Development

### Running tests

```bash
bun test
```

### Type checking

```bash
bun run typecheck
```

### Building

```bash
bun run build
```

## Project Structure

```
src/
├── index.ts              # Main entry point
├── cli.ts                # CLI setup with Commander
├── commands/             # Command implementations
│   ├── create.ts
│   ├── read.ts
│   ├── execute.ts
│   ├── search.ts
│   ├── cell.ts           # add/update/delete
│   ├── output.ts         # clear
│   ├── connect.ts
│   ├── status.ts
│   ├── disconnect.ts
│   └── self.ts           # version/update
├── notebook/             # Notebook operations
│   ├── io.ts             # read/write
│   ├── operations.ts     # cell manipulation
│   └── types.ts
├── execution/            # Code execution
│   ├── local/
│   │   ├── executor.ts
│   │   └── discovery.ts
│   ├── remote/
│   │   └── discovery.ts
│   └── types.ts
├── config/               # Configuration management
│   └── index.ts
└── ui/                   # Ink components
    └── components/
        └── ServerSelector.tsx
```

## Technology Stack

- **Runtime**: [Bun](https://bun.sh) - Fast JavaScript runtime with native TypeScript support
- **CLI Framework**: [Commander.js](https://github.com/tj/commander.js) - Command-line interface framework
- **UI**: [Ink](https://github.com/vadimdemedes/ink) - React for interactive CLI prompts
- **Jupyter Libraries**:
  - `@jupyterlab/nbformat` - Notebook format handling
  - `@jupyterlab/services` - Jupyter server communication
  - `@jupyter/ydoc` - Y.js CRDT for real-time sync

## Differences from Rust version

While functionally equivalent to the Rust version, this TypeScript implementation:

- Uses Bun's fast runtime and native TypeScript support
- Leverages the JavaScript/TypeScript ecosystem for Jupyter integrations
- Provides a more accessible codebase for JavaScript/TypeScript developers
- Uses Ink for beautiful interactive CLI components
- Directly integrates with Jupyter's JavaScript libraries

## License

[BSD-3-Clause](LICENSE)

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
