import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useState } from 'react'
import {
  TextInput,
  PasswordInput,
  Button,
  Paper,
  Title,
  Text,
  Container,
  Stack,
  Alert,
  Select,
  Anchor,
} from '@mantine/core'
import { useChatBridgeAuth } from '../stores/chatbridgeAuthStore'

export const Route = createFileRoute('/register')({
  component: RegisterPage,
})

function RegisterPage() {
  const navigate = useNavigate()
  const register = useChatBridgeAuth((s) => s.register)
  const isLoading = useChatBridgeAuth((s) => s.isLoading)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<string>('student')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await register(email, password, displayName, role)
      navigate({ to: '/' })
    } catch (err: any) {
      setError(err.message || 'Registration failed')
    }
  }

  return (
    <Container size={420} my={80}>
      <Title ta="center" order={1}>
        ChatBridge
      </Title>
      <Text c="dimmed" size="sm" ta="center" mt={5}>
        Create your account
      </Text>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <form onSubmit={handleSubmit}>
          <Stack>
            {error && (
              <Alert color="red" variant="light">
                {error}
              </Alert>
            )}
            <TextInput
              label="Display Name"
              placeholder="Your name"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.currentTarget.value)}
            />
            <TextInput
              label="Email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
            />
            <PasswordInput
              label="Password"
              placeholder="At least 8 characters"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
            />
            <Select
              label="Role"
              data={[
                { value: 'student', label: 'Student' },
                { value: 'teacher', label: 'Teacher' },
              ]}
              value={role}
              onChange={(v) => setRole(v || 'student')}
            />
            <Button type="submit" fullWidth loading={isLoading}>
              Create account
            </Button>
          </Stack>
        </form>
        <Text c="dimmed" size="sm" ta="center" mt="md">
          Already have an account?{' '}
          <Anchor component={Link} to="/login" size="sm">
            Sign in
          </Anchor>
        </Text>
      </Paper>
    </Container>
  )
}
