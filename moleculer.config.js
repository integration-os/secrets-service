'use strict';
require('dotenv').config();

module.exports = {
  namespace: 'buildable-client',
  //transporter: "TCP",
  logger: true,
  logLevel: 'info',
  cacher: {
    type: 'MemoryLRU',
    options: {
      max: 50000,
      ttl: 345600,
    },
  },
  metrics: false,
  validator: true,
};
