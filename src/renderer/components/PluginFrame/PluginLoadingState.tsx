import { Alert, Button, Loader, Stack, Text } from '@mantine/core';
import type { FC } from 'react';

interface PluginLoadingProps {
  pluginName: string;
}

export const PluginLoading: FC<PluginLoadingProps> = ({ pluginName }) => {
  return (
    <Stack align="center" justify="center" className="py-8">
      <Loader size="sm" />
      <Text size="sm" c="dimmed">
        Loading {pluginName}...
      </Text>
    </Stack>
  );
};

interface PluginErrorStateProps {
  errorMessage: string;
  onRetry?: () => void;
}

export const PluginErrorState: FC<PluginErrorStateProps> = ({
  errorMessage,
  onRetry,
}) => {
  return (
    <Alert color="red" title="Plugin Error" className="my-2">
      <Text size="sm">{errorMessage}</Text>
      {onRetry && (
        <Button
          size="xs"
          variant="light"
          color="red"
          onClick={onRetry}
          className="mt-2"
        >
          Retry
        </Button>
      )}
    </Alert>
  );
};
