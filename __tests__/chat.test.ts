import * as github from '@actions/github'
import {
    htmlEntities,
    extractSpacesKey,
    createCardSections,
    getGithubContext,
    notify,
} from '../src/chat'

jest.mock('@actions/github', () => ({
    context: {
        repo: {
            owner: 'owner',
            repo: 'repo',
        },
        eventName: 'push',
        sha: 'sha',
        ref: 'refs/heads/master',
        issue: {
            number: 1,
        },
    },
}))

const mockFetch = jest.fn()
global.fetch = mockFetch

describe('Chat Unit Functions', () => {
    describe('htmlEntities', () => {
        it('should sanitize basic HTML tags', () => {
            expect(htmlEntities('<div>')).toBe('&lt;div&gt;')
        })

        it('should sanitize characters: & < > "', () => {
            expect(htmlEntities('a & b < c > d "e"')).toBe('a &amp; b &lt; c &gt; d &quot;e&quot;')
        })

        it('should handle complex combinations', () => {
            expect(htmlEntities('<script>alert("XSS")</script>')).toBe(
                '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;',
            )
        })

        it('should handle empty string', () => {
            expect(htmlEntities('')).toBe('')
        })

        it('should handle string with no special characters', () => {
            expect(htmlEntities('hello world')).toBe('hello world')
        })
    })

    describe('extractSpacesKey', () => {
        it('should extract key from valid webhook URL', () => {
            const url = 'https://chat.googleapis.com/v1/spaces/ABA123/messages?key=K&token=T'
            expect(extractSpacesKey(url)).toBe('ABA123')
        })

        it('should extract key from URL without query params', () => {
            const url = 'https://chat.googleapis.com/v1/spaces/XYZ789/messages'
            expect(extractSpacesKey(url)).toBe('XYZ789')
        })

        it('should return undefined for invalid URLs', () => {
            expect(extractSpacesKey('https://google.com')).toBeUndefined()
            expect(extractSpacesKey('no-spaces-here')).toBeUndefined()
            expect(extractSpacesKey('')).toBeUndefined()
        })
    })

    describe('getGithubContext', () => {
        it('should return context from github.context', () => {
            const context = getGithubContext()
            expect(context).toEqual({
                owner: 'owner',
                repo: 'repo',
                eventName: 'push',
                sha: 'sha',
                ref: 'refs/heads/master',
                issueNumber: 1,
            })
        })
    })

    describe('createCardSections', () => {
        const mockContext = {
            owner: 'mrksdevops',
            repo: 'test-repo',
            eventName: 'push',
            sha: '12345678',
            ref: 'refs/heads/main',
            issueNumber: 0,
        }

        it('should create correct section structure for success', () => {
            const sections = createCardSections('success', mockContext, 'Hello World')

            expect(sections).toHaveLength(3)

            // Section 0: Status and Subtitle
            expect(sections[0].widgets[0].textParagraph?.text).toContain('SUCCEEDED')
            expect(sections[0].widgets[0].textParagraph?.text).toContain('#2cbe4e')
            expect(sections[0].widgets[1].textParagraph?.text).toBe('Hello World')

            // Section 1: Repo details
            const repoWidget = sections[1].widgets[0].decoratedText
            expect(repoWidget?.text).toBe('mrksdevops/test-repo')
            expect(repoWidget?.button?.onClick.openLink.url).toBe('https://github.com/mrksdevops/test-repo')

            // Section 1: Event details
            const eventWidget = sections[1].widgets[1].decoratedText
            expect(eventWidget?.text).toBe('push')

            // Section 1: Ref details
            const refWidget = sections[1].widgets[2].decoratedText
            expect(refWidget?.text).toBe('refs/heads/main')

            // Section 2: Buttons
            const buttonWidget = sections[2].widgets[0].buttonList
            expect(buttonWidget?.buttons[0].text).toBe('OPEN CHECKS')
        })

        it('should create correct section structure for failure', () => {
            const sections = createCardSections('failure', mockContext, 'Error occurred')
            expect(sections[0].widgets[0].textParagraph?.text).toContain('FAILED')
            expect(sections[0].widgets[0].textParagraph?.text).toContain('#ff0000')
        })

        it('should create correct section structure for cancelled', () => {
            const sections = createCardSections('cancelled', mockContext, 'Job cancelled')
            expect(sections[0].widgets[0].textParagraph?.text).toContain('CANCELLED')
            expect(sections[0].widgets[0].textParagraph?.text).toContain('#ffc107')
        })

        it('should use commit URL for push event', () => {
            const sections = createCardSections('success', mockContext, '')
            const eventWidget = sections[1].widgets[1].decoratedText
            expect(eventWidget?.button?.onClick.openLink.url).toContain('/commit/12345678')
        })

        it('should use pull request URL for pull_request event', () => {
            const prContext = { ...mockContext, eventName: 'pull_request', issueNumber: 42 }
            const sections = createCardSections('success', prContext, '')
            const eventWidget = sections[1].widgets[1].decoratedText
            expect(eventWidget?.button?.onClick.openLink.url).toContain('/pull/42')
        })
    })

    describe('notify', () => {
        beforeEach(() => {
            mockFetch.mockReset()
        })

        it('should send a notification with correct payload', async () => {
            mockFetch.mockResolvedValue({ ok: true, status: 200 })

            await notify({
                title: 'Test Title',
                subtitle: 'Test Subtitle',
                webhookUrl: 'https://chat.googleapis.com/v1/spaces/SPACE_ID/messages?key=KEY&token=TOKEN',
                status: 'success',
            })

            expect(mockFetch).toHaveBeenCalledTimes(1)
            const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
            const body = JSON.parse(options.body as string)

            expect(url).toContain('https://chat.googleapis.com/v1/spaces/SPACE_ID/messages')
            expect(body).toHaveProperty('cardsV2')
            expect(body.cardsV2[0].card.header.title).toBe('Test Title')
            expect(body.cardsV2[0].card.header.subtitle).toBe('Test Subtitle')
        })

        it('should handle threading', async () => {
            mockFetch.mockResolvedValue({ ok: true, status: 200 })

            await notify({
                title: 'Thread Test',
                webhookUrl: 'https://chat.googleapis.com/v1/spaces/SPACE_ID/messages?key=KEY&token=TOKEN',
                status: 'success',
                threadKey: 'thread-123',
            })

            const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
            const body = JSON.parse(options.body as string)
            expect(url).toContain('messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD')
            expect(body.thread.name).toBe('spaces/SPACE_ID/threads/thread-123')
        })

        it('should sanitize HTML entities in subtitle and replace newlines', async () => {
            mockFetch.mockResolvedValue({ ok: true, status: 200 })

            await notify({
                title: 'HTML Test',
                subtitle: 'Title with <tag> &\n"quotes"',
                webhookUrl: 'https://chat.googleapis.com/v1/spaces/SPACE_ID/messages?key=KEY&token=TOKEN',
                status: 'success',
            })

            const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
            const body = JSON.parse(options.body as string)
            expect(body.cardsV2[0].card.header.subtitle).toBe('Title with &lt;tag&gt; &amp; &quot;quotes&quot;')
            // Check sections too
            expect(body.cardsV2[0].card.sections[0].widgets[1].textParagraph.text).toBe('Title with &lt;tag&gt; &amp; &quot;quotes&quot;')
        })

        it('should throw error when Google Chat API returns non-200 status', async () => {
            mockFetch.mockResolvedValue({ ok: false, status: 400, text: async () => 'Bad Request' })

            await expect(
                notify({
                    title: 'Fail Test',
                    webhookUrl: 'https://chat.googleapis.com/v1/spaces/SPACE_ID/messages?key=KEY&token=TOKEN',
                    status: 'failure',
                }),
            ).rejects.toThrow('Google Chat notification failed. response status=400')
        })

        it('should handle fetch network failure', async () => {
            mockFetch.mockRejectedValue(new Error('Network Error'))

            await expect(
                notify({
                    title: 'Fetch Fail',
                    webhookUrl: 'https://chat.googleapis.com/v1/spaces/SPACE_ID/messages?key=KEY&token=TOKEN',
                    status: 'success',
                }),
            ).rejects.toThrow('Network Error')
        })

        it('should handle failure and cancelled statuses colors/icons', async () => {
            mockFetch.mockResolvedValue({ ok: true, status: 200 })

            // Test failure
            await notify({
                title: 'Failure Title',
                webhookUrl: 'https://chat.googleapis.com/v1/spaces/SPACE_ID/messages?key=KEY&token=TOKEN',
                status: 'failure',
            })
            const [, failureOptions] = mockFetch.mock.calls[0] as [string, RequestInit]
            const failureBody = JSON.parse(failureOptions.body as string)
            expect(failureBody.cardsV2[0].card.header.imageUrl).toContain('failure.png')
            expect(failureBody.cardsV2[0].card.sections[0].widgets[0].textParagraph.text).toContain('#ff0000')

            // Test cancelled
            await notify({
                title: 'Cancelled Title',
                webhookUrl: 'https://chat.googleapis.com/v1/spaces/SPACE_ID/messages?key=KEY&token=TOKEN',
                status: 'cancelled',
            })
            const [, cancelledOptions] = mockFetch.mock.calls[1] as [string, RequestInit]
            const cancelledBody = JSON.parse(cancelledOptions.body as string)
            expect(cancelledBody.cardsV2[0].card.header.imageUrl).toContain('cancelled.png')
            expect(cancelledBody.cardsV2[0].card.sections[0].widgets[0].textParagraph.text).toContain('#ffc107')
        })

        it('should not include thread when spacesKey is missing in URL', async () => {
            mockFetch.mockResolvedValue({ ok: true, status: 200 })

            await notify({
                title: 'No Space Test',
                webhookUrl: 'https://chat.googleapis.com/v1/invalid-url',
                status: 'success',
                threadKey: 'some-thread',
            })

            const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
            const body = JSON.parse(options.body as string)
            expect(body).not.toHaveProperty('thread')
        })
    })
})
