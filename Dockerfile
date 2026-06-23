FROM node:24-alpine

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

COPY src/ ./src/

EXPOSE 3000

CMD ["node", "src/server.js"]
