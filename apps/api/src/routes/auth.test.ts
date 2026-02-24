import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { FastifyInstance } from 'fastify'
import { buildTestApp, MockPrisma, getTestToken } from '../test/helpers.js'

// Mock bcrypt for fast tests
vi.mock('bcrypt', () => ({
  hash: vi.fn().mockResolvedValue('$2b$10$hashedpassword'),
  compare: vi.fn().mockResolvedValue(true),
}))

// Mock resend — must be a real class since it's used with `new Resend(...)`
vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: vi.fn().mockResolvedValue({ data: { id: 'email-id' }, error: null }),
    }
  },
}))

let app: FastifyInstance
let prisma: MockPrisma

beforeEach(async () => {
  const test = await buildTestApp()
  app = test.app
  prisma = test.prisma
})

afterEach(async () => {
  await app.close()
  vi.clearAllMocks()
})

// ─── REGISTER ───────────────────────────────────────────────

describe('POST /auth/register', () => {
  const validBody = { email: 'new@test.com', password: 'password123', name: 'New User' }

  it('should register a new user and return 201', async () => {
    prisma.user.findUnique.mockResolvedValue(null)
    prisma.user.create.mockResolvedValue({
      id: 'new-id',
      email: 'new@test.com',
      emailVerified: false,
      name: 'New User',
      globalRole: 'USER',
      themePreference: 'system',
      avatarUrl: null,
      passwordHash: '$2b$10$hashedpassword',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    prisma.space.create.mockResolvedValue({ id: 'space-id' })
    prisma.refreshToken.create.mockResolvedValue({ id: 'rt-id' })
    prisma.emailVerificationToken.deleteMany.mockResolvedValue({ count: 0 })
    prisma.emailVerificationToken.create.mockResolvedValue({ id: 'evt-id' })

    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: validBody,
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.user.email).toBe('new@test.com')
    expect(body.user.name).toBe('New User')
    expect(body.tokens.accessToken).toBeDefined()
    expect(body.tokens.refreshToken).toBeDefined()
  })

  it('should return 409 if email already exists', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing', email: 'new@test.com' })

    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: validBody,
    })

    expect(res.statusCode).toBe(409)
  })

  it('should return 400 for invalid email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'not-an-email', password: 'password123', name: 'Test' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('should return 400 for short password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'ok@test.com', password: '123', name: 'Test' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('should return 400 for missing name', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'ok@test.com', password: 'password123' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('should create a personal space for the new user', async () => {
    prisma.user.findUnique.mockResolvedValue(null)
    prisma.user.create.mockResolvedValue({
      id: 'new-id', email: 'new@test.com', emailVerified: false,
      name: 'New User', globalRole: 'USER', themePreference: 'system',
      avatarUrl: null, passwordHash: 'h', createdAt: new Date(), updatedAt: new Date(),
    })
    prisma.space.create.mockResolvedValue({ id: 'space-id' })
    prisma.refreshToken.create.mockResolvedValue({ id: 'rt-id' })
    prisma.emailVerificationToken.deleteMany.mockResolvedValue({ count: 0 })
    prisma.emailVerificationToken.create.mockResolvedValue({ id: 'evt-id' })

    await app.inject({ method: 'POST', url: '/auth/register', payload: validBody })

    expect(prisma.space.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Mon espace personnel', type: 'PERSONAL' }),
      })
    )
  })
})

// ─── LOGIN ──────────────────────────────────────────────────

describe('POST /auth/login', () => {
  const validBody = { email: 'user@test.com', password: 'password123' }
  const mockUser = {
    id: 'user-id',
    email: 'user@test.com',
    emailVerified: true,
    name: 'Test User',
    globalRole: 'USER',
    themePreference: 'system',
    avatarUrl: null,
    passwordHash: '$2b$10$hashedpassword',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  it('should login successfully', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser)
    prisma.spaceMembership.findFirst.mockResolvedValue({ id: 'sm-id' }) // has personal space
    prisma.refreshToken.create.mockResolvedValue({ id: 'rt-id' })

    const res = await app.inject({ method: 'POST', url: '/auth/login', payload: validBody })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.user.email).toBe('user@test.com')
    expect(body.tokens.accessToken).toBeDefined()
    expect(body.tokens.refreshToken).toBeDefined()
  })

  it('should return 401 for wrong email', async () => {
    prisma.user.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'wrong@test.com', password: 'password123' },
    })

    expect(res.statusCode).toBe(401)
  })

  it('should return 401 for wrong password', async () => {
    const { compare } = await import('bcrypt')
    ;(compare as any).mockResolvedValueOnce(false)

    prisma.user.findUnique.mockResolvedValue(mockUser)

    const res = await app.inject({ method: 'POST', url: '/auth/login', payload: validBody })

    expect(res.statusCode).toBe(401)
  })

  it('should create personal space for legacy user without one', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser)
    prisma.spaceMembership.findFirst.mockResolvedValue(null) // no personal space
    prisma.space.create.mockResolvedValue({ id: 'new-space' })
    prisma.refreshToken.create.mockResolvedValue({ id: 'rt-id' })

    await app.inject({ method: 'POST', url: '/auth/login', payload: validBody })

    expect(prisma.space.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'PERSONAL' }),
      })
    )
  })
})

// ─── REFRESH ────────────────────────────────────────────────

