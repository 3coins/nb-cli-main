import { Command } from 'commander';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { render, Box, Text, useInput, useApp, Static } from 'ink';
import * as chokidar from 'chokidar';
import chalk from 'chalk';
import type { ICodeCell, ICell, IOutput } from '@jupyterlab/nbformat';
import { readNotebook } from '../notebook/io.js';
import { getCellSource } from '../notebook/operations.js';
import type { Notebook } from '../notebook/types.js';

interface ViewOptions {
  theme: string;
}

export function viewCommand(): Command {
  const cmd = new Command('view');

  cmd
    .description('Interactive notebook viewer')
    .argument('<path>', 'Path to notebook file')
    .option('--theme <theme>', 'Color scheme: dark, light, or auto', 'dark')
    .action(async (path: string, options: ViewOptions) => {
      await executeView(path, options);
    });

  return cmd;
}

interface NotebookViewerProps {
  initialNotebook: Notebook;
  filePath: string;
  isDarkTheme: boolean;
}

const NotebookViewer: React.FC<NotebookViewerProps> = ({ initialNotebook, filePath, isDarkTheme }) => {
  const [notebook, setNotebook] = useState<Notebook>(initialNotebook);
  const [selectedCell, setSelectedCell] = useState(0);
  const { exit } = useApp();

  // Setup file watcher
  useEffect(() => {
    const watcher = chokidar.watch(filePath, { persistent: true });

    watcher.on('change', async () => {
      try {
        const newNotebook = await readNotebook(filePath);
        setNotebook(newNotebook);
        if (selectedCell >= newNotebook.cells.length) {
          setSelectedCell(Math.max(0, newNotebook.cells.length - 1));
        }
      } catch (error) {
        // Keep old notebook on error
      }
    });

    return () => {
      watcher.close();
    };
  }, [filePath]);

  // Keyboard input handler - moved outside useCallback to test
  useInput((input, key) => {
    if (input === 'q' || key.escape) {
      exit();
    } else if (input === 'j' || key.downArrow) {
      setSelectedCell((prev) => Math.min(notebook.cells.length - 1, prev + 1));
    } else if (input === 'k' || key.upArrow) {
      setSelectedCell((prev) => Math.max(0, prev - 1));
    } else if (input === 'g') {
      setSelectedCell(0);
    } else if (input === 'G') {
      setSelectedCell(Math.max(0, notebook.cells.length - 1));
    } else if (input === 'r') {
      readNotebook(filePath)
        .then((newNotebook) => {
          setNotebook(newNotebook);
          if (selectedCell >= newNotebook.cells.length) {
            setSelectedCell(Math.max(0, newNotebook.cells.length - 1));
          }
        })
        .catch(() => {
          // Keep old notebook on error
        });
    }
  });

  const kernel = notebook.metadata.kernelspec?.display_name || 'Unknown';
  const cellCount = notebook.cells.length;
  const currentCell = notebook.cells[selectedCell];

  return (
    <Box flexDirection="column">
      <Box borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text bold color="cyan">Notebook Viewer</Text>
        <Text dimColor> │ </Text>
        <Text>Kernel: </Text>
        <Text color="green">{kernel}</Text>
        <Text dimColor> │ </Text>
        <Text>Cells: </Text>
        <Text color="yellow">{cellCount}</Text>
      </Box>

      <Box borderStyle="round" borderColor="gray">
        <Box width="30%" flexDirection="column" paddingX={1} paddingY={1}>
          <Text bold color="magenta">CELLS</Text>
          {notebook.cells.map((cell, index) => (
            <CellListItem
              key={index}
              cell={cell}
              index={index}
              isSelected={index === selectedCell}
            />
          ))}
        </Box>

        <Box flexGrow={1} borderLeft borderColor="gray" flexDirection="column" paddingX={2} paddingY={1}>
          {currentCell && (
            <CellDetail cell={currentCell} index={selectedCell} notebook={notebook} isDarkTheme={isDarkTheme} />
          )}
        </Box>
      </Box>

      <Box borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text color="yellow">j/k/↑/↓</Text>
        <Text> Navigate  </Text>
        <Text color="yellow">g/G</Text>
        <Text> First/Last  </Text>
        <Text color="green">r</Text>
        <Text> Reload  </Text>
        <Text color="red">q</Text>
        <Text> Quit</Text>
      </Box>
    </Box>
  );
};

interface CellListItemProps {
  cell: ICell;
  index: number;
  isSelected: boolean;
}

