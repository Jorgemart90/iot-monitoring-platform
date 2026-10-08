FROM node:24-alpine AS build
WORKDIR /app
COPY apps/frontend/package*.json ./
RUN npm ci
COPY apps/frontend/ ./
RUN npm run build
FROM node:24-alpine
WORKDIR /usr/src/app
COPY apps/frontend/package*.json ./
RUN npm ci --omit=dev
COPY apps/frontend/server.cjs ./server.cjs
COPY --from=build /app/dist/pulse/browser ./public
USER node
EXPOSE 5173
CMD ["node", "server.cjs"]
