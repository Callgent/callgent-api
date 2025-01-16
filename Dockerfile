# using criu to checkpoint and restore a running sub-process
FROM node:18.20.3 AS base

RUN apt-get update && apt-get install -y --no-install-recommends criu \
    && apt-get clean && rm -rf /var/lib/apt/lists/*
RUN criu --version
# https://chatgpt.com/share/6788670a-a904-8005-803a-0e9fcb01279b
# RUN criu check

RUN npm install -g pnpm

FROM base AS builder

# Create app directory
WORKDIR /app
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./
COPY pnpm-lock.yaml ./
RUN pnpm install

COPY prisma ./prisma/
COPY . .

RUN npx prisma generate
RUN pnpm build

FROM base

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist
COPY .env.dev ./.env

EXPOSE 3000
CMD /bin/bash -c 'npx prisma migrate deploy && pnpm start:prod'
