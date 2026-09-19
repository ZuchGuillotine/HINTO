# syntax=docker/dockerfile:1
# Build from the repository root:
#   docker build -f services/api/Dockerfile -t hinto-api .

FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY services/api/package.json services/api/package.json
COPY packages/prompts/package.json packages/prompts/package.json
# The root manifest is still the legacy Expo app; install only what the
# workspaces need so the image does not pull the React Native tree.
RUN npm install --no-audit --no-fund --ignore-scripts \
      --workspace services/api --workspace packages/prompts \
      typescript@^5 @types/node@^22
COPY packages/prompts packages/prompts
COPY services/api services/api
RUN npx tsc -b services/api/tsconfig.json

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/prompts/package.json ./packages/prompts/package.json
COPY --from=build /repo/packages/prompts/dist ./packages/prompts/dist
COPY --from=build /repo/services/api/package.json ./services/api/package.json
COPY --from=build /repo/services/api/dist ./services/api/dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:${PORT:-3000}/health || exit 1
CMD ["node", "services/api/dist/server.js"]
