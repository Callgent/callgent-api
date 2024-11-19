FROM node:18.20.5 AS builder

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

FROM node:18.20.5
RUN npm install -g pnpm

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist
COPY .env.dev ./

EXPOSE 3000
CMD /bin/bash -c 'if [ -n "$DATABASE_URL" ]; then echo "" >> .env; echo "DATABASE_URL=$DATABASE_URL" >> .env; fi ; npx prisma migrate deploy && pnpm start:prod'
