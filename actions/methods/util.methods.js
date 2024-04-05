const vars = require('../../vars');
const { MoleculerClientError, MoleculerServerError } =
  require('moleculer').Errors;
const slugify = require('slugify');
require('dotenv').config();
const get = require('lodash/get');
const set = require('lodash/set');
const { ensureUserHasNeededCredits } = require('./users.methods');
// const { getError, useError } = require('@buildable/errors');

const getError = async ({code}) => {
	return `Error: ${code}`;
};

const useError = ({ error, templateArgs = {}, input = {}, meta = {} }) => {
  return new Error(error);
};

const { errors } = vars;
const { messages } = errors;

const TYPES = {
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

// const redisClient = redis.createClient(process.env.REDIS_PORT, process.env.REDIS_HOST);

const addBuildableToQuery = (ctx) => {
  return (ctx.params.query = {
    ...ctx.params.query,
    buildableId: ctx.meta.buildable
      ? ctx.meta.buildable.buildableId
      : vars.buildable._id,
  });
};

const addBuildableOrGlobalBuildableToQuery = (ctx) => {
  const { buildable } = ctx.meta;
  if (buildable && buildable.__global) {
    return (ctx.params.query = {
      ...ctx.params.query,
      buildableId: ctx.meta.buildable.pipelineBuildableId,
    });
  }
  return (ctx.params.query = {
    ...ctx.params.query,
    buildableId: ctx.meta.buildable
      ? ctx.meta.buildable.buildableId
      : vars.buildable._id,
  });
};

const addBuildableIdToParams = (ctx) =>
  (ctx.params = {
    ...ctx.params,
    buildableId: ctx.meta.buildable
      ? ctx.meta.buildable._id
      : vars.buildable._id,
  });

const addBuildableIdToEntities = (ctx) => {
  ctx.params.entities = ctx.params.entities.map((entity) => ({
    ...entity,
    buildableId: ctx.meta.buildable
      ? ctx.meta.buildable._id
      : vars.buildable._id,
  }));
};

const addOnlyOwnedToQuery = (ctx) =>
  (ctx.params.query = {
    ...ctx.params.query,
    'author._id': ctx.meta.user._id,
  });
const loggerPlay = (ctx) => console.log(); //console.log(ctx, "<<<<< From loggerPlay");
const addOnlyOwnedOrAdminToQuery = (ctx) => {
  console.log(ctx.meta);
  console.log(ctx.params);
  ctx.params.query =
    ctx.meta.user.role && ctx.meta.user.role === 'admin'
      ? {
          ...ctx.params.query,
        }
      : {
          ...ctx.params.query,
          'author._id': ctx.meta.user._id,
        };
};
const addOnlyRecipientOrSenderToQuery = (ctx) => {
  ctx.params.query = {
    ...ctx.params.query,
    $or: [
      {
        'author._id': ctx.meta.user._id,
      },
      {
        senderId: ctx.meta.user._id,
      },
      {
        senderId: ctx.meta.user.business._id,
      },
      {
        recipientId: ctx.meta.user._id,
      },
      {
        recipientId: ctx.meta.user.business._id,
      },
    ],
  };
};

const addAuthor = (ctx) => {
  if (ctx.meta.user && ctx.meta.user._id) {
    ctx.params.author = {
      _id: ctx.meta.user._id,
      firstName: ctx.meta.user.firstName,
    };
  } else {
    ctx.params.author = {
      _id: 'anonymous',
    };
  }
};

const addAuthorToEntities = (ctx) => {
  ctx.params.entities = ctx.params.entities.map((entity) => ({
    ...entity,
    author: {
      ...(get(ctx, 'meta.user._id')
        ? {
            _id: ctx.meta.user._id,
            firstName: ctx.meta.user.firstName,
          }
        : { _id: 'anonymous' }),
    },
  }));
};

const addCreatedAt = (ctx) => (ctx.params.createdAt = new Date().getTime());

const addCreatedAtToEntities = (ctx) => {
  ctx.params.entities = ctx.params.entities.map((entity) => ({
    ...entity,
    createdAt: new Date().getTime(),
  }));
};

const addState = (ctx) => (ctx.params.state = 'new');
const addUpdatedAt = (ctx) => (ctx.params.updatedAt = new Date().getTime());
const fixDate =
  (fields = []) =>
  (ctx) => {
    let newParams = {};
    fields.forEach((field) =>
      ctx.params[field]
        ? (newParams[field] = new Date(ctx.params[field]))
        : null,
    );
    ctx.params = {
      ...ctx.params,
      ...newParams,
    };
  };
const addUpdatedBy = (ctx) =>
  (ctx.params.updatedBy = {
    ...(get(ctx, 'meta.user._id')
      ? { _id: ctx.meta.user._id, firstName: ctx.meta.user.firstName }
      : { _id: 'anonymous' }),
  });

const editableOnlyByOwner = async (ctx) => {
  const entity = await ctx.broker.call(
    `v${ctx.service.version}.${ctx.service.name}.get`,
    {
      id: ctx.params.id.toString(),
    },
    ctx,
  );

  if (ctx.service.name === 'users') {
    entity.author = {};
    entity.author._id = entity._id;
  }
  if (entity.author._id.toString() !== ctx.meta.user._id.toString()) {
    return Promise.reject(
      new MoleculerClientError(
        messages.forbidden.error,
        messages.forbidden.code,
        messages.forbidden.type,
      ),
    );
  }

  delete ctx.params.author; //protecting against hacks of rewriting the author
  return ctx;
};

const editableOnlyByOwnerOrAdmin = async (ctx) => {
  // console.log(ctx)
  const entity = await ctx.broker.call(
    `v${ctx.service.version}.${ctx.service.name}.get`,
    {
      id: ctx.params.id,
    },
  );
  if (ctx.service.name === 'users') {
    entity.author = {};
    entity.author._id = entity._id;
  }
  if (
    entity.author._id !== ctx.meta.user._id &&
    ctx.meta.user.role &&
    ctx.meta.user.role !== 'admin'
  ) {
    return Promise.reject(
      new MoleculerClientError(
        messages.forbidden.error,
        messages.forbidden.code,
        messages.forbidden.type,
      ),
    );
  }
  // console.log(entity);
};

const handleBeforeCreditableActions = async (ctx) => {
  const { action } = ctx.params;
  if (action) {
    ctx.meta.action = action;
    delete ctx.params.action;
    return await ensureUserHasNeededCredits(ctx);
    //todo: check if can do action
  }
};

const handleAfterCreditableActions = async (ctx, data) => {
  const { action, user } = ctx.meta;
  if (action) {
    ctx.broker.emit('log.credit.action', {
      ...action,
      ownerId: user._id,
      ownerType: user.type,
    });
  }
  return data;
};

const archiveObject = async (ctx) => {
  let service = ctx.action.service.name;
  let item = await ctx.call(`${service}.get`, {
    id: ctx.params.id,
  });
  await ctx.call('archives.create', {
    itemId: ctx.params.id,
    itemType: service,
    item: item,
    createdAt: new Date(),
  });
};

const addSlugToParams = async (ctx) => {
  const slug = ctx.params.name
    ? slugify(ctx.params.name, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      })
    : false;
  let service = ctx.action.service.name;
  // const found = await ctx.call(`${service}.find`, {query: {slug}}); /todo: check if slug is found first

  // break the code

  if (slug) {
    ctx.params = {
      ...ctx.params,
      slug: slug,
    };
  }
  return ctx.params;
};

