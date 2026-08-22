FROM node:24.15.0-alpine AS build
WORKDIR /src
COPY deploy/store-operations-staging-ui/package*.json ./deploy/store-operations-staging-ui/
RUN cd deploy/store-operations-staging-ui && npm ci
COPY portal/store-sales ./portal/store-sales
COPY portal/css/design-system.css ./portal/css/design-system.css
COPY portal/js/nov-hub-session-candidate.js ./portal/js/nov-hub-session-candidate.js
COPY deploy/store-operations-staging-ui ./deploy/store-operations-staging-ui
RUN cd deploy/store-operations-staging-ui && npm run build

FROM node:24.15.0-alpine
WORKDIR /app
USER node
COPY --chown=node:node deploy/store-operations-staging-ui/server.mjs /app/server.mjs
COPY --chown=node:node --from=build /src/deploy/store-operations-staging-ui/dist /app/dist
ENV PORT=8080
EXPOSE 8080
CMD ["node", "/app/server.mjs"]
