const vars = require('../../vars/');
const _get = require('lodash/get');
const cloneDeep = require('lodash/cloneDeep');
const isObjectLike = require('lodash/isObjectLike');

const TYPES = {
  SERVICES: {
    GENERIC: 'generic',
    SEPARATOR: '--###--',
  },
  CLONES: {
    STRATEGIES: {
      LOOK_AND_CLONE: 'look-and-clone',
      IMMEDIATE_CLONE: 'immediate-clone',
    },
  },
  INITIAL: 'initial',
  NAMESPACE: {
    RECIPE_EVENT_PREFIX: 'recipe.',
  },
  PIPELINE: {
    TYPES: {
      OPS: 'ops',
      EVENT: 'event',
    },
  },
  STATUS: {
    PENDING: 'pending',
    DONE: 'done',
    ERROR: 'error',
  },
  MODULES: {
    TRIGGER: 'trigger',
  },
  STEP_TYPES: {
    GENERIC: 'generic',
  },
  BINARY_BRANCH: {
    PASS: 'pass',
    FAIL: 'fail',
  },
  STEPS: {
    CRUD: 'crud',
    UNASSIGNED: 'unassigned',
    MANIPULATION: 'manipulation',
    REQUEST: 'request',
    RESPONSE: 'response',
    CONDITIONAL: 'conditional',
    TRIGGER: 'trigger',
    INTEGRATION: 'integration',
    LOOP: 'loop',
    INTEGRATIONS: {
      AUTH0: 'auth0',
      ELASTIC_SEARCH: 'elastic-search',
      SENDGRID: 'sendgrid',
      SHOPIFY: 'shopify',
      SLACK: 'slack',
      STRIPE: 'stripe',
      TWILIO: 'twilio',
      FIREBASE: 'firebase',
    },
  },
  ENVS: {
    TEST: 'test',
    LIVE: 'live',
  },
};

const isObject = (node) =>
  node &&
  typeof node === 'object' &&
  !Array.isArray(node) &&
  !(node instanceof Map) &&
  !(node instanceof Set);

const replaceValue1 = (ctx, payloadKeys, payload) => {
  let newPayload = {};
  let payloadString = JSON.stringify(payload);
  payloadString = payloadString.replace(/_\$/g, '$'); //this allow the use of $exists and $in, etc
  let updatedPayload = JSON.parse(payloadString);

  payloadKeys.forEach((key) => {
    let value = updatedPayload[key];

    if (vars.templateStrings.fields.includes(key)) {
      //handling string template
      value = eval('`' + updatedPayload[key] + '`'); // Hey ${ctx.meta.user.name}
    }

    if (typeof value === 'string') {
      const breakValue = value.split('.');
      if (breakValue[0] === 'ctx') {
        breakValue.shift();
        const depth = breakValue.length;
        //todo: rewrite this in a better recursive call
        if (depth === 2 && ['params', 'meta'].includes(breakValue[0])) {
          value = ctx[breakValue[0]][breakValue[1]];
        } else if (depth === 3) {
          value = ctx[breakValue[0]][breakValue[1]][breakValue[2]];
        } else if (depth === 4) {
          value =
            ctx[breakValue[0]][breakValue[1]][breakValue[2]][breakValue[3]];
        } else if (depth === 5) {
          value =
            ctx[breakValue[0]][breakValue[1]][breakValue[2]][breakValue[3]][
              breakValue[4]
            ];
        }
      }
      newPayload[key] = value;
    } else if (
      typeof value === 'boolean' ||
      typeof value === 'number' ||
      Array.isArray(value) ||
      value === null
    ) {
      newPayload[key] = payload[key];
    } else if (typeof value === 'object') {
      newPayload[key] = replaceValue(ctx, payload[key]);
    }
  });
  return newPayload;
};

