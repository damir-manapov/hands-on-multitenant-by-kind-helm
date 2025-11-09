FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml* tsconfig.json ./
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

EXPOSE 3000

ENV PORT=3000

CMD ["node", "dist/main.js"]

