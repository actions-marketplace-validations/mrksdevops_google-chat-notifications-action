import * as core from '@actions/core'
import { parse } from './status'
import { notify } from './chat'

export async function run() {
  try {
    const title = core.getInput('title', { required: false }) || 'Build'
    const subtitle = core.getInput('subtitle', { required: false })
    const webhookUrl = core.getInput('webhookUrl', { required: true })
    core.setSecret(webhookUrl)
    const status = parse(core.getInput('status', { required: true }))
    const threadKey = core.getInput('threadKey', { required: false })

    core.info(`input params: title=${title}, status=${status}, threadKey=${threadKey}`)

    await notify({ title, subtitle, webhookUrl, status, threadKey })
    core.info('Sent message successfully.')
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed(`An unknown error occurred: ${String(error)}`)
    }
  }
}

/* istanbul ignore next */
if (require.main === module) {
  run()
}
