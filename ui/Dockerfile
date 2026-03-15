# Stage 1 — build React app
# Context is the project root so nginx.conf is accessible.
FROM node:22-alpine AS build

WORKDIR /app
COPY ui/package*.json ./
RUN npm ci
COPY ui/ .
RUN npm run build

# Stage 2 — serve with nginx
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