const replaceValue = (ref, input, pathPrefix) => {
  const isCtx = ref.params && ref.meta;
  const cleanedRef = isCtx ? { params: ref.params, meta: ref.meta } : ref; //Clean ctx to prevent non params/meta access

  const recursionLimit = vars.MAX_CALL_STACK;
  let recursionCalls = 0;

  const incrementRecursion = () => {
    recursionCalls++;
  };

  const maxCallsReached = () => {
    if (recursionCalls >= recursionLimit) {
      throw new Error('Max recursion calls reached at .' + vars.MAX_CALL_STACK);
    }
  };

  const templateReplacer = (match) => {
    incrementRecursion();
    maxCallsReached();

    match = match.substring(2, match.length - 1);
    return parseString(match);
  };

  const parseString = (input) => {
    if (typeof input !== 'string') {
      throw new Error(
        'parseString expected an input type string but got' + typeof input,
      );
    }

    const brokenString = input.split('.');
    if (brokenString[0] === 'ctx' || brokenString[0] === '$ctx') {
      if (
        brokenString.length < 3 ||
        !['params', 'meta', '$steps'].includes(brokenString[1])
      ) {
        throw new Error('Invalid context path for string replacement.');
      }

      if (brokenString[1] === '$steps') {
        brokenString[1] = 'meta';
      }

      brokenString.shift();
      input = brokenString.join('.');

      return _get(cleanedRef, input, null);
    } else if (
      pathPrefix &&
      brokenString[0].length >= pathPrefix.length &&
      brokenString[0].substr(0, pathPrefix.length) === pathPrefix
    ) {
      if (input === pathPrefix) {
        return cleanedRef;
      }

      // brokenString[0] = brokenString[0].slice(pathPrefix.length);
      brokenString.shift();
      // console.log("brokenString", brokenString);
      input = brokenString.join('.');
      // console.log("cleanedRef", cleanedRef);
      // console.log("input", input);

      return _get(cleanedRef, input, null);
    }

    return input.replace(/\${[a-zA-Z.]+}/g, templateReplacer);
  };

  const _replaceValue = (input, currentPath) => {
    incrementRecursion();
    maxCallsReached();

    switch (typeof input) {
      case 'string':
        input = parseString(input);
        //parse string, check for ctx, if so grab value from ctx using path (caveat, protect ctx only params and meta access)
        break;
      case 'array':
        input = input.map((item, index) =>
          _replaceValue(item, (currentPath += `.${index}`)),
        );
        break;
      case 'object':
        if (input === null) {
          break;
        }
        Object.keys(input).forEach((key) => {
          let oldKey = key;
          const oldValue = input[oldKey];
          if (key.substring(0, 2) === '_$') {
            //Duo to the fact that our DB is mongo we can't store keys starting with $, but because we may need to store queries,
            //there for we will use _$ and replace it with $ here.
            key = key.slice(1);
            delete input[oldKey];
          }

          const hasSpread = ['__spread__', '...'].includes(key);

          if (
            (hasSpread &&
              typeof input[key] === 'string' &&
              !input[key].includes('$item')) ||
            (hasSpread &&
              input[key].includes('$item') &&
              pathPrefix === '$item')
          ) {
            input = {
              ...input,
              ..._replaceValue(oldValue, (currentPath += `.${key}`)),
            };
            delete input.__spread__;
            if (key === '...') {
              delete input['...'];
            }
          } else {
            input[key] = _replaceValue(oldValue, (currentPath += `.${key}`));
          }
        });
        break;
      case 'boolean':
      case 'number':
        break;
      case 'undefined':
        throw new Error(
          "replaceValue got an input of 'undefined' with path " + currentPath,
        );
    }
    return input;
  };

  return _replaceValue(input, '');
};

/*
  walks through the subject recursively and runs `apply(currentNode, subject)` on each node.

  NOTES: 
  - Does not modify the subject.
  - the `apply` function can either mutate the node or return a new value (if doing both, return takes precedence)
  - To change the value of a primitive node, make sure to return a value for that case in your apply function (recall primitives are pass by value)
*/
const walk = (subject, apply) => {
  const clonedSubject = cloneDeep(subject);
  const seen = new Set(); //handle circular references

  const _walk = (node) => {
    if (seen.has(node)) {
      return node; //do nothing
    }
    if (isObjectLike(node)) {
      //handle primitives
      seen.add(node);
    }

    const result = apply(node, clonedSubject);
    node = result === undefined ? node : result; //allow for nulls to be set

    if (Array.isArray(node)) {
      node = node.map((item) => _walk(item));
    } else if (node instanceof Set) {
      const newSet = new Set();
      node.forEach((item) => {
        newSet.add(_walk(item));
      });

      node = newSet;
    } else if (node instanceof Map) {
      node.forEach((value, key) => {
        node.set(key, _walk(value));
      });
    } else if (node && typeof node === 'object') {
      //maintain instance integrity, doing { ...newObj } causes loss of instance type
      Object.keys(node).map((key) => {
        node[key] = _walk(node[key]);
      });
    }

    return node;
  };

  return _walk(clonedSubject);
};

