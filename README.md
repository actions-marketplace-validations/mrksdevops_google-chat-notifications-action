# Google Chat Notification for GitHub Actions

Sends a Google Chat notification.

![Preview](images/preview.png 'Preview')

## Usage

### Parameters

|    Name    | Required | Default | Description |
| :--------: | :------: | :-----: | :--- |
|   title    |          | "Build" | The title of the card. |
|  subtitle  |          |         | The subtitle of the card. Recommended: `${{ github.event.head_commit.message }}`. Special HTML characters are automatically escaped. |
| webhookUrl |    ✅    |         | Your Google Chat Webhook URL. |
|   status   |    ✅    |         | Job status: `success`, `failure`, or `cancelled`. Recommended: `${{ job.status }}` |
| threadKey  |          |         | Optional key to group messages into a single thread. Uses the `messageReplyOption` to fallback to a new thread if it doesn't exist. |

### Features

- **Smart Links**: Automatically generates "OPEN EVENT" buttons pointing to the specific Commit or Pull Request that triggered the action.
- **Visual Cues**: Displays different status icons and colors based on the job outcome.
- **HTML Sanitization**: Automatically escapes `< > & "` characters to ensure message delivery even with complex commit messages.

### Example

```yaml
- name: Google Chat Notification
  uses: mrksdevops/google-chat-notifications-action@v1.0.0
  with:
    title: Build
    subtitle: ${{ github.event.head_commit.message }}
    webhookUrl: ${{ secrets.GOOGLE_CHAT_WEBHOOK }}
    status: ${{ job.status }}
    threadKey: ${{ secrets.GOOGLE_CHAT_THREAD_KEY }}
  if: always()
```

## Development

To contribute or modify this action:

1. Install dependencies:
   ```bash
   yarn install --registry https://registry.yarnpkg.com
   ```
2. Run tests:
   ```bash
   yarn test -- --coverage
   ```
3. Build the distribution package:
   ```bash
   yarn build
   ```
4. Maintenance:
   - `yarn clean:hard`: Full reset (removes `dist`, `node_modules`, `yarn.lock` and reinstalls with official registry).
   - `yarn upgrade:all`: Upgrades all dependencies to their latest official registry.

   *Note: This action uses `@vercel/ncc` to bundle everything into `dist/index.js`.*

### Important Notes

- **Registry**: This project uses the official Yarn registry (`https://registry.yarnpkg.com`) to ensure portability. 
- **Lockfile**: Always ensure that `yarn.lock` points to public registries and not to private internal proxies to avoid issues when running in environments like GitHub Actions. If you need to clean it, you can use `yarn clean:hard`.
