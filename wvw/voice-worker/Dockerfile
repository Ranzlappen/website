# Optional WvW Hub voice worker. Dependency-free; Node 22 ships WebSocket.
# Cloud Run: gcloud run deploy wvw-voice-worker --source wvw/voice-worker \
#   --region europe-west1 --min-instances 1 --max-instances 1 --no-cpu-throttling \
#   --set-env-vars VOICE_ENDPOINT=https://us-central1-proven-concept-436717-q3.cloudfunctions.net/wvw-voiceSamples \
#   --set-secrets DISCORD_BOT_TOKEN=WVW_DISCORD_BOT_TOKEN:latest,VOICE_SECRET=WVW_VOICE_SECRET:latest
FROM node:22-alpine
WORKDIR /app
COPY package.json state.mjs index.mjs ./
USER node
CMD ["node", "index.mjs"]
