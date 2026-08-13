FROM node:24.15.0-alpine AS build
WORKDIR /src
COPY portal ./portal
COPY deploy/dbf-staging ./deploy/dbf-staging
COPY tools/build-dbf-staging-pages.mjs ./tools/build-dbf-staging-pages.mjs
COPY deploy/dbf-cloud-run-staging-bff-candidate/canonical-navigation.js ./deploy/dbf-cloud-run-staging-bff-candidate/canonical-navigation.js
RUN node tools/build-dbf-staging-pages.mjs

FROM node:24.15.0-alpine
WORKDIR /app
USER node
COPY --chown=node:node deploy/dbf-cloud-run-staging-bff-candidate/*.mjs /app/
COPY --chown=node:node --from=build /src/build/dbf-staging-pages /app/static
ENV PORT=8080
ENV STATIC_ROOT=/app/static
EXPOSE 8080
CMD ["node", "/app/main.mjs"]
