//todo make it so we can import and export

const updateUserAvailableCredits = async (ctx, newCredit) => {
  const user = await ctx.broker.call('v1.users.get', { id: newCredit.ownerId });
  const { availableCredits } = user;
  await ctx.broker.call('v1.users.update', {
    id: newCredit.ownerId,
    availableCredits: availableCredits + newCredit.credit,
  });
  return newCredit;
};

module.exports = {
  updateUserAvailableCredits,
};
