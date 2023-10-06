import { getBotContext, getLogger } from "../../../bindings";
import { Payload } from "../../../types";
import { GLOBAL_STRINGS } from "../../../configs";
// import { IssueCommentCommands } from "../commands";
// import {
//   calculateIssueAssigneeReward,
//   // calculateIssueConversationReward,
//   // calculateIssueCreatorReward,
//   // calculateReviewContributorRewards,
//   handleIssueClosed,
//   incentivesCalculation,
// } from "../../payout";
// import { getAllIssueComments, getUserPermission } from "../../../helpers";
// import { calculateIssueCreatorReward } from "../../payout/calculate-issue-creator-reward";
// import { calculateIssueConversationReward } from "../../payout/calculate-issue-conversation-reward";
// import { calculateReviewContributorRewards } from "../../payout/calculate-review-contributor-rewards";
import { isUserAdminOrBillingManager } from "../../../helpers/issue";

// export async function payout(body: string) {
//   const { payload: _payload } = getBotContext();
//   const logger = getLogger();
//   if (body != IssueCommentCommands.PAYOUT && body.replace(/`/g, "") != IssueCommentCommands.PAYOUT) {
//     logger.info(`Skipping to payout. body: ${body}`);
//     return;
//   }

//   const payload = _payload as Payload;
//   logger.info(`Received '/payout' command from user: ${payload.sender.login}`);
//   const issue = (_payload as Payload).issue;
//   if (!issue) {
//     logger.info(`Skipping '/payout' because of no issue instance`);
//     return;
//   }

//   const _labels = payload.issue?.labels;
//   if (_labels?.some((e) => e.name.toLowerCase() === "Permitted".toLowerCase())) {
//     logger.info(`Permit already generated for ${payload.issue?.number}`);
//     return;
//   }

//   const IssueComments = await getAllIssueComments(issue.number);
//   if (IssueComments.length === 0) {
//     return `Permit generation failed due to internal GitHub Error`;
//   }

//   const hasPosted = IssueComments.find((e) => e.user.type === "Bot" && e.body.includes("https://pay.ubq.fi?claim"));
//   if (hasPosted) {
//     logger.info(`Permit already generated for ${payload.issue?.number}`);
//     return;
//   }

//   // assign function incentivesCalculation to a variable
//   const calculateIncentives = await incentivesCalculation();

//   const creatorReward = await calculateIssueCreatorReward(calculateIncentives);
//   const assigneeReward = await calculateIssueAssigneeReward(calculateIncentives);
//   const conversationRewards = await calculateIssueConversationReward(calculateIncentives);
//   const pullRequestReviewersReward = await calculateReviewContributorRewards(calculateIncentives);

//   return await handleIssueClosed(creatorReward, assigneeReward, conversationRewards, pullRequestReviewersReward, calculateIncentives);
// }

export async function autoPay(body: string) {
  const context = getBotContext();
  const _payload = context.payload;
  const logger = getLogger();

  const payload = _payload as Payload;
  logger.info(`Received '/autopay' command from user: ${payload.sender.login}`);

  const pattern = /^\/autopay (true|false)$/;
  const res = body.match(pattern);

  if (res) {
    const userCan = await isUserAdminOrBillingManager(payload.sender.login, context);
    if (userCan) {
      return "You must be an `admin` or `billing_manager` to toggle automatic payments for completed issues.";
    }
    if (res.length > 1) {
      return `${GLOBAL_STRINGS.autopayComment} **${res[1]}**`;
    }
  }
  return "Invalid body for autopay command: e.g. /autopay false";
}