const CellListItem: React.FC<CellListItemProps> = ({ cell, index, isSelected }) => {
  const getCellTypeSymbol = (cell: ICell): string => {
    switch (cell.cell_type) {
      case 'code':
        return '⚡';
      case 'markdown':
        return '#';
      case 'raw':
        return '○';
      default:
        return '?';
    }
  };

  const symbol = getCellTypeSymbol(cell);
  let execMarker = '';
  if (cell.cell_type === 'code') {
    const codeCell = cell as ICodeCell;
    execMarker = codeCell.execution_count !== null ? '✓' : '';
  }

  const source = getCellSource(cell);
  const preview = source.split('\n')[0].substring(0, 22);

  const displayText = `${index.toString().padStart(2, ' ')} ${symbol} ${execMarker ? execMarker + ' ' : ''}${preview}`;

  return (
    <Text color={isSelected ? 'black' : undefined} backgroundColor={isSelected ? 'yellow' : undefined} bold={isSelected}>
      {displayText}
    </Text>
  );
};

interface CellDetailProps {
  cell: ICell;
  index: number;
  notebook: Notebook;
  isDarkTheme: boolean;
}

const CellDetail: React.FC<CellDetailProps> = ({ cell, index }) => {
  const cellType = cell.cell_type;
  const source = getCellSource(cell);

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        Cell {index} <Text dimColor>|</Text> <Text color="magenta">{cellType}</Text>
      </Text>
      <Text> </Text>
      <Box flexDirection="column">
        {source.split('\n').map((line, i) => (
          <Text key={i}>{line}</Text>
        ))}
      </Box>
      {cell.cell_type === 'code' && <CodeCellOutputs cell={cell as ICodeCell} />}
    </Box>
  );
};

interface CodeCellOutputsProps {
  cell: ICodeCell;
}

const CodeCellOutputs: React.FC<CodeCellOutputsProps> = ({ cell }) => {
  if (cell.outputs.length === 0) return null;

  const outputHeader =
    cell.execution_count !== null ? `Outputs (exec: ${cell.execution_count})` : 'Outputs';

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>{'\n' + '─'.repeat(40)}</Text>
      <Box marginTop={1}>
        <Text color="green" bold>
          {outputHeader}
        </Text>
      </Box>
      {cell.outputs.map((output, i) => (
        <OutputDisplay key={i} output={output} />
      ))}
    </Box>
  );
};

interface OutputDisplayProps {
  output: IOutput;
}

const OutputDisplay: React.FC<OutputDisplayProps> = ({ output }) => {
  const formatOutput = (): { header: string; content: string; color?: string } => {
    switch (output.output_type) {
      case 'stream': {
        const streamOutput = output as any;
        const name = streamOutput.name || 'output';
        const text = Array.isArray(streamOutput.text) ? streamOutput.text.join('') : streamOutput.text;
        return { header: `[${name}]`, content: text, color: 'green' };
      }
      case 'execute_result': {
        const execOutput = output as any;
        const execCount = execOutput.execution_count;
        let text = '';
        if (execOutput.data && execOutput.data['text/plain']) {
          text = Array.isArray(execOutput.data['text/plain'])
            ? execOutput.data['text/plain'].join('')
            : execOutput.data['text/plain'];
        }
        return { header: `[Out ${execCount}]`, content: text, color: 'blue' };
      }
      case 'display_data': {
        const displayOutput = output as any;
        let text = '';
        if (displayOutput.data && displayOutput.data['text/plain']) {
          text = Array.isArray(displayOutput.data['text/plain'])
            ? displayOutput.data['text/plain'].join('')
            : displayOutput.data['text/plain'];
        }
        return { header: '[Display]', content: text, color: 'magenta' };
      }
      case 'error': {
        const errorOutput = output as any;
        return {
          header: `Error: ${errorOutput.ename}`,
          content: `  ${errorOutput.evalue}`,
          color: 'red',
        };
      }
      default:
        return { header: '', content: '' };
    }
  };

  const { header, content, color } = formatOutput();

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={color as any} bold>
        {header}
      </Text>
      <Box flexDirection="column">
        {content.split('\n').map((line, i) => (
          <Text key={i}>{line}</Text>
        ))}
      </Box>
    </Box>
  );
};

async function executeView(path: string, options: ViewOptions): Promise<void> {
  try {
    const notebook = await readNotebook(path);
    const isDarkTheme = options.theme.toLowerCase() !== 'light';

    // Clear screen before rendering
    process.stdout.write('\x1Bc');

    const { waitUntilExit, clear } = render(
      <NotebookViewer initialNotebook={notebook} filePath={path} isDarkTheme={isDarkTheme} />,
      {
        exitOnCtrlC: true,
        patchConsole: true,
      }
    );

    await waitUntilExit();
    clear();
  } catch (error) {
    console.error('Error loading notebook:', error);
    process.exit(1);
  }
}
