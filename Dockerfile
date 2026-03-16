FROM node:20-slim

WORKDIR /app

# Install backend deps
COPY backend/package*.json backend/
RUN cd backend && npm ci --omit=dev

# Install frontend deps and build
COPY frontend/package*.json frontend/
RUN cd frontend && npm ci
COPY frontend/ frontend/
RUN cd frontend && npm run build

# Copy backend source and build
COPY backend/ backend/
RUN cd backend && npx tsc

# Data directory
RUN mkdir -p /data/uploads/thumbnails
ENV DATA_DIR=/data
ENV UPLOAD_DIR=/data/uploads
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "backend/dist/server.js"]
