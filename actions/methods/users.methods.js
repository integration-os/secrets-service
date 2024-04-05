const vars = require('../../vars');
const { MoleculerClientError } = require('moleculer').Errors;

const { errors } = vars;
const { messages } = errors;

const ensureUserHasNeededCredits = async (ctx) => {
  const user = await ctx.broker.call('v1.users.get', { id: ctx.meta.user._id });
  const actionCredit = await ctx.broker.call('v1.action-economy.get', {
    id: ctx.meta.action.actionName,
  });
  console.log('Inside ensureUserHasNeededCredits', user, actionCredit.credit);

  if (user.availableCredits + actionCredit.credit < 0) {
    return Promise.reject(
      new MoleculerClientError(
        messages.actionForbidden.error,
        messages.actionForbidden.code,
        messages.actionForbidden.type,
      ),
    );
  }
};

module.exports = {
  ensureUserHasNeededCredits,
};
