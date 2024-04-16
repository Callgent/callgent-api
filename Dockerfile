FROM node:18.20.1 AS builder

# Create app directory
WORKDIR /app

# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./
COPY prisma ./prisma/

RUN npm install -g pnpm
# Install app dependencies
RUN pnpm install

COPY . .

RUN pnpm run build
RUN npx prisma generate

FROM node:18.20.1
RUN npm install -g pnpm

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD [ "pnpm", "run", "start:prod" ]