//todo: refactor the logger
// const logger = (req, ctx) => {
//   let loggedInfo = {
//     headers: req.headers,
//     url: req.url,
//     timestamp: new Date().getTime(),
//   };

//   redisClient.rpush("logs", JSON.stringify(loggedInfo));
//   console.log("logged");
// };

const coolLog = (title, value) => {
  console.log('==========', title, '==========');
  console.log(value);
  console.log('========== end', title, '==========');
};

// const manageCreditLogs = (req, buildableObject) => {
//   redisClient.get(buildableObject.buildableId, function (err, reply) {
//     // console.log(reply, typeof (reply))
//     if (err || reply === null) {
//       redisClient.set(buildableObject.buildableId, 1);
//       return;
//     }
//     reply = parseInt(reply);
//     // if (buildableObject.package.connections && reply >= buildableObject.package.connections) {
//     //   // Todo throw error
//     // }
//     redisClient.set(buildableObject.buildableId, reply + 1);
//   });
// };

const getWeeklyCreditToAdd = (creditUsed, maxWeeklyCredit) =>
  Math.abs(creditUsed) >= maxWeeklyCredit
    ? maxWeeklyCredit
    : Math.abs(creditUsed); // credit used should be in negative or zero if none

const arrayToHashTable = (array, selector = '_id') => {
  if (!Array.isArray(array)) {
    throw new Error(
      `Invalid argument passed (array). Required array got ${typeof array}`,
    );
  }
  const hash = {};
  array.forEach((item) => (hash[item[selector]] = item));
  return hash;
};

