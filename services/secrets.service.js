require('dotenv').config();

const core = require('../mixins/core.mixin');
const DbService = require('../mixins/db.mixin');
const uuid = require('uuid');
const crc32c = require('sse4_crc32');
const { withContext } = require('@buildable/tools');
const get = require('lodash/get');
const { MoleculerClientError } = require('moleculer').Errors;

// Imports the Cloud KMS library
const { KeyManagementServiceClient } = require('@google-cloud/kms');
const omit = require('lodash/omit');

class EntityNotFoundError extends MoleculerClientError {
  constructor(id) {
    super('Entity not found', 404, null, { id });
  }
}

const serviceConfigs = {
  name: 'secrets',
  module: 'secrets',
  version: 1,
  businessSettings: {},
};

const TYPES = {
  ACTIONS: {
    CLUSTERS: {
      GET: `v${serviceConfigs.version}.${serviceConfigs.name}.get`,
      FIND: `v${serviceConfigs.version}.${serviceConfigs.name}.find`,
      LIST: `v${serviceConfigs.version}.${serviceConfigs.name}.list`,
      COUNT: `v${serviceConfigs.version}.${serviceConfigs.name}.count`,
      CREATE: `v${serviceConfigs.version}.${serviceConfigs.name}.create`,
      INSERT: `v${serviceConfigs.version}.${serviceConfigs.name}.insert`,
      UPDATE: `v${serviceConfigs.version}.${serviceConfigs.name}.update`,
      REMOVE: `v${serviceConfigs.version}.${serviceConfigs.name}.remove`,
    },
  },
  ERRORS: {
    CRUD_ENTITY_NOT_FOUND: 'crud-entity-not-found',
    CRUD_ACTION_NOT_FOUND: 'crud-action-not-found',
    CRUD_UNIQUE_INDEX_VIOLATION: 'crud-unique-index-violation',
    UNRECOGNIZED_PIPELINE_STAGE:
      'services-aggregate-unrecognized-pipeline-stage',
    AGGREGATE_MONGO_ERROR: 'services-aggregate-mongo-error',
    UPDATE_WITH_QUERY_MONGO_ERROR: 'services-update-with-query-mongo-error',
  },
};

const coreMixinArgs = {
  service: serviceConfigs.name,
  module: serviceConfigs.module,
  getAction: TYPES.ACTIONS.CLUSTERS.GET,
};

const projectId = process.env.PROJECT_ID;
const locationId = process.env.LOCATION_ID;
const keyRingId = process.env.KEY_RING_ID;
const keyId = process.env.KEY_ID;

module.exports = {
  name: serviceConfigs.name,

  version: serviceConfigs.version,

  mixins: [DbService(serviceConfigs.name), core(coreMixinArgs)],

  settings: {},

  hooks: {},

  actions: {
    create: {
      cache: {
        enabled: false,
      },
      params: {
        secret: {
          type: 'string',
        },
        buildableId: {
          type: 'string',
        },
      },
      async handler(ctx) {
        const { secret, ...rest } = ctx.params;

        const encryptedSecret = await this.encryptSymmetric({
          secret,
          projectId,
          locationId,
          keyRingId,
          keyId,
        });

        return await this.adapter.insert({
          ...rest,
          _id: uuid.v4(),
          encryptedSecret: encryptedSecret.toString('base64'),
        });
      },
    },
    get: {
      cache: {
        enabled: true,
        keys: ['id', 'buildableId'],
      },
      params: {
        id: {
          type: 'string',
        },
        buildableId: {
          type: 'string',
        },
      },
      async handler(ctx) {
        const { id } = ctx.params;

        const useAction = withContext(ctx);
        const listSecrets = useAction({
          service: serviceConfigs.name,
          action: 'list',
          version: serviceConfigs.version,
        });

        const listResult = await listSecrets({ query: { _id: id } });
        const result = get(listResult, 'rows.0');

        if (!result) {
          throw new EntityNotFoundError(id);
        }

        const decryptedSecret = await this.decryptSymmetric({
          ciphertext: result.encryptedSecret,
          projectId,
          locationId,
          keyRingId,
          keyId,
        });

        return {
          ...omit(result, ['encryptedSecret']),
          secret: decryptedSecret,
        };
      },
    },
  },

  methods: {
    async encryptSymmetric({
      secret,
      projectId,
      locationId,
      keyRingId,
      keyId,
    }) {
      // Instantiates a client
      const client = new KeyManagementServiceClient();

      // Build the key name
      const keyName = client.cryptoKeyPath(
        projectId,
        locationId,
        keyRingId,
        keyId,
      );

      const plaintextBuffer = Buffer.from(secret);

      // Optional, but recommended: compute plaintext's CRC32C.
      const plaintextCrc32c = crc32c.calculate(plaintextBuffer);

      const [encryptResponse] = await client.encrypt({
        name: keyName,
        plaintext: plaintextBuffer,
        plaintextCrc32c: {
          value: plaintextCrc32c,
        },
      });

      const ciphertext = encryptResponse.ciphertext;

      // Optional, but recommended: perform integrity verification on encryptResponse.
      // For more details on ensuring E2E in-transit integrity to and from Cloud KMS visit:
      // https://cloud.google.com/kms/docs/data-integrity-guidelines
      if (!encryptResponse.verifiedPlaintextCrc32c) {
        throw new Error('Encrypt: request corrupted in-transit');
      }
      if (
        crc32c.calculate(ciphertext) !==
        Number(encryptResponse.ciphertextCrc32c.value)
      ) {
        throw new Error('Encrypt: response corrupted in-transit');
      }

      return ciphertext;
    },
    async decryptSymmetric({
      ciphertext,
      projectId,
      locationId,
      keyRingId,
      keyId,
    }) {
      // Instantiates a client
      const client = new KeyManagementServiceClient();

      // Build the key name
      const keyName = client.cryptoKeyPath(
        projectId,
        locationId,
        keyRingId,
        keyId,
      );

      const [decryptResponse] = await client.decrypt({
        name: keyName,
        ciphertext,
      });

      return decryptResponse.plaintext.toString();
    },
  },

  events: {},
};
