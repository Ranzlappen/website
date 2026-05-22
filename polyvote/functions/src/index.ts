import { initializeApp } from "firebase-admin/app";

// Initialize Firebase Admin SDK
initializeApp();

// Auth triggers
export { onUserCreate } from "./auth/onCreate";
export { setUserRole } from "./auth/claims";
export { bootstrapAdmin } from "./auth/bootstrapAdmin";

// Voting
export { castVote } from "./voting/castVote";

// Firestore triggers
export { onTopicRequestEndorsed } from "./triggers/onEndorse";

// Scheduled triggers
export { cleanupExpiredRequests } from "./triggers/onExpire";
export { computeTrending } from "./triggers/computeTrending";

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

// Public: Insights
export { getPublicStats } from "./admin/publicStats";

// Blog: drafts
export {
  blogSaveDraft,
  blogListDrafts,
  blogGetDraft,
  blogDeleteDraft,
} from "./blog/drafts";

// Blog: publish to GitHub
export { blogPublishToGitHub } from "./blog/publish";

// Blog: image upload
export { blogUploadImage } from "./blog/images";

// Blog: GitHub integration
export {
  blogListExistingPosts,
  blogFetchExistingPost,
} from "./blog/github";

// Blog: series usage (aggregate used series + order numbers for admin UI)
export { blogListSeriesUsage } from "./blog/seriesUsage";

// Blog: Import existing post for edit (links draft to source file)
export { blogImportPostForEdit } from "./blog/import";

// Blog: public voting (Realtime Database)
export { castBlogVote } from "./blog/castBlogVote";

// User: server-validated writes
export { postComment } from "./user/postComment";
export { createTopicRequest } from "./user/createTopicRequest";
export { endorseTopicRequest } from "./user/endorseTopicRequest";
export { createChangeRequest } from "./user/createChangeRequest";
export { voteOnComment } from "./user/voteOnComment";

// Inventory: folders
export {
  inventoryListFolders,
  inventoryCreateFolder,
  inventoryUpdateFolder,
  inventoryDeleteFolder,
  inventoryDuplicateFolder,
} from "./inventory/folders";

// Inventory: items
export {
  inventoryListItems,
  inventoryGetItem,
  inventoryCreateItem,
  inventoryUpdateItem,
  inventoryDeleteItem,
  inventoryToggleEbaySync,
  inventoryDuplicateItem,
} from "./inventory/items";

// Inventory: photos
export {
  inventoryUploadPhoto,
  inventoryDeletePhoto,
  inventoryReorderPhotos,
} from "./inventory/photos";

// Inventory: import / export
export { inventoryImport, inventoryExport } from "./inventory/importExport";

// Inventory: eBay File Exchange CSV export
export { inventoryExportEbayCsv } from "./inventory/ebayExport";

// Inventory: lookup (scan-to-find + global search)
export {
  inventoryFindByEan,
  inventorySearchItems,
} from "./inventory/lookup";
