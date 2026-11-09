# Build context: repository root.
#   docker build -f frontend/Dockerfile .
FROM node:24-alpine AS build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
COPY themes/ /app/themes/
RUN npm run build

FROM nginxinc/nginx-unprivileged:1-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 8080
