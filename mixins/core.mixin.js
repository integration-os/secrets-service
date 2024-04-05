'use strict';

const utilMethods = require('../actions/methods/util.methods');
const buildableMethods = require('../actions/methods/buildable.methods');

module.exports = ({ service, module, getAction }) => {
  return {
    hooks: {
      before: {
        find: [utilMethods.addBuildableToQuery],
        list: [utilMethods.addBuildableToQuery],
        create: [
          utilMethods.addBuildableIdToParams,
          utilMethods.addCreatedAt,
          utilMethods.addAuthor,
        ],
        update: [
          utilMethods.compareBuildableIds(getAction),
          utilMethods.addUpdatedAt,
          utilMethods.addUpdatedBy,
        ],
        remove: [
          utilMethods.compareBuildableIds(getAction),
          utilMethods.callDeletedService({ service, module, getAction }),
        ],
        count: [utilMethods.addBuildableToQuery],
        insert: [utilMethods.disable],
      },
      after: {
        get: [utilMethods.checkBuildableAssociation],
      },
      error: {
        create: [utilMethods.handleDuplicateKeyInsertError],
        update: [utilMethods.handleDuplicateKeyInsertError],
      },
    },
  };
};
