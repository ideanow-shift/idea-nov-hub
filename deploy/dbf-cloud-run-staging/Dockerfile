FROM node:24.15.0-alpine AS build
WORKDIR /src
COPY portal ./portal
COPY deploy/dbf-staging ./deploy/dbf-staging
COPY tools/build-dbf-staging-pages.mjs ./tools/build-dbf-staging-pages.mjs
RUN node tools/build-dbf-staging-pages.mjs

FROM nginxinc/nginx-unprivileged:1.27.5-alpine
COPY deploy/dbf-cloud-run-staging/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/build/dbf-staging-pages /usr/share/nginx/html
EXPOSE 8080
