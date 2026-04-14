import { initializeApp } from "firebase-admin/app";

// Initialize Firebase Admin SDK
initializeApp();

// Auth triggers
export { onUserCreate } from "./auth/onCreate";
export { setUserRole } from "./auth/claims";

// Voting
export { castVote } from "./voting/castVote";

// Firestore triggers
export { onTopicRequestEndorsed } from "./triggers/onEndorse";

// Scheduled triggers
export { cleanupExpiredRequests } from "./triggers/onExpire";

// Admin: Topics
export {
  adminCreateTopic,
  adminEditTopic,
  adminDeleteTopic,
} from "./admin/topics";

// Admin: Users
export {
  adminListUsers,
  adminBanUser,
  adminUnbanUser,
} from "./admin/users";

// Admin: Moderation
export {
  reportContent,
  adminDeleteComment,
  adminReviewReport,
  adminListReports,
} from "./admin/moderation";

// Admin: Requests
export {
  adminUpdateRequestStatus,
  adminBulkUpdateRequests,
} from "./admin/requests";

// Admin: Analytics
export {
  adminGetAnalytics,
  adminGetVotingTrends,
  dailyAnalyticsAggregation,
} from "./admin/analytics";

// User: server-validated writes
export { postComment } from "./user/postComment";
export { createTopicRequest } from "./user/createTopicRequest";
export { endorseTopicRequest } from "./user/endorseTopicRequest";
export { createChangeRequest } from "./user/createChangeRequest";
