import { type Role } from "../utils/adminOnly";
/**
 * Admin-only callable: set a user's role (custom claims + Firestore profile).
 */
export declare const setUserRole: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    uid: string;
    role: Role;
}>>;
