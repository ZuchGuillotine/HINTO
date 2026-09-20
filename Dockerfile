FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/domain/package.json packages/domain/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/prompts/package.json packages/prompts/package.json
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY tsconfig.json ./
COPY services/api/tsconfig.json services/api/tsconfig.json
COPY services/api/src services/api/src
COPY packages packages
RUN npm run api:build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV API_HOST=0.0.0.0
ENV API_PORT=3000
WORKDIR /app

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/services/api/dist services/api/dist
COPY --from=build /app/packages/prompts packages/prompts

EXPOSE 3000
CMD ["node", "services/api/dist/server.js"]