describe('POST /auth/refresh', () => {
  it('should refresh tokens successfully', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-id',
      token: 'valid-refresh-token',
      userId: 'user-id',
      expiresAt: new Date(Date.now() + 86400000), // tomorrow
    })
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id', email: 'user@test.com',
    })
    prisma.refreshToken.delete.mockResolvedValue({})
    prisma.refreshToken.create.mockResolvedValue({ id: 'new-rt-id' })

    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: 'valid-refresh-token' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.tokens.accessToken).toBeDefined()
    expect(body.tokens.refreshToken).toBeDefined()
  })

  it('should return 401 for invalid refresh token', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: 'invalid-token' },
    })

    expect(res.statusCode).toBe(401)
  })

  it('should return 401 for expired refresh token', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-id',
      token: 'expired-token',
      userId: 'user-id',
      expiresAt: new Date(Date.now() - 86400000), // yesterday
    })
    prisma.refreshToken.delete.mockResolvedValue({})

    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: 'expired-token' },
    })

    expect(res.statusCode).toBe(401)
  })

  it('should delete old token on refresh', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-id', token: 'old-token', userId: 'user-id',
      expiresAt: new Date(Date.now() + 86400000),
    })
    prisma.user.findUnique.mockResolvedValue({ id: 'user-id', email: 'u@t.com' })
    prisma.refreshToken.delete.mockResolvedValue({})
    prisma.refreshToken.create.mockResolvedValue({ id: 'new-rt' })

    await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: 'old-token' },
    })

    expect(prisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'rt-id' } })
  })
})

// ─── LOGOUT ─────────────────────────────────────────────────

describe('POST /auth/logout', () => {
  it('should delete refresh token', async () => {
    prisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 })

    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      payload: { refreshToken: 'token-to-delete' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().success).toBe(true)
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { token: 'token-to-delete' },
    })
  })
})

// ─── GET /auth/me ───────────────────────────────────────────

describe('GET /auth/me', () => {
  it('should return current user with valid token', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id', email: 'user@test.com', emailVerified: true,
      name: 'Test', globalRole: 'USER', themePreference: 'system',
      avatarUrl: null, createdAt: new Date(),
    })

    const token = getTestToken(app)
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().email).toBe('user@test.com')
  })

  it('should return 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/me' })
    expect(res.statusCode).toBe(401)
  })

  it('should return 401 with invalid token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: 'Bearer invalid-token' },
    })
    expect(res.statusCode).toBe(401)
  })
})

// ─── FORGOT PASSWORD ────────────────────────────────────────

describe('POST /auth/forgot-password', () => {
  it('should return success even for non-existent email (prevent enumeration)', async () => {
    prisma.user.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: 'nonexistent@test.com' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().success).toBe(true)
  })

  it('should create reset token for existing user', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-id', email: 'user@test.com', name: 'User' })
    prisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 })
    prisma.passwordResetToken.create.mockResolvedValue({ id: 'prt-id' })

    const res = await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: 'user@test.com' },
    })

    expect(res.statusCode).toBe(200)
    expect(prisma.passwordResetToken.create).toHaveBeenCalled()
  })
})

// ─── RESET PASSWORD ─────────────────────────────────────────

describe('POST /auth/reset-password', () => {
  it('should reset password with valid token', async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 'prt-id',
      token: 'valid-token',
      userId: 'user-id',
      used: false,
      expiresAt: new Date(Date.now() + 3600000),
      user: { id: 'user-id' },
    })
    prisma.user.update.mockResolvedValue({})
    prisma.passwordResetToken.update.mockResolvedValue({})

    const res = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token: 'valid-token', password: 'newpassword123' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().success).toBe(true)
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-id' } })
    )
  })

  it('should return 400 for invalid token', async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token: 'invalid', password: 'newpassword123' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('should return 400 for expired token', async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 'prt-id', token: 'expired', userId: 'uid', used: false,
      expiresAt: new Date(Date.now() - 3600000), // expired
      user: { id: 'uid' },
    })
    prisma.passwordResetToken.delete.mockResolvedValue({})

    const res = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token: 'expired', password: 'newpassword123' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('should return 400 for already used token', async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 'prt-id', token: 'used', userId: 'uid', used: true,
      expiresAt: new Date(Date.now() + 3600000),
      user: { id: 'uid' },
    })

    const res = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token: 'used', password: 'newpassword123' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('should return 400 for short password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { token: 'some-token', password: '123' },
    })

    expect(res.statusCode).toBe(400)
  })
})

// ─── VERIFY EMAIL ───────────────────────────────────────────

describe('POST /auth/verify-email', () => {
  it('should verify email with valid token', async () => {
    prisma.emailVerificationToken.findUnique.mockResolvedValue({
      id: 'evt-id', token: 'valid', userId: 'uid', used: false,
      expiresAt: new Date(Date.now() + 86400000),
    })
    prisma.user.update.mockResolvedValue({})
    prisma.emailVerificationToken.update.mockResolvedValue({})

    const res = await app.inject({
      method: 'POST',
      url: '/auth/verify-email',
      payload: { token: 'valid' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().success).toBe(true)
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'uid' },
        data: { emailVerified: true },
      })
    )
  })

  it('should return 400 for invalid token', async () => {
    prisma.emailVerificationToken.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST',
      url: '/auth/verify-email',
      payload: { token: 'invalid' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('should return 400 for expired token', async () => {
    prisma.emailVerificationToken.findUnique.mockResolvedValue({
      id: 'evt-id', token: 'expired', userId: 'uid', used: false,
      expiresAt: new Date(Date.now() - 86400000),
    })
    prisma.emailVerificationToken.delete.mockResolvedValue({})

    const res = await app.inject({
      method: 'POST',
      url: '/auth/verify-email',
      payload: { token: 'expired' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('should return 400 for already used token', async () => {
    prisma.emailVerificationToken.findUnique.mockResolvedValue({
      id: 'evt-id', token: 'used', userId: 'uid', used: true,
      expiresAt: new Date(Date.now() + 86400000),
    })

    const res = await app.inject({
      method: 'POST',
      url: '/auth/verify-email',
      payload: { token: 'used' },
    })

    expect(res.statusCode).toBe(400)
  })
})
