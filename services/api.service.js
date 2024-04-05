'use strict';
const ApiGateway = require('moleculer-web');
const get = require('lodash/get');

module.exports = {
  name: 'api',
  mixins: [ApiGateway],

  settings: {
    port: process.env.PORT || 3006,
    routes: [
      {
        path: '/',

        authorization: false,
        cors: {
          origin: '*',
          methods: ['GET', 'OPTIONS', 'POST'],
          credentials: false,
        },

        bodyParsers: {
          json: true,
          urlencoded: {
            extended: true,
          },
        },
        // authorization: true,
        whitelist: ['v1.secrets.*'],
        onBeforeCall(ctx, route, req, res) {
          const buildableId =
            get(req, 'body.buildableId') || get(req, '$params.buildableId');

          ctx.meta.buildable = {
            _id: buildableId,
            buildableId,
          };
        },
      },
    ],

    assets: {
      folder: './public',
    },

    // logRequestParams: "info",
    // logResponseData: "info",
  },

  methods: {},
};
