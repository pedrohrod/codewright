import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "../../config/loader.js";

function generateNodeDockerfile(framework: string): string {
  return `# Build stage
FROM node:24-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:24-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist

${framework === "next" ? `COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public` : ""}

EXPOSE ${framework === "next" ? "3000" : "3000"}

USER node

CMD ${framework === "next" ? '["npm", "start"]' : framework === "express" ? '["node", "dist/index.js"]' : '["node", "dist/index.mjs"]'}
`;
}

function generatePythonDockerfile(): string {
  return `FROM python:3.14-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd --create-home appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["python", "main.py"]
`;
}

function generateGoDockerfile(): string {
  return `FROM golang:1.26-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/server .

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /app/server /server
EXPOSE 8080
USER nonroot:nonroot
CMD ["/server"]
`;
}

export function deployDockerfileCommand(cwd: string): string {
  const config = loadConfig(cwd);
  const dockerfilePath = resolve(cwd, "Dockerfile");

  if (existsSync(dockerfilePath)) {
    return `Dockerfile already exists. Delete it first to regenerate.`;
  }

  const stack = config.stack || "node";
  const framework = config.framework || "";

  let dockerfile: string;

  if (stack === "python" || config.project_language === "python") {
    dockerfile = generatePythonDockerfile();
  } else if (stack === "go" || config.project_language === "go") {
    dockerfile = generateGoDockerfile();
  } else {
    dockerfile = generateNodeDockerfile(framework);
  }

  writeFileSync(dockerfilePath, dockerfile, "utf-8");

  return `✓ Dockerfile generated.

Multi-stage build for ${stack}${framework ? ` (${framework})` : ""}.

Includes:
- Build stage with dependencies
- Production stage (minimal image)
- Exposed port configured

Next: Add a .dockerignore file to exclude node_modules.`;
}

export function deployDockerignoreCommand(cwd: string): string {
  const dockerignorePath = resolve(cwd, ".dockerignore");

  if (existsSync(dockerignorePath)) {
    return `.dockerignore already exists.`;
  }

  const content = `node_modules
dist
.codewright
.codewright-output
.git
.gitignore
.env
.env.example
*.md
`;

  writeFileSync(dockerignorePath, content, "utf-8");
  return `✓ .dockerignore generated.`;
}
