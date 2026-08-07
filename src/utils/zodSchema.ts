import { z } from "zod";

export const updateProfileSchema = z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    bio: z.string().optional(),
    profilePicture: z.string().url().optional(),
});


export const signUpSchema = z.object({
    name: z.string().min(1, "Name is required"),
    username: z.string().min(1, "Username is required"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
});
export const signInSchema = z.object({
    username: z.string().min(1, "Username is required"),
    password: z.string().min(8, "Password is wrong"),
});


export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters long"),
});
