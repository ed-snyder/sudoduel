FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for TypeScript build)
RUN npm ci

# Copy backend files
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Remove dev dependencies after build to reduce image size
RUN npm prune --production

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["npm", "run", "start"]
