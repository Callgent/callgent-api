# Botlet API

Botlet API is an open-source SaaS project built using NestJS, Prisma, PostgreSQL, and Swagger. It is licensed under the Apache-2.0 License and based on the Contributor Development Agreement (CDO).

## Table of Contents

- [Botlet API](#botlet-api)
  - [Table of Contents](#table-of-contents)
  - [Introduction](#introduction)
  - [Features](#features)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
  - [Running the Application](#running-the-application)
  - [API Documentation](#api-documentation)
  - [Testing](#testing)
  - [Contributing](#contributing)
  - [License](#license)

## Introduction

Botlet API is a powerful, scalable, and extensible platform designed to help developers create, manage, and deploy bots across various channels. It provides a robust set of features, enabling seamless integration with popular messaging platforms and services.

## Features

- User authentication and authorization
- Bot creation and management
- Channel integration (Slack, Facebook Messenger, Telegram, etc.)
- Webhook management
- Conversation history and analytics
- Extensible plugin architecture

## Prerequisites

Before you start using Botlet API, ensure you have the following tools installed:

- Node.js (>= 14.0.0)
- npm (>= 6.0.0)
- PostgreSQL (>= 10.0.0)
- Docker (optional, for local development)

## Installation

1. Clone the repository:

   ```
   git clone https://github.com/botlet-io/botlet-api.git
   ```

2. Change to the project directory:

   ```
   cd botlet-api
   ```

3. Install the dependencies:

   ```
   npm install
   ```

## Configuration

Create a `.env` file in the project root directory based on the `.env.example` file provided. Update the configuration values according to your environment.

## Running the Application

1. Run the Prisma migration to set up the database schema:

   ```
   npx prisma migrate dev --name init
   ```

2. Start the application:

   ```
   npm run start:dev
   ```

The application will be available at `http://localhost:3000`.

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

Botlet.IO is licensed under the Apache-2.0 License. See the [LICENSE](LICENSE) file for more information.

---

For more information, please visit our [documentation](https://botlet.io/docs) or join our [community](https://botlet.io/community).
