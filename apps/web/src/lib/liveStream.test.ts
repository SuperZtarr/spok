/* Tests du client SSE des séances : découpage des messages, commentaires ignorés, reconnexion. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseSseChunk, openLiveStream } from './liveStream'

vi.mock('./api', () => ({ getValidAccessToken: vi.fn(async () => 'tok'), LIVE_API_URL: '/api' }))

describe('parseSseChunk', () => {
  it('extrait les événements complets et garde le reste', () => {
    const { events, rest } = parseSseChunk(': ping\n\ndata: {"type":"ended","endedAt":"x"}\n\ndata: {"type":"pre')
    expect(events).toEqual([{ type: 'ended', endedAt: 'x' }])
    expect(rest).toBe('data: {"type":"pre')
  })
  it('ignore un message JSON invalide', () => {
    expect(parseSseChunk('data: {oops\n\n').events).toEqual([])
  })
})

describe('openLiveStream', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('reconnecte après fermeture du flux et rappelle onOpen', async () => {
    const encoder = new TextEncoder()
    const makeBody = () => new ReadableStream({ start(c) { c.enqueue(encoder.encode(': connected\n\n')); c.close() } })
    const fetchMock = vi.fn(async () => new Response(makeBody(), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const onOpen = vi.fn()
    const stop = openLiveStream('ls-1', { onEvent: vi.fn(), onOpen })
    await vi.advanceTimersByTimeAsync(0)
    expect(onOpen).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(2000)
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(onOpen.mock.calls.length).toBeGreaterThanOrEqual(2)
    stop()
  })

  it('envoie le token en header Authorization', async () => {
    const fetchMock = vi.fn(async () => new Response(new ReadableStream({ start(c) { c.close() } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const stop = openLiveStream('ls-1', { onEvent: vi.fn(), onOpen: vi.fn() })
    await vi.advanceTimersByTimeAsync(0)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/live-sessions/ls-1/stream')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    stop()
  })
})
