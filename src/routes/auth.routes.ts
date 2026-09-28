import { Router } from "express";
import { ForgotPassword, Login, LogOut, Profile, refresh, Register, ResetPassword, UpdateEmail, UpdatePassword } from "../controllers/auth.controllers";
import { Authenticate, validateRefreshToken } from "../middleware/auth.middleware";
export const router = Router();
router.post("/register",Register);
router.post("/login",Login);
router.post("/refresh",validateRefreshToken,refresh)
router.get("/profile",Authenticate,Profile);
router.post("/logout",Authenticate,LogOut);
router.post("/reset",ResetPassword);
router.post("/forgot_password",ForgotPassword);
router.post("/update_email",Authenticate,UpdateEmail);
router.post("/update_profile",Authenticate,UpdatePassword);
router.post("/update_password",Authenticate,UpdatePassword);


