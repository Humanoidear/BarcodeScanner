FROM node:latest AS build-stage

# Copy frontend
WORKDIR /app
COPY frontend/ ./frontend

# Build frontend
WORKDIR /app/frontend
RUN npm install
RUN npm run build

# Return to root and start
WORKDIR /app

# Build and run backend
COPY backend/ ./backend
WORKDIR /app/backend
RUN npm install

EXPOSE 3000

CMD ["node", "index.js"]