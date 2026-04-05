import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Code,
  Group,
  JsonInput,
  Loader,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core'
import { IconCheck, IconClock, IconPlus, IconSend, IconX } from '@tabler/icons-react'
import { useChatBridgeAuth } from '../../stores/chatbridgeAuthStore'

const API_BASE = 'http://localhost:3001/api'

interface Submission {
  id: string
  manifest: {
    id: string
    name: string
    version: string
    description?: string
    category?: string
    tools: Array<{ name: string; description: string }>
  }
  status: 'pending' | 'approved' | 'rejected'
  review_notes?: string
  created_at: string
}

interface PluginInfo {
  id: string
  name: string
  version: string
  description: string
  category: string
  is_enabled: boolean
  tools: Array<{ name: string; description: string }>
}

export const Route = createFileRoute('/settings/app-registry')({
  component: AppRegistryPage,
})

function AppRegistryPage() {
  const token = useChatBridgeAuth((s) => s.token)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [plugins, setPlugins] = useState<PluginInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [activeTab, setActiveTab] = useState<string | null>('registered')

  // Submit form state
  const [formName, setFormName] = useState('')
  const [formId, setFormId] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formCategory, setFormCategory] = useState<string | null>('education')
  const [formTools, setFormTools] = useState('[\n  {\n    "name": "my_tool",\n    "description": "Tool description",\n    "parameters": { "type": "object", "properties": {} }\n  }\n]')
  const [submitting, setSubmitting] = useState(false)

  const fetchData = async () => {
    if (!token) return
    try {
      setLoading(true)
      const [subRes, plugRes] = await Promise.all([
        fetch(`${API_BASE}/moderation/submissions`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/plugins`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      if (subRes.ok) {
        const data = await subRes.json()
        setSubmissions(data.submissions || [])
      }
      if (plugRes.ok) {
        const data = await plugRes.json()
        setPlugins(data.plugins || [])
      }
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

  const handleSubmit = async () => {
    if (!token) return
    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      let tools
      try {
        tools = JSON.parse(formTools)
      } catch {
        setError('Invalid JSON in tools definition')
        setSubmitting(false)
        return
      }

      const manifest = {
        id: formId,
        name: formName,
        version: '1.0.0',
        description: formDesc,
        iframe_url: formUrl,
        category: formCategory,
        auth_type: 'none',
        tools,
      }

      const res = await fetch(`${API_BASE}/moderation/submissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ manifest }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.message || 'Submission failed')
      }

      setSuccess('Plugin submitted for review! It will be available once approved.')
      setShowSubmitModal(false)
      setFormName('')
      setFormId('')
      setFormDesc('')
      setFormUrl('')
      setFormTools('[\n  {\n    "name": "my_tool",\n    "description": "Tool description",\n    "parameters": { "type": "object", "properties": {} }\n  }\n]')
      fetchData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleApprove = async (submissionId: string) => {
    if (!token) return
    try {
      const res = await fetch(`${API_BASE}/moderation/submissions/${submissionId}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error('Failed to approve')
      setSuccess('Plugin approved and registered!')
      fetchData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleReject = async (submissionId: string) => {
    if (!token) return
    try {
      const res = await fetch(`${API_BASE}/moderation/submissions/${submissionId}/reject`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Does not meet platform guidelines' }),
      })
      if (!res.ok) throw new Error('Failed to reject')
      setSuccess('Submission rejected.')
      fetchData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const statusColors: Record<string, string> = {
    pending: 'yellow',
    approved: 'green',
    rejected: 'red',
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
        <Title order={3}>App Registry</Title>
        <Alert color="yellow">Please log in to manage the app registry.</Alert>
      </Stack>
    )
  }

  return (
    <Stack p="xl" gap="lg">
      <Group justify="space-between">
        <Title order={3}>App Registry</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setShowSubmitModal(true)}>
          Register New App
        </Button>
      </Group>

      <Text size="sm" c="dimmed">
        Third-party developers can submit their educational apps here. All submissions are reviewed
        against our platform rules before approval.
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
          <Text size="sm" c="dimmed">Loading registry...</Text>
        </Stack>
      ) : (
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="registered">
              Registered Apps ({plugins.length})
            </Tabs.Tab>
            <Tabs.Tab value="pending">
              Pending Review ({submissions.filter((s) => s.status === 'pending').length})
            </Tabs.Tab>
            <Tabs.Tab value="all-submissions">
              All Submissions ({submissions.length})
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="registered" pt="md">
            {plugins.length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">
                No apps registered yet.
              </Text>
            ) : (
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                {plugins.map((plugin) => (
                  <Card key={plugin.id} shadow="sm" padding="lg" radius="md" withBorder>
                    <Group justify="space-between" mb="xs">
                      <Text fw={600}>{plugin.name}</Text>
                      <Group gap="xs">
                        <Badge
                          color={categoryColors[plugin.category] || 'gray'}
                          variant="light"
                          size="xs"
                        >
                          {plugin.category}
                        </Badge>
                        <Badge
                          color={plugin.is_enabled ? 'green' : 'gray'}
                          variant="dot"
                          size="xs"
                        >
                          {plugin.is_enabled ? 'Active' : 'Disabled'}
                        </Badge>
                      </Group>
                    </Group>
                    <Text size="sm" c="dimmed" mb="sm">
                      {plugin.description || 'No description'}
                    </Text>
                    <Text size="xs" c="dimmed">
                      v{plugin.version} · {plugin.tools?.length || 0} tools
                    </Text>
                  </Card>
                ))}
              </SimpleGrid>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="pending" pt="md">
            {submissions.filter((s) => s.status === 'pending').length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">
                No pending submissions.
              </Text>
            ) : (
              <Stack gap="md">
                {submissions
                  .filter((s) => s.status === 'pending')
                  .map((sub) => (
                    <Card key={sub.id} shadow="sm" padding="lg" radius="md" withBorder>
                      <Group justify="space-between" mb="xs">
                        <Group gap="xs">
                          <Text fw={600}>{sub.manifest.name}</Text>
                          <Badge color="yellow" variant="light" size="xs">
                            <IconClock size={10} style={{ marginRight: 4 }} />
                            Pending Review
                          </Badge>
                        </Group>
                      </Group>
                      <Text size="sm" c="dimmed" mb="xs">
                        {sub.manifest.description || 'No description'}
                      </Text>
                      <Text size="xs" mb="xs">
                        ID: <Code>{sub.manifest.id}</Code> · Category:{' '}
                        {sub.manifest.category || 'none'} · Tools:{' '}
                        {sub.manifest.tools?.length || 0}
                      </Text>
                      <Text size="xs" c="dimmed" mb="md">
                        Submitted {new Date(sub.created_at).toLocaleDateString()}
                      </Text>
                      <Group>
                        <Button
                          size="xs"
                          color="green"
                          leftSection={<IconCheck size={14} />}
                          onClick={() => handleApprove(sub.id)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="xs"
                          color="red"
                          variant="light"
                          leftSection={<IconX size={14} />}
                          onClick={() => handleReject(sub.id)}
                        >
                          Reject
                        </Button>
                      </Group>
                    </Card>
                  ))}
              </Stack>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="all-submissions" pt="md">
            {submissions.length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">
                No submissions yet.
              </Text>
            ) : (
              <Stack gap="md">
                {submissions.map((sub) => (
                  <Card key={sub.id} shadow="sm" padding="md" radius="md" withBorder>
                    <Group justify="space-between">
                      <Group gap="xs">
                        <Text fw={500} size="sm">
                          {sub.manifest.name}
                        </Text>
                        <Badge color={statusColors[sub.status]} variant="light" size="xs">
                          {sub.status}
                        </Badge>
                      </Group>
                      <Text size="xs" c="dimmed">
                        {new Date(sub.created_at).toLocaleDateString()}
                      </Text>
                    </Group>
                    {sub.review_notes && (
                      <Text size="xs" c="dimmed" mt="xs">
                        Review notes: {sub.review_notes}
                      </Text>
                    )}
                  </Card>
                ))}
              </Stack>
            )}
          </Tabs.Panel>
        </Tabs>
      )}

      {/* Submit Plugin Modal */}
      <Modal
        opened={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        title="Register New App"
        size="lg"
      >
        <Stack gap="md">
          <Alert color="blue" variant="light">
            Submit your educational app for review. All apps must comply with our platform rules
            including age-appropriate content, data privacy, and educational value requirements.
          </Alert>

          <TextInput
            label="App Name"
            placeholder="My Learning App"
            required
            value={formName}
            onChange={(e) => setFormName(e.currentTarget.value)}
          />

          <TextInput
            label="App ID"
            placeholder="my-learning-app"
            description="Lowercase letters, numbers, and hyphens only"
            required
            value={formId}
            onChange={(e) => setFormId(e.currentTarget.value)}
          />

          <Textarea
            label="Description"
            placeholder="Describe what your app teaches and how it helps students learn..."
            required
            minRows={2}
            value={formDesc}
            onChange={(e) => setFormDesc(e.currentTarget.value)}
          />

          <TextInput
            label="Plugin URL"
            placeholder="https://my-app.example.com/"
            description="The URL where your plugin is hosted"
            required
            value={formUrl}
            onChange={(e) => setFormUrl(e.currentTarget.value)}
          />

          <Select
            label="Category"
            data={[
              { value: 'education', label: 'Education' },
              { value: 'games', label: 'Games' },
              { value: 'tools', label: 'Tools' },
              { value: 'productivity', label: 'Productivity' },
            ]}
            value={formCategory}
            onChange={setFormCategory}
          />

          <JsonInput
            label="Tools Definition (JSON)"
            description="Define the tools your plugin exposes"
            minRows={6}
            formatOnBlur
            value={formTools}
            onChange={setFormTools}
          />

          <Group justify="flex-end">
            <Button variant="light" onClick={() => setShowSubmitModal(false)}>
              Cancel
            </Button>
            <Button
              leftSection={<IconSend size={16} />}
              onClick={handleSubmit}
              loading={submitting}
              disabled={!formName || !formId || !formUrl}
            >
              Submit for Review
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
