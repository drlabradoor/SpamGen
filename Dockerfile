# bothost.ru Pro: 4 vCPU / 2 GB RAM / 15 GB SSD, custom Dockerfile supported.
# Chromium comes from apt rather than Playwright, so the image stays small and
# there is no npm install step at all — the project has zero dependencies.
FROM node:22-slim

# fonts-noto-core only catches what SF Pro lacks (styled Unicode, rare symbols);
# without any fallback font Linux would draw those as empty boxes.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fontconfig \
      fonts-noto-core \
      ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# The SF Pro faces and Apple emoji ship inside assets/ — never taken from the
# host, otherwise Linux would silently substitute fonts and the render would drift.
ENV SPAMGEN_CHROME=/usr/bin/chromium
ENV NODE_ENV=production

# bothost bind-mounts the sources over /app at start and keeps only /app/data
# between deploys. Everything the bot adds at runtime (avatar bank, status
# emoji) therefore lives there; start.sh seeds it from assets/ on first run.
ENV SPAMGEN_BANK=/app/data/bank
ENV SPAMGEN_STATUS=/app/data/status

WORKDIR /app
COPY . .

# One browser at a time; src/render.js serialises renders so 2 GB is enough.
CMD ["sh", "start.sh"]
