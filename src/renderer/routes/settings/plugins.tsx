import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Stack,
  Switch,
  Text,
  Title,
  Alert,
  SimpleGrid,
} from '@mantine/core'
import { useChatBridgeAuth } from '../../stores/chatbridgeAuthStore'

interface PluginTool {
  name: string
  description: string
}

interface Plugin {
  id: string
  name: string
  version: string
  description: string
  category: string
  auth_type: string
  is_enabled: boolean
  tools: PluginTool[]
}

const API_BASE = 'http://localhost:3001/api'

export const Route = createFileRoute('/settings/plugins')({
  component: PluginsSettingsPage,
})

function PluginsSettingsPage() {
  const token = useChatBridgeAuth((s) => s.token)
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toggling, setToggling] = useState<string | null>(null)

  const fetchPlugins = async () => {
    if (!token) return
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/plugins`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch plugins')
      const data = await res.json()
      setPlugins(data.plugins || [])
      setError('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlugins()
  }, [token])

  const togglePlugin = async (pluginId: string, enable: boolean) => {
    if (!token) return
    setToggling(pluginId)
    try {
      const endpoint = enable ? 'enable' : 'disable'
      await fetch(`${API_BASE}/plugins/${pluginId}/${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      setPlugins((prev) =>
        prev.map((p) => (p.id === pluginId ? { ...p, is_enabled: enable } : p))
      )
    } catch (err: any) {
      setError(`Failed to ${enable ? 'enable' : 'disable'} plugin`)
    } finally {
      setToggling(null)
    }
  }

  const categoryColors: Record<string, string> = {
    games: 'violet',
    tools: 'blue',
    education: 'teal',
    media: 'green',
    productivity: 'orange',
  }

  if (!token) {
    return (
      <Stack p="xl">
        <Title order={3}>Plugins</Title>
        <Alert color="yellow">Please log in to ChatBridge to manage plugins.</Alert>
      </Stack>
    )
  }

  return (
    <Stack p="xl" gap="lg">
      <Group justify="space-between">
        <Title order={3}>Plugins</Title>
        <Badge variant="light" size="lg">
          {plugins.filter((p) => p.is_enabled).length} active
        </Badge>
      </Group>

      {error && (
        <Alert color="red" variant="light" withCloseButton onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Stack align="center" py="xl">
          <Loader size="md" />
          <Text size="sm" c="dimmed">
            Loading plugins...
          </Text>
        </Stack>
      ) : plugins.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No plugins registered. The server should auto-register bundled plugins on startup.
        </Text>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          {plugins.map((plugin) => (
            <Card key={plugin.id} shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Group gap="xs">
                  <Text fw={600} size="md">
                    {plugin.name}
                  </Text>
                  <Badge color={categoryColors[plugin.category] || 'gray'} variant="light" size="xs">
                    {plugin.category}
                  </Badge>
                </Group>
                <Switch
                  checked={plugin.is_enabled}
                  onChange={(e) => togglePlugin(plugin.id, e.currentTarget.checked)}
                  disabled={toggling === plugin.id}
                  size="md"
                />
              </Group>

              <Text size="sm" c="dimmed" mb="sm">
                {plugin.description || 'No description'}
              </Text>

              <Text size="xs" fw={500} mb={4}>
                Tools ({plugin.tools?.length || 0}):
              </Text>
              <Stack gap={2}>
                {(plugin.tools || []).map((tool) => (
                  <Group key={tool.name} gap="xs">
                    <Badge size="xs" variant="dot" color="gray">
                      {tool.name}
                    </Badge>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {tool.description}
                    </Text>
                  </Group>
                ))}
              </Stack>

              <Group mt="md" justify="space-between">
                <Text size="xs" c="dimmed">
                  v{plugin.version}
                </Text>
                {plugin.auth_type !== 'none' && (
                  <Badge size="xs" color="yellow" variant="light">
                    OAuth: {plugin.auth_type}
                  </Badge>
                )}
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  )
}
