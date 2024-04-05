const jwt = require('jsonwebtoken');
const startsWith = require('lodash/startsWith');
const { MoleculerClientError } = require('moleculer').Errors;

const NO_BUILDABLE_TOKEN_ERROR = new MoleculerClientError(
  'No Buildable Token Found',
  403,
  'Forbidden',
);

const UNAUTHORIZED_ERROR = new MoleculerClientError(
  'Invalid Buildable Authorization',
  403,
  'Forbidden',
);

/**
 * Get the buildable authorization token from a request object
 *
 * @param {object} request Moleculer/Node request object
 * @returns {object} With the auth type as key, token as value
 */
const getToken = (request) => {
  const { headers } = request;

  const buildableAuth = headers['buildable-authorization'];

  if (headers && buildableAuth) {
    const authType = startsWith(buildableAuth, 'Basic ') ? 'basic' : 'bearer';
    if (authType === 'basic') {
      return buildableAuth.slice(6);
    } else {
      return buildableAuth.slice(7);
    }
  }
  return null;
};

/**
 * Verify that the token is valid and return its payload
 *
 * @param {String} token Users bearer token
 *
 * @returns {Object} Users data / token payload
 */
const verifyToken = function (token) {
  return jwt.verify(token, process.env.BUILDABLE_SECRET, (error, payload) => {
    if (error) {
      return Promise.reject(UNAUTHORIZED_ERROR);
    }
    return payload;
  });
};

/**
 * Handles the buildable token authorization
 *
 * @param {Object} headers Request headers
 */
const handleBuildableAuthorization = (request) => {
  const buildableToken = getToken(request);

  if (buildableToken) {
    const buildableObject = verifyToken(buildableToken);
    // utils.manageCreditLogs(request, buildableObject);

    if (buildableObject._id) {
      return {
        verified: true,
        buildableObject,
      };
    }

    return {
      verified: false,
      error: UNAUTHORIZED_ERROR,
    };
  }

  return {
    verified: false,
    error: NO_BUILDABLE_TOKEN_ERROR,
  };
};

module.exports = () => {
  return {
    mixins: [],
    methods: {
      buildable: () => {
        return {
          handleBuildableAuthorization,
        };
      },
    },
  };
};
