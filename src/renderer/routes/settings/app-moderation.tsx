import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
  Title,
} from '@mantine/core'
import {
  IconAlertTriangle,
  IconBan,
  IconFlag,
  IconInfoCircle,
  IconShield,
  IconShieldCheck,
  IconTrash,
} from '@tabler/icons-react'
import { useChatBridgeAuth } from '../../stores/chatbridgeAuthStore'

const API_BASE = 'http://localhost:3001/api'

interface PluginRule {
  id: string
  title: string
  description: string
  severity: 'info' | 'warning' | 'critical'
  is_active: number
}

interface Violation {
  id: string
  plugin_id: string
  plugin_name: string
  rule_id: string | null
  rule_title: string | null
  reason: string
  action_taken: 'flagged' | 'disabled' | 'removed'
  created_at: string
}

interface PluginInfo {
  id: string
  name: string
  version: string
  description: string
  category: string
  is_enabled: boolean
}

export const Route = createFileRoute('/settings/app-moderation')({
  component: AppModerationPage,
})

function AppModerationPage() {
  const token = useChatBridgeAuth((s) => s.token)
  const [rules, setRules] = useState<PluginRule[]>([])
  const [violations, setViolations] = useState<Violation[]>([])
  const [plugins, setPlugins] = useState<PluginInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Remove modal state
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<PluginInfo | null>(null)
  const [removeReason, setRemoveReason] = useState('')
  const [removeRuleId, setRemoveRuleId] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)

  // Flag modal state
  const [showFlagModal, setShowFlagModal] = useState(false)
  const [flagTarget, setFlagTarget] = useState<PluginInfo | null>(null)
  const [flagReason, setFlagReason] = useState('')
  const [flagRuleId, setFlagRuleId] = useState<string | null>(null)
  const [flagAction, setFlagAction] = useState<string | null>('flagged')
  const [flagging, setFlagging] = useState(false)

  const fetchData = async () => {
    if (!token) return
    try {
      setLoading(true)
      const [rulesRes, violationsRes, pluginsRes] = await Promise.all([
        fetch(`${API_BASE}/moderation/rules`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/moderation/violations`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/plugins`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      if (rulesRes.ok) setRules((await rulesRes.json()).rules || [])
      if (violationsRes.ok) setViolations((await violationsRes.json()).violations || [])
      if (pluginsRes.ok) setPlugins((await pluginsRes.json()).plugins || [])
      setError('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [token])

  const handleRemove = async () => {
    if (!token || !removeTarget) return
    setRemoving(true)
    setError('')

    try {
      const res = await fetch(`${API_BASE}/moderation/plugins/${removeTarget.id}/remove`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: removeReason || 'Removed for rule violation',
          rule_id: removeRuleId,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.message || 'Failed to remove plugin')
      }

      setSuccess(`"${removeTarget.name}" has been immediately removed from the platform.`)
      setShowRemoveModal(false)
      setRemoveTarget(null)
      setRemoveReason('')
      setRemoveRuleId(null)
      fetchData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setRemoving(false)
    }
  }

  const handleFlag = async () => {
    if (!token || !flagTarget) return
    setFlagging(true)
    setError('')

    try {
      const res = await fetch(`${API_BASE}/moderation/violations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plugin_id: flagTarget.id,
          rule_id: flagRuleId,
          reason: flagReason || 'Rule violation reported',
          action: flagAction,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.message || 'Failed to report violation')
      }

      const actionMsg =
        flagAction === 'removed'
          ? 'removed from the platform'
          : flagAction === 'disabled'
            ? 'disabled'
            : 'flagged for review'

      setSuccess(`"${flagTarget.name}" has been ${actionMsg}.`)
      setShowFlagModal(false)
      setFlagTarget(null)
      setFlagReason('')
      setFlagRuleId(null)
      setFlagAction('flagged')
      fetchData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setFlagging(false)
    }
  }

  const severityConfig = {
    critical: { color: 'red', icon: IconAlertTriangle },
    warning: { color: 'yellow', icon: IconFlag },
    info: { color: 'blue', icon: IconInfoCircle },
  }

  const actionColors: Record<string, string> = {
    flagged: 'yellow',
    disabled: 'orange',
    removed: 'red',
  }

  if (!token) {
    return (
      <Stack p="xl">
        <Title order={3}>App Moderation</Title>
        <Alert color="yellow">Please log in to access app moderation.</Alert>
      </Stack>
    )
  }

  return (
    <Stack p="xl" gap="lg">
      <Group justify="space-between">
        <Group gap="xs">
          <ThemeIcon variant="light" color="red" size="lg">
            <IconShield size={20} />
          </ThemeIcon>
          <Title order={3}>App Moderation</Title>
        </Group>
        <Badge variant="light" color="red" size="lg">
          {violations.length} violations logged
        </Badge>
      </Group>

      <Text size="sm" c="dimmed">
        Monitor registered apps for rule compliance. Apps that violate platform rules can be
        flagged, disabled, or immediately removed to protect students.
      </Text>

      {error && (
        <Alert color="red" variant="light" withCloseButton onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert color="green" variant="light" withCloseButton onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {loading ? (
        <Stack align="center" py="xl">
          <Loader size="md" />
          <Text size="sm" c="dimmed">Loading moderation data...</Text>
        </Stack>
      ) : (
        <>
          {/* Platform Rules */}
          <Box>
            <Group mb="sm" gap="xs">
              <IconShieldCheck size={18} />
              <Title order={5}>Platform Rules</Title>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              {rules.map((rule) => {
                const config = severityConfig[rule.severity]
                const Icon = config.icon
                return (
                  <Card key={rule.id} padding="sm" radius="md" withBorder>
                    <Group gap="xs" mb={4}>
                      <ThemeIcon variant="light" color={config.color} size="sm">
                        <Icon size={12} />
                      </ThemeIcon>
                      <Text size="sm" fw={600}>
                        {rule.title}
                      </Text>
                      <Badge color={config.color} variant="light" size="xs">
                        {rule.severity}
                      </Badge>
                    </Group>
                    <Text size="xs" c="dimmed">
                      {rule.description}
                    </Text>
                  </Card>
                )
              })}
            </SimpleGrid>
          </Box>

          <Divider />

          {/* Active Plugins — Quick Actions */}
          <Box>
            <Group mb="sm" gap="xs">
              <IconBan size={18} />
              <Title order={5}>Active Apps — Quick Actions</Title>
            </Group>
            {plugins.length === 0 ? (
              <Text c="dimmed" size="sm">No active plugins.</Text>
            ) : (
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                {plugins.map((plugin) => (
                  <Card key={plugin.id} padding="md" radius="md" withBorder>
                    <Group justify="space-between" mb="xs">
                      <Group gap="xs">
                        <Text fw={600} size="sm">
                          {plugin.name}
                        </Text>
                        <Badge
                          color={plugin.is_enabled ? 'green' : 'gray'}
                          variant="dot"
                          size="xs"
                        >
                          {plugin.is_enabled ? 'Active' : 'Disabled'}
                        </Badge>
                      </Group>
                    </Group>
                    <Text size="xs" c="dimmed" mb="sm">
                      {plugin.description || 'No description'}
                    </Text>
                    <Group gap="xs">
                      <Button
                        size="xs"
                        variant="light"
                        color="yellow"
                        leftSection={<IconFlag size={14} />}
                        onClick={() => {
                          setFlagTarget(plugin)
                          setShowFlagModal(true)
                        }}
                      >
                        Report
                      </Button>
                      <Button
                        size="xs"
                        variant="filled"
                        color="red"
                        leftSection={<IconTrash size={14} />}
                        onClick={() => {
                          setRemoveTarget(plugin)
                          setShowRemoveModal(true)
                        }}
                      >
                        Remove Now
                      </Button>
                    </Group>
                  </Card>
                ))}
              </SimpleGrid>
            )}
          </Box>

          <Divider />

          {/* Violation History */}
          <Box>
            <Group mb="sm" gap="xs">
              <IconAlertTriangle size={18} />
              <Title order={5}>Violation History</Title>
            </Group>
            {violations.length === 0 ? (
              <Text c="dimmed" size="sm">
                No violations recorded. All apps are in compliance.
              </Text>
            ) : (
              <Stack gap="xs">
                {violations.map((v) => (
                  <Card key={v.id} padding="sm" radius="sm" withBorder>
                    <Group justify="space-between">
                      <Group gap="xs">
                        <Text size="sm" fw={500}>
                          {v.plugin_name || v.plugin_id}
                        </Text>
                        <Badge color={actionColors[v.action_taken]} variant="light" size="xs">
                          {v.action_taken}
                        </Badge>
                        {v.rule_title && (
                          <Badge variant="outline" size="xs" color="gray">
                            {v.rule_title}
                          </Badge>
                        )}
                      </Group>
                      <Text size="xs" c="dimmed">
                        {new Date(v.created_at).toLocaleString()}
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed" mt={4}>
                      {v.reason}
                    </Text>
                  </Card>
                ))}
              </Stack>
            )}
          </Box>
        </>
      )}

      {/* Remove Plugin Modal */}
      <Modal
        opened={showRemoveModal}
        onClose={() => setShowRemoveModal(false)}
        title={
          <Group gap="xs">
            <ThemeIcon color="red" variant="light" size="sm">
              <IconTrash size={14} />
            </ThemeIcon>
            <Text fw={600}>Remove App Immediately</Text>
          </Group>
        }
      >
        <Stack gap="md">
          <Alert color="red" variant="light">
            This will immediately remove <strong>{removeTarget?.name}</strong> from the platform.
            All active sessions using this plugin will be terminated. This action cannot be undone.
          </Alert>

          <Select
            label="Rule Violated"
            placeholder="Select the rule that was violated"
            data={rules.map((r) => ({ value: r.id, label: `[${r.severity.toUpperCase()}] ${r.title}` }))}
            value={removeRuleId}
            onChange={setRemoveRuleId}
          />

          <Textarea
            label="Reason for Removal"
            placeholder="Describe the specific violation or behavior..."
            required
            minRows={3}
            value={removeReason}
            onChange={(e) => setRemoveReason(e.currentTarget.value)}
          />

          <Group justify="flex-end">
            <Button variant="light" onClick={() => setShowRemoveModal(false)}>
              Cancel
            </Button>
            <Button
              color="red"
              leftSection={<IconTrash size={16} />}
              onClick={handleRemove}
              loading={removing}
              disabled={!removeReason}
            >
              Remove Permanently
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Flag Plugin Modal */}
      <Modal
        opened={showFlagModal}
        onClose={() => setShowFlagModal(false)}
        title={
          <Group gap="xs">
            <ThemeIcon color="yellow" variant="light" size="sm">
              <IconFlag size={14} />
            </ThemeIcon>
            <Text fw={600}>Report Violation</Text>
          </Group>
        }
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Report a rule violation for <strong>{flagTarget?.name}</strong>. Choose the appropriate
            action based on severity.
          </Text>

          <Select
            label="Rule Violated"
            placeholder="Select the rule that was violated"
            data={rules.map((r) => ({ value: r.id, label: `[${r.severity.toUpperCase()}] ${r.title}` }))}
            value={flagRuleId}
            onChange={setFlagRuleId}
          />

          <Textarea
            label="Description"
            placeholder="Describe the specific violation..."
            required
            minRows={2}
            value={flagReason}
            onChange={(e) => setFlagReason(e.currentTarget.value)}
          />

          <Select
            label="Action"
            description="Choose the enforcement action"
            data={[
              { value: 'flagged', label: 'Flag for Review — Keep app active, log violation' },
              { value: 'disabled', label: 'Disable — Immediately disable the app' },
              { value: 'removed', label: 'Remove — Permanently remove from platform' },
            ]}
            value={flagAction}
            onChange={setFlagAction}
          />

          <Group justify="flex-end">
            <Button variant="light" onClick={() => setShowFlagModal(false)}>
              Cancel
            </Button>
            <Button
              color={flagAction === 'removed' ? 'red' : flagAction === 'disabled' ? 'orange' : 'yellow'}
              leftSection={<IconFlag size={16} />}
              onClick={handleFlag}
              loading={flagging}
              disabled={!flagReason}
            >
              Submit Report
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
