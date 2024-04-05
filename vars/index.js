module.exports = {
  mongo: {
    memory: {
      binary: {
        path: process.env.MONGOD_BINARY_PATH,
        version: process.env.MONGOD_BINARY_VERSION,
      },
    },
  },

  buildable: {
    _id: '5d8ea3adeca6e609d5a98c2a',
  },
  pipeline: {
    sensitiveKeys: [
      'buildable',
      'connection',
      '__pipeline__',
      'ops',
      'integration',
      'actionLogic',
      'lastEvent',
      'protected',
      'buildableLastPipeline',
      'user',
      'buildableId',
      '____bldblCode',
      'req',
      'time',
      '_',
      '-',
    ],
    sensitiveKeysv2: [
      '__buildable__',
      '__steps__',
      'buildable',
      'connection',
      // "pipeline",
      'buildableId',
      '__pipeline__',
      'ops',
      'actionLogic',
      'lastEvent',
      'protected',
      'buildableLastPipeline',
      '__isValidBuildableToken',
      '__global',
      '____bldblCode',
      'req',
      // "time",
      // "_",
      // "-",
    ],
    maskKeys: [],
    buildableProtectedKeys: ['__buildable__', 'buildable', 'ops'],
  },
  errors: {
    integrations: {
      stripe: {
        noConfigFound: {
          code: 403,
          type: 'FORBIDDEN',
          error: 'No Stripe configuration found in client integration-configs.',
        },
      },
      places: {
        exists: {
          code: 403,
          type: 'FORBIDDEN',
          error: 'Place already exists.',
        },
      },
    },

    messages: {
      emailExists: { code: 422, type: 'EMAIL_EXISTS', error: 'Email exists' },
      notFound: {
        code: 404,
        type: 'NOT_FOUND',
        error:
          "Your entity can't be found. Make sure you provided a correct ID",
      },
      businessClaimed: {
        code: 404,
        type: 'BUSINESS_HAS_BEEN_CLAIMED',
        error: 'This business has been claimed.',
      },
      invalidCredentials: {
        code: 422,
        type: 'INVALID_CREDENTIALS',
        error: 'Invalid credentials',
      },
      forbidden: {
        code: 403,
        type: 'FORBIDDEN',
        error:
          'You have no privilege to do this action. You are either not the owner, or you have exceeded your credit limit.',
      },
      actionForbidden: {
        code: 403,
        type: 'FORBIDDEN',
        error:
          'You have insufficient credits to perform this action. Check the help page to learn how you can get more credits.',
      },
      notRecipient: {
        code: 403,
        type: 'FORBIDDEN',
        error: 'Engagement can only be performed by the recipient user.',
      },
    },
  },
  creditActions: {
    'create-account': 'create-account',
  },
  templateStrings: {
    fields: ['subject', 'message', 'text', 'html'],
  },
  dataTypes: {
    STRING: 'string',
    DATE: 'date',
    ARRAY: 'array',
    OBJECT: 'object',
    BOOLEAN: 'boolean',
    NUMBER: 'number',
  },
  google: {
    places: {
      key: 'AIzaSyCIX4DkX_4lALeCmy4rMjCRayYATqhq97s',
    },
  },
  MAX_CALL_STACK: 2000,
};
