# ---------- Build stage ----------
FROM dhi.io/node:26-alpine-dev AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build NestJS application
RUN npm run build


# ---------- Production stage ----------
FROM dhi.io/node:26-alpine-dev AS production

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled application
COPY --from=builder /app/dist ./dist

# NestJS default port
EXPOSE 3000

# Start application
CMD ["node", "dist/main.js"]