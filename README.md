<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

---

# How to Use the App s

## Base URL

Assuming the NestJS simulator is running locally:

```text
http://localhost:3000
```

open the next url for swagger doc

```text
http://localhost:3000/api
```

Replace the base URL with the host/port of your deployed simulator when needed.

---

## 1. `GET /config`

Returns the current shared simulator configuration.

### Request

```http
GET /config
```

### Example

```bash
curl http://localhost:3000/config
```

### Response

The response contains the current `EndpointConfig`, including the shared runtime defaults.

Example:

```json
{
  "success_chance": 90,
  "fast_chance": 80,
  "fast_duration_ms": 100
}
```

> The exact response fields depend on the current `EndpointConfig` implementation.

### Notes

- This configuration is shared by requests.
- Changes made with `PUT /config` take effect without restarting the application.
- Per-request query parameters can temporarily override selected values without changing the shared configuration.

---

## 2. `PUT /config`

Updates the shared runtime simulator configuration.

### Request

```http
PUT /config
Content-Type: application/json
```

### Body Parameters

| Parameter           | Type    | Range / Requirement | Description                                               |
| ------------------- | ------- | ------------------- | --------------------------------------------------------- |
| `success_chance`    | number  | `0–100`             | Probability that the HTTP response is `200`.              |
| `fast_chance`       | number  | `0–100`             | Probability that the request uses the fast latency range. |
| `fast_duration_ms`  | number  | `>= 1`              | Upper bound of the fast latency range in milliseconds.    |
| `exception_chance`  | number  | Chance value        | Probability of injecting an exception log pattern.        |
| `fatal_chance`      | number  | Chance value        | Probability of injecting a fatal log pattern.             |
| `oom_chance`        | number  | Chance value        | Probability of injecting an OOM log pattern.              |
| `conn_error_chance` | number  | Chance value        | Probability of injecting a connection-error log pattern.  |
| `storm_flag`        | boolean | `true/false`        | Enables the storm log-noise behavior.                     |

> The log-noise fields are read from the stored configuration when present. If they are absent, their values fall back to `DEFAULT_LOG_NOISE_CONFIG`.

### Example

```bash
curl -X PUT http://localhost:3000/config \
  -H "Content-Type: application/json" \
  -d '{
    "success_chance": 100,
    "fast_chance": 80,
    "fast_duration_ms": 100,
    "exception_chance": 0,
    "fatal_chance": 0,
    "oom_chance": 0,
    "conn_error_chance": 0,
    "storm_flag": false
  }'
```

### Trigger a High HTTP Error Rate

To intentionally make all requests fail:

```bash
curl -X PUT http://localhost:3000/config \
  -H "Content-Type: application/json" \
  -d '{
    "success_chance": 0
  }'
```

With `success_chance = 0`, every simulated request gets one of these failure statuses:

```text
400
504
```

This can be used to trigger the `CompassHighErrorRate` alert when the Prometheus rule threshold is reached.

---

## 3. `GET /ping/:id/status`

Simulates a request and returns either `200`, `400`, or `504`.

### Request

```http
GET /ping/:id/status
```

### Path Parameters

| Parameter | Type   | Description                                                                   |
| --------- | ------ | ----------------------------------------------------------------------------- |
| `id`      | string | Identifier included in the URL. It is not used by the simulator logic itself. |

### Example

```bash
curl http://localhost:3000/ping/123/status
```

### Response

```json
{
  "response": "pong"
}
```

The HTTP status can be:

```text
200
400
504
```

---

## 4. `GET /ping/:id/info`

This endpoint behaves the same way as `/ping/:id/status`.

### Request

```http
GET /ping/:id/info
```

### Path Parameters

| Parameter | Type   | Description                     |
| --------- | ------ | ------------------------------- |
| `id`      | string | Identifier included in the URL. |

### Example

```bash
curl http://localhost:3000/ping/123/info
```

---

# 5. Query Parameters

Both `/ping/:id/status` and `/ping/:id/info` support per-request configuration overrides.

These overrides affect **only the current request** and do **not** modify the shared configuration.

## HTTP Response / Latency Parameters

| Parameter          | Type    | Valid Values | Description                                                                          |
| ------------------ | ------- | ------------ | ------------------------------------------------------------------------------------ |
| `success_chance`   | integer | `0–100`      | Probability of returning HTTP `200`. Otherwise the simulator returns `400` or `504`. |
| `fast_chance`      | integer | `0–100`      | Probability that the request uses the fast latency range.                            |
| `fast_duration_ms` | integer | `>= 1`       | Maximum latency of the fast path in milliseconds.                                    |