const maskKeysDeep = (
  object,
  sensitiveKeys = [],
  replaceValue = '*****-value-redacted-for-security-purposes-*****',
) => {
  const apply = (node) => {
    if (isObject(node)) {
      Object.keys(node).forEach((key) => {
        if (sensitiveKeys.includes(key)) {
          node[key] = replaceValue;
        }
      });
    }
  };

  return walk(object, apply);
};

const removeKeysDeep = (object, sensitiveKeys = []) => {
  const apply = (node) => {
    if (isObject(node)) {
      Object.keys(node).forEach((key) => {
        if (sensitiveKeys.includes(key)) {
          delete node[key];
        }
      });
    }
    // if (node && typeof node === "string") {
    //   sensitiveKeys.forEach((key) => {
    //     node = node.replace(key, "");
    //   });
    //   return node;
    // }
  };

  return walk(object, apply);
};

const handleHook =
  (action, hookState = 'before') =>
  async (ctx, data) => {
    //todo: make sure that ctx will be passed in the action called is not on the same server
    //call get-logic
    // console.log("Handleing hook")
    // return true;

    const actionLogic = await ctx.call('v1.application-actions.get-logic', {
      action: ctx.action.name,
      buildableId: ctx.meta.buildable._id,
    });

    if (data) {
      ctx.meta.response = data;
    }
    ctx.meta.actionLogic = actionLogic;
    if (data) {
      ctx.meta.response = data;
    }
    // console.log("ctx.meta is ====>", ctx.meta);
    if (actionLogic) {
      // console.log("actionLogic[hookState].actions", actionLogic[hookState].actions);
      let allActions = actionLogic[hookState].actions.map(async (action) => {
        try {
          let payload = action.payload;

          let newPayload = replaceValue(ctx, payload);
          // newPayload.query ? (newPayload.query = replaceValue(ctx, newPayload.query)) : null;
          // console.log("New Payload", newPayload);
          return await ctx.broker.call(action.action, newPayload, {
            meta: ctx.meta,
          });
        } catch (error) {
          if (action.safeFail) {
            null; //todo: create a log to track all errors
          } else {
            throw error;
          }
        }
      });
      let dataBack = await Promise.all(allActions);
      actionLogic.before.actions.forEach(
        (action, index) => (ctx.meta[action.module] = dataBack[index]),
      );
      //console.log(ctx.meta);
    }

    if (data) {
      return data;
    }
  };

const useInteractions = async (ctx, data) => {
  const { action } = ctx;
  //   console.log("New test")
  ctx.broker
    .call('v1.interactions.log.event', {
      data,
      action,
      ctx,
    })
    .then();
  return data;
};

const handleGenericServiceActionName = ({ actionName, payload }) => {
  const isGeneric = actionName.includes(
    `${TYPES.SERVICES.GENERIC}${TYPES.SERVICES.SEPARATOR}`,
  );
  if (!isGeneric) {
    return { actionName, payload };
  }
  const [version, service, action] = actionName.split('.');
  const [_generic, genericCollection] = service.split(TYPES.SERVICES.SEPARATOR);
  // console.log(genericCollection, "genericCollection <<<<<<<<", _generic);
  const cleanActionName = `${version}.${TYPES.SERVICES.GENERIC}.${action}`;
  return {
    actionName: cleanActionName,
    payload: { ...payload, __collection__: genericCollection },
  };
};

module.exports = {
  handleHook,
  useInteractions,
  replaceValue,
  isObject,
  walk,
  maskKeysDeep,
  handleGenericServiceActionName,
  removeKeysDeep,
};
