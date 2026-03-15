import React, { useState } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import type { JupyterServer } from '../../execution/remote/discovery.js';

interface ServerSelectorProps {
  servers: JupyterServer[];
  onSelect: (server: JupyterServer) => void;
  onCancel: () => void;
}

interface ServerItem {
  label: string;
  value: JupyterServer;
}

export function ServerSelector({ servers, onSelect, onCancel }: ServerSelectorProps) {
  const items: ServerItem[] = servers.map((server, index) => ({
    label: `${index + 1}. ${server.url}${
      server.notebook_dir ? ` (${server.notebook_dir})` : ''
    }`,
    value: server,
  }));

  items.push({
    label: 'Cancel',
    value: null as any,
  });

  const handleSelect = (item: ServerItem) => {
    if (item.value === null) {
      onCancel();
    } else {
      onSelect(item.value);
    }
  };

  return (
    <Box flexDirection="column">
      <Text bold>Select a Jupyter server:</Text>
      <Box marginTop={1}>
        <SelectInput items={items} onSelect={handleSelect} />
      </Box>
    </Box>
  );
}
