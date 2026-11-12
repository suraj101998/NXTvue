import { describe, expect, it } from 'vitest'
import { ApiError } from './errors'

const reauthBody = {
  detail: {
    code: 'indmoney_reauth_required',
    reason: 'invalid_grant',
    message: 'Your INDmoney connection has expired. Reconnect to see live portfolio data.',
  },
}

describe('ApiError.fromResponse', () => {
  it('maps the typed INDmoney 424 to INDMONEY_REAUTH without retrying', () => {
    const err = ApiError.fromResponse(new Response(null, { status: 424 }), reauthBody)
    expect(err.code).toBe('INDMONEY_REAUTH')
    expect(err.needsReconnect).toBe(true)
    expect(err.retryable).toBe(false)
    expect(err.userMessage).toContain('INDmoney')
  })

  it('does not treat an unrelated 424 as a reconnect', () => {
    const err = ApiError.fromResponse(new Response(null, { status: 424 }), { detail: 'upstream failed' })
    expect(err.needsReconnect).toBe(false)
  })

  it('treats a 502 with a string detail as a retryable server error', () => {
    const err = ApiError.fromResponse(new Response(null, { status: 502 }), { detail: 'boom' })
    expect(err.code).toBe('SERVER_ERROR')
    expect(err.needsReconnect).toBe(false)
  })
})
