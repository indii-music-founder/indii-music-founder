# indiiOS User Manual: Telegram Adapter Configuration

## 1. Overview

The indiiOS Telegram Adapter allows users to issue commands and receive responses from the agent network directly through the Telegram messaging application. This document details the technical steps required to establish and authenticate a link between a user's Telegram client and their indiiOS account.

## 2. Prerequisites

- An active indiiOS account.
- The Telegram application installed on a mobile device or desktop.
- An environment where the indiiOS adapter Cloud Functions have been successfully deployed.

## 3. Configuration Steps

### 3.1 Initializing the Bot Interface

1. Launch the Telegram application.
2. In the global search bar, type `@BotFather` and select the verified account (marked with a blue checkmark).
3. Send the command `/newbot` to initiate the creation process.
4. Provide a Display Name for your bot (e.g., `indiiOS Assistant`).
5. Provide a unique Username ending in `bot` (e.g., `indiiOS_Control_Bot`).
6. Save the resulting **HTTP API Token** provided by BotFather. Do not share this token.

### 3.2 Server-Side Webhook Registration

*(This action is performed by the system administrator during infrastructure deployment. End users do not perform this step.)*
To route Telegram events to the indiiOS remote relay, the following commands must be executed in the deployment environment:

```bash
# 1. Update the GCP Secret Manager
echo -n "YOUR_API_TOKEN" | gcloud secrets versions add TELEGRAM_BOT_TOKEN --data-file=-

# 2. Register the Webhook Endpoint with Telegram
curl -X POST "https://api.telegram.org/bot<YOUR_API_TOKEN>/setWebhook?url=https://us-central1-indiios-v-1-1.cloudfunctions.net/telegramWebhook"
```

### 3.3 Authorizing the User Connection

To prevent unauthorized access, your Telegram chat must be explicitly linked to your indiiOS user ID.

1. Open the indiiOS application.
2. Navigate to **Settings > Integrations**.
3. Click "Generate Telegram Link Code" to generate a secure, 6-digit initialization code. This code will expire in 10 minutes.
4. Open the chat with your newly created Telegram bot.
5. Issue the linking command using your code:
   `/link 123456`
6. The bot will verify the code against the database. Upon success, you will receive the confirmation message: `"Account successfully linked! You can now send messages to the indiiOS relay."`

## 4. Usage & Troubleshooting

**Supported Commands:**

- Any standard text message will be routed to the indiiOS remote relay and processed by the active orchestration agent.
- `/unlink`: Severs the connection between your Telegram chat and indiiOS account. You must generate a new code to reconnect.

**Troubleshooting:**

- **No Response to /link:** Verify that the webhook URL was correctly set in Step 3.2.
- **"Invalid or expired code":** Generate a new link code from the indiiOS dashboard; codes expire after exactly 10 minutes.
- **Relay Errors:** Verify that the Cloud Functions (`telegramWebhook`, `generateTelegramLinkCode`) are deployed and active in the Firebase Console.
