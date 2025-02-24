# Callgent API

<p align="center">
    <a href="https://callgent.com" target="_blank">
        <img alt="Static Badge" src="https://img.shields.io/badge/COM-COM?logo=COM&logoColor=%20%23f5f5f5&label=Callgent&labelColor=%20%23155EEF&color=%23EAECF0"></a>
    <a href="https://discord.gg/V9HKBukSRp" target="_blank">
        <img src="https://img.shields.io/discord/1215998670265127102?logo=discord"
            alt="chat on Discord"></a>
    <a href="https://twitter.com/intent/follow?screen_name=callgent_com" target="_blank">
        <img src="https://img.shields.io/twitter/follow/callgent_com?style=social&logo=X"
            alt="follow on Twitter"></a>
    <!-- <a href="https://hub.docker.com/u/langgenius" target="_blank">
        <img alt="Docker Pulls" src="https://img.shields.io/docker/pulls/langgenius/dify-web"></a> -->
<a href="https://app.snyk.io/test/github/Callgent/callgent-api" alt="FOSSA Status"><img src="https://snyk.io/test/github/Callgent/callgent-api/badge.svg"/></a>
<a href="https://app.fossa.com/projects/git%2Bgithub.com%2FCallgent%2Fcallgent-api?ref=badge_shield&issueType=license" alt="FOSSA Status"><img src="https://app.fossa.com/api/projects/git%2Bgithub.com%2FCallgent%2Fcallgent-api.svg?type=shield&issueType=license"/></a>
<a href="https://github.com/Callgent/callgent-api/issues">
<img src="https://img.shields.io/github/issues/Callgent/callgent-api.svg" alt="GitHub issues" /></a>
<a href="https://github.com/Callgent/callgent-api/pulls">
<img src="https://img.shields.io/github/issues-pr/Callgent/callgent-api.svg" alt="GitHub pull requests" /></a>
<img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" height="20px">
</p>

*Please, help our community project. Star on GitHub!*
**Exciting News (November, 2024):** Discover what is new in Callgent [here](https://docs.callgent.com/blog)!

Callgent API is an open-source SaaS project built using NestJS, Prisma, PostgreSQL, and Swagger. It is licensed under the Apache-2.0 License.

## Table of Contents

- [Callgent API](#callgent-api)
  - [Table of Contents](#table-of-contents)
  - [Introduction](#introduction)
  - [Features](#features)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
  - [Running the Application](#running-the-application)
    - [Running from docker-compose](#running-from-docker-compose)
  - [API Documentation](#api-documentation)
  - [Testing](#testing)
  - [Contributing](#contributing)
  - [License](#license)

## Introduction

Callgent API is a powerful, scalable, and extensible platform designed to help developers create, manage, and deploy bots across various channels. It provides a robust set of features, enabling seamless integration with popular messaging platforms and services.

## Features

- User authentication and authorization
- Bot creation and management
- Channel integration (Slack, Facebook Messenger, Telegram, etc.)
- Webhook management
- Conversation history and analytics
- Extensible plugin architecture

## Prerequisites

Before you start using Callgent API, ensure you have the following tools installed:

- Node.js (>= 18.0.0)
- npm (>= 6.0.0)
- PostgreSQL (>= 10.0.0)
- Docker (optional, for local development)

## Installation

1. Clone the repository:

   ```shell
   git clone https://github.com/Callgent/callgent-api.git
   cd callgent-api
   ```

2. Install the dependencies:

   ```shell
   pnpm install
   ```

## Configuration

Create a `.env` file in the project root directory based on the `.env.dev` file provided. Update the configuration values according to your environment.

## Running the Application

1. Run the Prisma migration to set up the database schema:

   ```shell
   npx prisma migrate deploy
   ```

2. Start the application:

   ```shell
   npm run start:dev
   ```

The application will be available at `http://localhost:3000`.

### Running from docker-compose

1. Run the following command from project root, to start the containers:

   ```shell
   docker-compose up -d
   ```

2. Initialize the database:

   ```shell
   cp .env.dev .env
   echo 'DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}?schema=public&timezone=UTC' >> .env
   npx prisma db seed
   ```

3. Initialize the test data (optional):

   ```shell
   pnpm run prisma:seed-test
   ```

The application will be available at `http://localhost:3003`.

## API Documentation

Swagger documentation is available at `http://localhost:3000/docs/docs/api`.

## Testing

To run the tests, use the following command:

```
npm run test
```

## Contributing

We welcome contributions from the community! Before submitting a pull request, please review our [Contributor Development Agreement (CDO)](CONTRIBUTING.md).

## License

Callgent.com is licensed under the Apache-2.0 License. See the [LICENSE](LICENSE) file for more information.

---

For more information, please visit our [documentation](https://docs.callgent.com/) or join our [community](https://callgent.com/discord).