---

### `success_chance`

Controls the probability of receiving a successful HTTP response.

#### Force a failure

```bash
curl "http://localhost:3000/ping/1/status?success_chance=0"
```

This forces the request to return a failure status.

#### Force a successful response

```bash
curl "http://localhost:3000/ping/1/status?success_chance=100"
```

---

### `fast_chance`

Controls whether the request uses the fast latency range.

#### Force the fast path

```bash
curl "http://localhost:3000/ping/1/status?fast_chance=100"
```

#### Disable the fast path

```bash
curl "http://localhost:3000/ping/1/status?fast_chance=0"
```

---

### `fast_duration_ms`

Controls the boundary of the latency range.

If `fast_chance` selects the fast path:

```text
1ms → fast_duration_ms
```

Otherwise:

```text
fast_duration_ms + 1ms → 1000ms
```

#### Example

```bash
curl "http://localhost:3000/ping/1/status?fast_chance=100&fast_duration_ms=500"
```

This produces a random latency between approximately:

```text
1ms and 500ms
```

---

# 6. Log-Noise Query Parameters

The ping endpoints also support parameters that independently inject log patterns into Loki.

These parameters **do not directly determine the HTTP status**.

Therefore, a request can return:

```text
HTTP 200
```

while still generating an:

- Exception log
- Fatal log
- OOM log
- Connection-error log

This independence is useful for testing Compass log-based detection and generating training data.

## Parameters

| Parameter           | Type    | Description                                              |
| ------------------- | ------- | -------------------------------------------------------- |
| `exception_chance`  | number  | Probability of injecting an exception log pattern.       |
| `fatal_chance`      | number  | Probability of injecting a fatal log pattern.            |
| `oom_chance`        | number  | Probability of injecting an OOM log pattern.             |
| `conn_error_chance` | number  | Probability of injecting a connection-error log pattern. |
| `storm_flag`        | boolean | Enables the storm behavior.                              |

Chance parameters are parsed using `parseChanceOrNull`, so their exact accepted format/range is defined by that helper.

For normal usage, use percentages such as:

```text
0
25
50
100
```

---

## 7. Trigger an Exception Log

Force exception log generation for one request:

```bash
curl "http://localhost:3000/ping/1/status?exception_chance=100"
```

The shared configuration is not changed.

---

## 8. Trigger a Fatal Log

```bash
curl "http://localhost:3000/ping/1/status?fatal_chance=100"
```

This forces the fatal log pattern for that request.

---

## 9. Trigger an OOM Log

```bash
curl "http://localhost:3000/ping/1/status?oom_chance=100"
```

This forces the OOM-related log pattern for that request.

---

## 10. Trigger a Connection Error Log

```bash
curl "http://localhost:3000/ping/1/status?conn_error_chance=100"
```

This forces the connection-error log pattern for that request.

---

## 11. Trigger Storm Behavior

```bash
curl "http://localhost:3000/ping/1/status?storm_flag=true"
```

You can also use:

```bash
curl "http://localhost:3000/ping/1/status?storm_flag=1"
```

The accepted boolean forms depend on the implementation of `parseBoolOrNull`.

---

## Quick Reference

### Endpoints

| Method | Endpoint           | Purpose                               |
| ------ | ------------------ | ------------------------------------- |
| `GET`  | `/config`          | Read shared simulator configuration   |
| `PUT`  | `/config`          | Update shared simulator configuration |
| `GET`  | `/ping/:id/status` | Simulate a request                    |
| `GET`  | `/ping/:id/info`   | Simulate a request                    |

### Query Parameters

```text
success_chance
fast_chance
fast_duration_ms
exception_chance
fatal_chance
oom_chance
conn_error_chance
storm_flag
```

### Most Useful Demo Commands

```bash
# Force HTTP failures
curl "http://localhost:3000/ping/1/status?success_chance=0"

# Force exception logs
curl "http://localhost:3000/ping/1/status?exception_chance=100"

# Force OOM logs
curl "http://localhost:3000/ping/1/status?oom_chance=100"

# Force connection-error logs
curl "http://localhost:3000/ping/1/status?conn_error_chance=100"

# Successful HTTP response + exception log
curl "http://localhost:3000/ping/1/status?success_chance=100&exception_chance=100"

# Force slow path
curl "http://localhost:3000/ping/1/status?fast_chance=0"
```
