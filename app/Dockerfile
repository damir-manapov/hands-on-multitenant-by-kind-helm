FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json tsconfig.json ./
COPY pnpm-lock.yaml* ./
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; else pnpm install; fi

COPY src ./src
RUN pnpm run build

FROM node:20-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json ./
COPY pnpm-lock.yaml* ./
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile --prod; else pnpm install --prod; fi

COPY --from=builder /app/dist ./dist

EXPOSE 9090

ENV PORT=9090

CMD ["node", "dist/index.js"]

