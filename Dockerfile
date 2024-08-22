FROM node:18.19.1 AS builder

# Create app directory
WORKDIR /app

# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./
COPY pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install app dependencies
RUN npm install -g pnpm
RUN pnpm install

COPY . .

# Generate Prisma client using the Prisma CLI.
RUN npx prisma generate
RUN pnpm build

FROM node:18.19.1
RUN npm install -g pnpm

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD /bin/bash -c "npx prisma migrate deploy && pnpm start:prod"
