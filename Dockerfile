FROM node:18.20.3 AS builder

# Create app directory
WORKDIR /app

# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# Install app dependencies
RUN npm install -g pnpm
RUN pnpm install

COPY . .

# Generate Prisma client using the Prisma CLI.
RUN npx prisma generate
RUN pnpm run build

EXPOSE 3000
CMD [ "pnpm", "run", "start:prod" ]