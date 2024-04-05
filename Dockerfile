# NOTE: must use --secret when building, e.g.
#
#   export NPM_TOKEN=<token>
#   docker build --secret id=NPM_TOKEN .
#
# This keeps the NPM token out of the image history
# NPM_TOKEN needs access to the @buildable organization in NPM

FROM node:16.13.0

RUN mkdir /app
WORKDIR /app

ENV NODE_ENV=production

COPY . .

RUN --mount=type=secret,id=NPM_TOKEN NPM_TOKEN=$(cat /run/secrets/NPM_TOKEN) npm install --production --legacy-peer-deps

EXPOSE 3006

CMD ["npm", "start"]
