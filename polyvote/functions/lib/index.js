"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createChangeRequest = exports.endorseTopicRequest = exports.createTopicRequest = exports.postComment = exports.dailyAnalyticsAggregation = exports.adminGetVotingTrends = exports.adminGetAnalytics = exports.adminBulkUpdateRequests = exports.adminUpdateRequestStatus = exports.adminListReports = exports.adminReviewReport = exports.adminDeleteComment = exports.reportContent = exports.adminUnbanUser = exports.adminBanUser = exports.adminListUsers = exports.adminDeleteTopic = exports.adminEditTopic = exports.adminCreateTopic = exports.cleanupExpiredRequests = exports.onTopicRequestEndorsed = exports.castVote = exports.setUserRole = exports.onUserCreate = void 0;
const app_1 = require("firebase-admin/app");
// Initialize Firebase Admin SDK
(0, app_1.initializeApp)();
// Auth triggers
var onCreate_1 = require("./auth/onCreate");
Object.defineProperty(exports, "onUserCreate", { enumerable: true, get: function () { return onCreate_1.onUserCreate; } });
var claims_1 = require("./auth/claims");
Object.defineProperty(exports, "setUserRole", { enumerable: true, get: function () { return claims_1.setUserRole; } });
// Voting
var castVote_1 = require("./voting/castVote");
Object.defineProperty(exports, "castVote", { enumerable: true, get: function () { return castVote_1.castVote; } });
// Firestore triggers
var onEndorse_1 = require("./triggers/onEndorse");
Object.defineProperty(exports, "onTopicRequestEndorsed", { enumerable: true, get: function () { return onEndorse_1.onTopicRequestEndorsed; } });
// Scheduled triggers
var onExpire_1 = require("./triggers/onExpire");
Object.defineProperty(exports, "cleanupExpiredRequests", { enumerable: true, get: function () { return onExpire_1.cleanupExpiredRequests; } });
// Admin: Topics
var topics_1 = require("./admin/topics");
Object.defineProperty(exports, "adminCreateTopic", { enumerable: true, get: function () { return topics_1.adminCreateTopic; } });
Object.defineProperty(exports, "adminEditTopic", { enumerable: true, get: function () { return topics_1.adminEditTopic; } });
Object.defineProperty(exports, "adminDeleteTopic", { enumerable: true, get: function () { return topics_1.adminDeleteTopic; } });
// Admin: Users
var users_1 = require("./admin/users");
Object.defineProperty(exports, "adminListUsers", { enumerable: true, get: function () { return users_1.adminListUsers; } });
Object.defineProperty(exports, "adminBanUser", { enumerable: true, get: function () { return users_1.adminBanUser; } });
Object.defineProperty(exports, "adminUnbanUser", { enumerable: true, get: function () { return users_1.adminUnbanUser; } });
// Admin: Moderation
var moderation_1 = require("./admin/moderation");
Object.defineProperty(exports, "reportContent", { enumerable: true, get: function () { return moderation_1.reportContent; } });
Object.defineProperty(exports, "adminDeleteComment", { enumerable: true, get: function () { return moderation_1.adminDeleteComment; } });
Object.defineProperty(exports, "adminReviewReport", { enumerable: true, get: function () { return moderation_1.adminReviewReport; } });
Object.defineProperty(exports, "adminListReports", { enumerable: true, get: function () { return moderation_1.adminListReports; } });
// Admin: Requests
var requests_1 = require("./admin/requests");
Object.defineProperty(exports, "adminUpdateRequestStatus", { enumerable: true, get: function () { return requests_1.adminUpdateRequestStatus; } });
Object.defineProperty(exports, "adminBulkUpdateRequests", { enumerable: true, get: function () { return requests_1.adminBulkUpdateRequests; } });
// Admin: Analytics
var analytics_1 = require("./admin/analytics");
Object.defineProperty(exports, "adminGetAnalytics", { enumerable: true, get: function () { return analytics_1.adminGetAnalytics; } });
Object.defineProperty(exports, "adminGetVotingTrends", { enumerable: true, get: function () { return analytics_1.adminGetVotingTrends; } });
Object.defineProperty(exports, "dailyAnalyticsAggregation", { enumerable: true, get: function () { return analytics_1.dailyAnalyticsAggregation; } });
// User: server-validated writes
var postComment_1 = require("./user/postComment");
Object.defineProperty(exports, "postComment", { enumerable: true, get: function () { return postComment_1.postComment; } });
var createTopicRequest_1 = require("./user/createTopicRequest");
Object.defineProperty(exports, "createTopicRequest", { enumerable: true, get: function () { return createTopicRequest_1.createTopicRequest; } });
var endorseTopicRequest_1 = require("./user/endorseTopicRequest");
Object.defineProperty(exports, "endorseTopicRequest", { enumerable: true, get: function () { return endorseTopicRequest_1.endorseTopicRequest; } });
var createChangeRequest_1 = require("./user/createChangeRequest");
Object.defineProperty(exports, "createChangeRequest", { enumerable: true, get: function () { return createChangeRequest_1.createChangeRequest; } });
//# sourceMappingURL=index.js.map