const assureParent =
  ({ service, key }) =>
  async (ctx) => {
    if (!ctx.params[key])
      throw new MoleculerServerError(
        `Record can't be created without a parent. Key ${key} for service ${service} was not provided and is required.`,
        403,
        'no-parent',
        {
          missingField: key,
        },
      );
    try {
      await ctx.call(`v1.${service}.get`, { id: ctx.params[key] });
    } catch (error) {
      throw new MoleculerServerError(
        `Invalid entry for parent id. A valid ${key} for service ${service} must be provided. No record in ${service} with ${key} = ${ctx.params[key]} was found.`,
        403,
        'no-parent',
        {
          invalidEntry: key,
        },
      );
    }
  };

const checkBuildableAssociation = async (ctx, res) => {
  if (get(res, 'buildableId') !== get(ctx, 'meta.buildable._id')) {
    throw await getError({ code: TYPES.ERRORS.CRUD_ENTITY_NOT_FOUND });
  }

  return res;
};

const compareBuildableIds = (getAction) => async (ctx) => {
  const value = await ctx.broker.call(
    getAction,
    { id: ctx.params.id },
    { meta: ctx.meta },
  );
  if (get(value, 'buildableId') !== get(ctx, 'meta.buildable._id')) {
    throw await getError({ code: TYPES.ERRORS.CRUD_ENTITY_NOT_FOUND });
  }

  return ctx;
};

const disable = async () => {
  throw await getError({ code: TYPES.ERRORS.CRUD_ACTION_NOT_FOUND });
};

const callDeletedService =
  ({ service, module, getAction }) =>
  async (ctx) => {
    const value = await ctx.broker.call(
      getAction,
      { id: ctx.params.id },
      { meta: ctx.meta },
    );
    await ctx.broker.call('v1.deleted.create', {
      copy: value,
      service,
      module,
      reverseAction: 'create',
    });

    return ctx;
  };

const handleDuplicateKeyInsertError = async (ctx, err) => {
  if (err.code === 11000) {
    const error = await getError({
      code: TYPES.ERRORS.CRUD_UNIQUE_INDEX_VIOLATION,
    });

    const indexString = 'index:';
    const message = get(err, 'message', '');
    const substringIndex = message.indexOf(indexString)
      ? message.indexOf(indexString) + indexString.length
      : 0;
    const index = message.substring(substringIndex).trim();

    const actionName = get(ctx, 'action.name', '');
    const serviceFullName = get(ctx, 'service.fullName', '');
    const action =
      actionName && serviceFullName
        ? actionName.substring(serviceFullName.length + 1)
        : actionName;

    const templateArgs = {
      index,
      service: get(ctx, 'service.name'),
      action,
    };

    throw useError({ error, templateArgs, input: ctx.params });
  }

  throw err;
};

const handleBuildableMongoPipelineErrorInput = (ctx) => {
  let input = {};

  if (Array.isArray(ctx.params.pipeline)) {
    input = {
      ...ctx.params,
      pipeline: ctx.params.pipeline.slice(1), //remove $match buildableId
    };
  }

  return input;
};

