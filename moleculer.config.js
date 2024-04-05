'use strict';
require('dotenv').config();

module.exports = {
  namespace: 'buildable-client',
  //transporter: "TCP",
  logger: true,
  logLevel: 'info',
  cacher: {
    type: 'Memory',
    options: {
      ttl: 432000,
      clone: true,
    },
  },
  metrics: false,
  validator: true,
};
