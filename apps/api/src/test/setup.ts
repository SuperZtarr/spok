// API test setup — runs before all tests

// Mock environment variables
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-jwt-secret'
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:25432/spok_test'
process.env.RESEND_API_KEY = 're_test_fake'
process.env.FRONTEND_URL = 'http://localhost:3000'
