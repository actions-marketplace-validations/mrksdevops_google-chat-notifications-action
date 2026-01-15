import * as core from '@actions/core'
import { run } from '../src/main'
import { notify } from '../src/chat'

// Mock dependencies
jest.mock('@actions/core')
jest.mock('../src/chat')
jest.mock('../src/status', () => ({
  parse: jest.fn((s) => s),
}))

describe('Main Action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should call notify with correct inputs', async () => {
    const mockGetInput = core.getInput as jest.Mock
    mockGetInput.mockImplementation((name: string) => {
      switch (name) {
        case 'title': return 'Custom Title'
        case 'subtitle': return 'Custom Subtitle'
        case 'webhookUrl': return 'https://webhook.url'
        case 'status': return 'success'
        case 'threadKey': return 'thread-123'
        default: return ''
      }
    })

    await run()

    expect(notify).toHaveBeenCalledWith({
      title: 'Custom Title',
      subtitle: 'Custom Subtitle',
      webhookUrl: 'https://webhook.url',
      status: 'success',
      threadKey: 'thread-123',
    })
    expect(core.info).toHaveBeenCalledWith('Sent message successfully.')
  })

  it('should use default title if not provided', async () => {
    const mockGetInput = core.getInput as jest.Mock
    mockGetInput.mockImplementation((name: string) => {
      switch (name) {
        case 'title': return ''
        case 'webhookUrl': return 'https://webhook.url'
        case 'status': return 'success'
        default: return ''
      }
    })

    await run()

    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Build',
      }),
    )
  })

  it('should set failed if an error occurs', async () => {
    const mockGetInput = core.getInput as jest.Mock
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'webhookUrl') return 'https://webhook.url'
      if (name === 'status') return 'success'
      return ''
    })

    const error = new Error('Test Error')
      ; (notify as jest.Mock).mockRejectedValue(error)

    await run()

    expect(core.setFailed).toHaveBeenCalledWith('Test Error')
  })

  it('should handle unknown errors', async () => {
    const mockGetInput = core.getInput as jest.Mock
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'webhookUrl') return 'https://webhook.url'
      if (name === 'status') return 'success'
      return ''
    })

      ; (notify as jest.Mock).mockRejectedValue('String Error')

    await run()

    expect(core.setFailed).toHaveBeenCalledWith('An unknown error occurred: String Error')
  })
})
