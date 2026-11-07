FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN node scripts/build-standalone.mjs

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DB_PATH=/app/data/workshop.sqlite
COPY --from=build /app/server-dist ./server-dist
RUN mkdir /app/data && chown node:node /app/data
USER node
EXPOSE 3000
CMD ["node","server-dist/server.mjs"]
