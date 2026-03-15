#!/usr/bin/env python3
"""
Execute a Jupyter notebook cell or entire notebook.
"""
import sys
import json
import argparse
from pathlib import Path

try:
    from nbclient import NotebookClient
    from nbformat import read, write, NO_CONVERT
    from nbformat.v4 import new_code_cell
except ImportError:
    print(json.dumps({
        "error": "nbclient and nbformat are required. Install with: pip install nbclient nbformat"
    }))
    sys.exit(1)


def execute_cell(notebook_path: str, cell_index: int, timeout: int = 60) -> dict:
    """Execute a specific cell in the notebook."""
    try:
        # Read notebook
        with open(notebook_path, 'r') as f:
            nb = read(f, as_version=4)

        if cell_index < 0:
            cell_index = len(nb.cells) + cell_index

        if cell_index < 0 or cell_index >= len(nb.cells):
            return {
                "error": f"Cell index {cell_index} out of range (0-{len(nb.cells)-1})"
            }

        # Create notebook client
        client = NotebookClient(
            nb,
            timeout=timeout,
            kernel_name=nb.metadata.get('kernelspec', {}).get('name', 'python3')
        )

        # Execute the specific cell
        with client.setup_kernel():
            cell = nb.cells[cell_index]
            if cell.cell_type != 'code':
                return {
                    "error": f"Cell {cell_index} is not a code cell"
                }

            # Execute cell
            cell = client.execute_cell(cell, cell_index)
            nb.cells[cell_index] = cell

        # Write notebook back
        with open(notebook_path, 'w') as f:
            write(nb, f)

        return {
            "success": True,
            "outputs": cell.outputs,
            "execution_count": cell.execution_count
        }

    except Exception as e:
        return {
            "error": str(e)
        }


def execute_notebook(notebook_path: str, timeout: int = 600) -> dict:
    """Execute all cells in the notebook."""
    try:
        # Read notebook
        with open(notebook_path, 'r') as f:
            nb = read(f, as_version=4)

        # Create notebook client
        client = NotebookClient(
            nb,
            timeout=timeout,
            kernel_name=nb.metadata.get('kernelspec', {}).get('name', 'python3')
        )

        # Execute notebook
        client.execute()

        # Write notebook back
        with open(notebook_path, 'w') as f:
            write(nb, f)

        return {
            "success": True,
            "cell_count": len(nb.cells)
        }

    except Exception as e:
        return {
            "error": str(e)
        }


def main():
    parser = argparse.ArgumentParser(description='Execute Jupyter notebook cells')
    parser.add_argument('notebook', help='Path to notebook file')
    parser.add_argument('--cell-index', type=int, help='Cell index to execute')
    parser.add_argument('--timeout', type=int, default=60, help='Timeout in seconds')

    args = parser.parse_args()

    if args.cell_index is not None:
        result = execute_cell(args.notebook, args.cell_index, args.timeout)
    else:
        result = execute_notebook(args.notebook, args.timeout)

    print(json.dumps(result, default=str))


if __name__ == '__main__':
    main()
