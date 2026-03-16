FROM node:20-slim

WORKDIR /app

# Install backend deps (including dev for tsc)
COPY backend/package*.json backend/
RUN cd backend && npm ci

# Install frontend deps and build
COPY frontend/package*.json frontend/
RUN cd frontend && npm ci
COPY frontend/ frontend/
RUN cd frontend && npm run build

# Copy backend source and build
COPY backend/ backend/
RUN cd backend && npx tsc

# Prune dev deps
RUN cd backend && npm prune --omit=dev

# Data directory
RUN mkdir -p /data/uploads/thumbnails
ENV DATA_DIR=/data
ENV UPLOAD_DIR=/data/uploads
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "backend/dist/server.js"]
