import { Badge, Card, Group, Text } from '@mantine/core';
import type { FC } from 'react';

interface PluginCardProps {
  pluginName: string;
  completionSummary: string;
  completionData: Record<string, unknown>;
}

const PluginCard: FC<PluginCardProps> = ({
  pluginName,
  completionSummary,
}) => {
  return (
    <Card shadow="xs" padding="sm" radius="md" withBorder className="my-2">
      <Group justify="space-between" mb="xs">
        <Text fw={500} size="sm">
          {pluginName}
        </Text>
        <Badge color="green" variant="light" size="sm">
          Completed
        </Badge>
      </Group>
      <Text size="sm" c="dimmed">
        {completionSummary}
      </Text>
    </Card>
  );
};

export default PluginCard;
