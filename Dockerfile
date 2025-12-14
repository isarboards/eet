FROM node:20-alpine

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

# No external dependencies; keep it simple and cache-friendly.
COPY package.json /app/package.json
COPY src /app/src
COPY public /app/public

EXPOSE 3000

# Run as non-root
USER node

CMD ["node", "src/server.js"]


