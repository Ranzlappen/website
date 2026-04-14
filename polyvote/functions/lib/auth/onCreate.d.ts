import * as functions from "firebase-functions/v1";
/**
 * Trigger: runs whenever a new Firebase Auth user is created.
 * Creates a corresponding UserProfile document in the `users` collection.
 */
export declare const onUserCreate: functions.CloudFunction<import("firebase-admin/auth").UserRecord>;
