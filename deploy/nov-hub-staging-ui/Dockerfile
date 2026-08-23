FROM node:24.15.0-alpine AS build
WORKDIR /src
COPY deploy/nov-hub-staging-ui ./deploy/nov-hub-staging-ui
COPY portal/js/auth.js ./portal/js/auth.js
RUN cd deploy/nov-hub-staging-ui && npm ci && npm run build

FROM node:24.15.0-alpine
WORKDIR /app
USER node
COPY --chown=node:node deploy/nov-hub-staging-ui/server.mjs /app/server.mjs
COPY --chown=node:node --from=build /src/deploy/nov-hub-staging-ui/dist /app/dist
ENV PORT=8080
EXPOSE 8080
CMD ["node", "/app/server.mjs"]