const handleMongoError = async (ctx, err) => {
  const isMongoError = err.code && err.errmsg;

  if (isMongoError) {
    if (err.code === 40324) {
      await handleUnrecognizedPipelineStageError(ctx, err);
    } else {
      const error = await getError({
        code: TYPES.ERRORS.AGGREGATE_MONGO_ERROR,
      });

      const templateArgs = {
        message: err.errmsg,
        code: err.code,
      };

      const input = handleBuildableMongoPipelineErrorInput(ctx);

      throw useError({ error, templateArgs, input });
    }
  }

  throw err;
};

const handleUnrecognizedPipelineStageError = async (ctx, err) => {
  if (err.code === 40324) {
    const error = await getError({
      code: TYPES.ERRORS.UNRECOGNIZED_PIPELINE_STAGE,
    });

    const templateArgs = {
      message: err.errmsg,
    };

    const input = handleBuildableMongoPipelineErrorInput(ctx);

    throw useError({ error, templateArgs, input });
  }

  throw err;
};

const handleMongoDriverError = async (ctx, err) => {
  if (err.driver === true) {
    const error = await getError({
      code: TYPES.ERRORS.UPDATE_WITH_QUERY_MONGO_ERROR,
    });

    const templateArgs = {
      message: err.message,
    };

    const input = ctx.params;

    throw useError({ error, templateArgs, input });
  }
};

const addRequiredValuesToEntities = (ctx) => {
  ctx.params.entities = ctx.params.entities.map((entity) => ({
    ...entity,
    author: {
      ...(get(ctx, 'meta.user._id')
        ? {
            _id: ctx.meta.user._id,
            firstName: ctx.meta.user.firstName,
          }
        : { _id: 'anonymous' }),
    },
    createdAt: new Date().getTime(),
    buildableId: ctx.meta.buildable
      ? ctx.meta.buildable._id
      : vars.buildable._id,
  }));
};

const addBuildableIdToAggregate = (ctx) => {
  if (Array.isArray(ctx.params.pipeline)) {
    const buildableId =
      get(ctx, 'meta.buildable._id') || get(ctx, 'user.buildableId');
    ctx.params.pipeline = [{ $match: { buildableId } }, ...ctx.params.pipeline];
  }
};

const addUpdatedAtToUpdateParam = (ctx) => {
  if (ctx.params.update) {
    set(ctx.params.update, '$set.updatedAt', new Date().getTime());
  }
};

const addUpdatedByToUpdateParam = (ctx) => {
  const getUpdatedBy = () => ({
    ...(get(ctx, 'meta.user._id')
      ? { _id: ctx.meta.user._id, firstName: ctx.meta.user.firstName }
      : { _id: 'anonymous' }),
  });

  if (ctx.params.update) {
    set(ctx.params.update, '$set.updatedBy', getUpdatedBy());
  }
};

module.exports = {
  addAuthor,
  addAuthorToEntities,
  addBuildableIdToParams,
  addBuildableIdToEntities,
  addBuildableToQuery,
  addCreatedAt,
  addCreatedAtToEntities,
  addOnlyOwnedOrAdminToQuery,
  addOnlyOwnedToQuery,
  addOnlyRecipientOrSenderToQuery,
  addSlugToParams,
  addState,
  addUpdatedAt,
  addUpdatedBy,
  archiveObject,
  arrayToHashTable,
  assureParent,
  editableOnlyByOwner,
  editableOnlyByOwnerOrAdmin,
  fixDate,
  handleAfterCreditableActions,
  handleBeforeCreditableActions,
  addBuildableOrGlobalBuildableToQuery,
  // logger,
  loggerPlay,
  // manageCreditLogs,
  coolLog,
  checkBuildableAssociation,
  compareBuildableIds,
  disable,
  callDeletedService,
  handleDuplicateKeyInsertError,
  addRequiredValuesToEntities,
  addBuildableIdToAggregate,
  handleUnrecognizedPipelineStageError,
  handleMongoError,
  handleMongoDriverError,
  addUpdatedAtToUpdateParam,
  addUpdatedByToUpdateParam,
};
