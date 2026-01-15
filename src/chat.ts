import * as github from '@actions/github'
import axios from 'axios'
import { Status } from './status'

const statusColorPalette: Record<Status, string> = {
  success: '#2cbe4e',
  cancelled: '#ffc107',
  failure: '#ff0000',
}

const statusText: Record<Status, string> = {
  success: 'SUCCEEDED',
  cancelled: 'CANCELLED',
  failure: 'FAILED',
}

const statusIcon: Record<Status, string> = {
  success:
    'https://raw.githubusercontent.com/mrksdevops/google-chat-notifications-action/main/assets/status-success.png',
  cancelled:
    'https://raw.githubusercontent.com/mrksdevops/google-chat-notifications-action/main/assets/status-cancelled.png',
  failure:
    'https://raw.githubusercontent.com/mrksdevops/google-chat-notifications-action/main/assets/status-failure.png',
}

export const htmlEntities = (str: string) => {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

interface CardHeader {
  title: string
  subtitle: string
  imageUrl: string
  imageType: 'CIRCLE'
}

interface TextParagraph {
  text: string
}

interface Button {
  text: string
  onClick: {
    openLink: {
      url: string
    }
  }
}

interface DecoratedText {
  topLabel?: string
  text: string
  button?: Button
}

interface Widget {
  textParagraph?: TextParagraph
  decoratedText?: DecoratedText
  buttonList?: {
    buttons: Button[]
  }
}

interface Section {
  widgets: Widget[]
}

interface Card {
  header: CardHeader
  sections: Section[]
}

interface CardV2 {
  cardId: string
  card: Card
}

interface Thread {
  name: string
}

interface GoogleChatBody {
  cardsV2: CardV2[]
  thread?: Thread
}

const textButton = (text: string, url: string): Button => ({
  text,
  onClick: { openLink: { url } },
})

interface GithubContext {
  owner: string
  repo: string
  eventName: string
  sha: string
  ref: string
  issueNumber: number
}

export function getGithubContext(): GithubContext {
  const { owner, repo } = github.context.repo
  const { eventName, sha, ref } = github.context
  const { number } = github.context.issue
  return { owner, repo, eventName, sha, ref, issueNumber: number }
}

export function extractSpacesKey(webhookUrl: string): string | undefined {
  const skRegex = /spaces\/(.*?)\//.exec(webhookUrl)
  return skRegex ? skRegex[1] : undefined
}

export function createCardSections(status: Status, context: GithubContext, sanitizedSubtitle: string): Section[] {
  const { owner, repo, eventName, sha, ref, issueNumber } = context
  const repoUrl = `https://github.com/${owner}/${repo}`
  const eventPath = eventName === 'pull_request' ? `/pull/${issueNumber}` : `/commit/${sha}`
  const eventUrl = `${repoUrl}${eventPath}`
  const checksUrl = `${repoUrl}${eventPath}/checks`

  return [
    {
      widgets: [
        {
          textParagraph: {
            text: `<b><font color="${statusColorPalette[status]}">${statusText[status]}</font></b>`,
          },
        },
        {
          textParagraph: {
            text: sanitizedSubtitle,
          },
        },
      ],
    },
    {
      widgets: [
        {
          decoratedText: {
            topLabel: 'repository',
            text: `${owner}/${repo}`,
            button: textButton('OPEN REPOSITORY', repoUrl),
          },
        },
        {
          decoratedText: {
            topLabel: 'event name',
            text: eventName,
            button: textButton('OPEN EVENT', eventUrl),
          },
        },
        {
          decoratedText: {
            topLabel: 'ref',
            text: ref,
          },
        },
      ],
    },
    {
      widgets: [
        {
          buttonList: {
            buttons: [textButton('OPEN CHECKS', checksUrl)],
          },
        },
      ],
    },
  ]
}

export async function notify({
  title,
  subtitle,
  webhookUrl,
  status,
  threadKey,
}: {
  title: string
  subtitle?: string
  webhookUrl: string
  status: Status
  threadKey?: string
}) {
  try {
    const context = getGithubContext()
    const spacesKey = extractSpacesKey(webhookUrl)
    const sanitizedSubtitle = htmlEntities(subtitle?.replace(/(\r\n|\n|\r)/gm, ' ') ?? '')

    const body: GoogleChatBody = {
      cardsV2: [
        {
          cardId: 'google-chat-notifications',
          card: {
            header: {
              title,
              subtitle: sanitizedSubtitle,
              imageUrl: statusIcon[status],
              imageType: 'CIRCLE',
            },
            sections: createCardSections(status, context, sanitizedSubtitle),
          },
        },
      ],
    }

    if (threadKey && spacesKey) {
      body.thread = {
        name: `spaces/${spacesKey}/threads/${threadKey}`,
      }
    }

    const response = await axios.post(
      webhookUrl + (body.thread ? '&messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD' : ''),
      body,
      { timeout: 10000 }
    )

    if (response.status !== 200) {
      throw new Error(`Google Chat notification failed. response status=${response.status}`)
    }
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Google Chat notification failed. response status=${error.response.status}, data=${JSON.stringify(error.response.data)}`)
    }
    throw error
  }
}
