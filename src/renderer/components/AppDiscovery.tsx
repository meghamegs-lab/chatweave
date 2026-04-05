import { Badge, Box, Card, Group, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core'
import {
  IconChess,
  IconMath,
  IconAbc,
  IconCoin,
  IconNews,
} from '@tabler/icons-react'
import { type FC, useEffect, useState } from 'react'
import { useUIStore } from '@/stores/uiStore'

const APP_ICONS: Record<string, React.ElementType> = {
  'chess-game': IconChess,
  'math-quest': IconMath,
  'word-lab': IconAbc,
  'money-sense': IconCoin,
  'fact-or-fiction': IconNews,
}

const APP_COLORS: Record<string, string> = {
  'chess-game': '#8B5CF6',
  'math-quest': '#F59E0B',
  'word-lab': '#10B981',
  'money-sense': '#3B82F6',
  'fact-or-fiction': '#EF4444',
}

const APP_PROMPTS: Record<string, string> = {
  'chess-game': "Let's play chess!",
  'math-quest': 'I want to practice math!',
  'word-lab': 'Help me learn new words!',
  'money-sense': 'Teach me about money!',
  'fact-or-fiction': 'How do I spot fake news?',
}

const APP_EMOJI: Record<string, string> = {
  'chess-game': '\u265E',
  'math-quest': '\u2795',
  'word-lab': '\uD83D\uDCDA',
  'money-sense': '\uD83D\uDCB0',
  'fact-or-fiction': '\uD83D\uDD0D',
}

interface AppInfo {
  id: string
  name: string
  description?: string
  category?: string
  is_enabled: boolean
}

interface AppDiscoveryProps {
  onSelectPrompt?: (prompt: string) => void
}

const AppDiscovery: FC<AppDiscoveryProps> = ({ onSelectPrompt }) => {
  const setQuote = useUIStore((s) => s.setQuote)
  const [apps, setApps] = useState<AppInfo[]>([])

  useEffect(() => {
    fetch('http://localhost:3001/api/plugins')
      .then((res) => res.json())
      .then((data) => {
        if (data.plugins) {
          setApps(data.plugins.filter((p: AppInfo) => p.is_enabled))
        }
      })
      .catch(() => {
        // Silently fail - discovery is optional
      })
  }, [])

  if (apps.length === 0) return null

  return (
    <Box>
      <Text size="sm" fw={700} c="chatbox-secondary" mb="xs">
        Learning Apps
      </Text>
      <Text size="xs" c="chatbox-tertiary" mb="md">
        Click any app to start learning! Just ask in the chat and the AI will launch it for you.
      </Text>
      <SimpleGrid cols={{ base: 1, xs: 2, sm: 3 }} spacing="sm">
        {apps.map((app) => {
          const Icon = APP_ICONS[app.id]
          const color = APP_COLORS[app.id] || '#6366F1'
          const emoji = APP_EMOJI[app.id] || ''
          const prompt = APP_PROMPTS[app.id]

          return (
            <UnstyledButton
              key={app.id}
              onClick={() => {
                if (prompt) {
                  setQuote(prompt)
                  onSelectPrompt?.(prompt)
                }
              }}
            >
              <Card
                shadow="sm"
                padding="md"
                radius="lg"
                withBorder
                className="transition-all hover:shadow-md hover:scale-[1.02] cursor-pointer"
                style={{
                  borderColor: `${color}33`,
                  background: `linear-gradient(135deg, ${color}08 0%, ${color}03 100%)`,
                }}
              >
                <Group gap="sm" wrap="nowrap" align="flex-start">
                  <Box
                    w={40}
                    h={40}
                    style={{
                      borderRadius: 12,
                      background: `${color}18`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {Icon ? (
                      <Icon size={22} color={color} />
                    ) : (
                      <Text size="lg">{emoji}</Text>
                    )}
                  </Box>
                  <Stack gap={4} style={{ minWidth: 0 }}>
                    <Group gap={6} wrap="nowrap">
                      <Text size="sm" fw={700} truncate="end">
                        {app.name}
                      </Text>
                    </Group>
                    {app.description && (
                      <Text size="xs" c="chatbox-tertiary" lineClamp={2} lh={1.4}>
                        {app.description}
                      </Text>
                    )}
                    {prompt && (
                      <Badge
                        size="xs"
                        variant="light"
                        color={color}
                        radius="sm"
                        style={{ alignSelf: 'flex-start' }}
                      >
                        Try: &quot;{prompt}&quot;
                      </Badge>
                    )}
                  </Stack>
                </Group>
              </Card>
            </UnstyledButton>
          )
        })}
      </SimpleGrid>
    </Box>
  )
}

export default AppDiscovery
