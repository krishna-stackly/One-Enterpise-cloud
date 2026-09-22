package com.stackly.pms.controller;

import com.stackly.pms.dto.ApiResponse;
import com.stackly.pms.dto.AuthDtos.ForgotPasswordRequest;
import com.stackly.pms.dto.AuthDtos.LoginRequest;
import com.stackly.pms.dto.AuthDtos.RefreshRequest;
import com.stackly.pms.dto.AuthDtos.ChangePasswordRequest;
import com.stackly.pms.dto.AuthDtos.ResetPasswordRequest;
import com.stackly.pms.dto.AuthDtos.TokenResponse;
import com.stackly.pms.entity.User;
import com.stackly.pms.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;

    @PostMapping("/login")
    public ApiResponse<TokenResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.ok("Signed in", authService.login(request));
    }

    @PostMapping("/refresh")
    public ApiResponse<TokenResponse> refresh(@Valid @RequestBody RefreshRequest request) {
        return ApiResponse.ok("Token refreshed", authService.refresh(request.refreshToken()));
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(@Valid @RequestBody RefreshRequest request) {
        authService.logout(request.refreshToken());
        return ApiResponse.ok("Signed out");
    }

    @PostMapping("/forgot-password")
    public ApiResponse<java.util.Map<String, Object>> forgot(@Valid @RequestBody ForgotPasswordRequest request) {
        String token = authService.forgotPassword(request.email());
        java.util.Map<String, Object> data = new java.util.HashMap<>();
        data.put("sent", true);
        if (token != null) {
            data.put("token", token);
            data.put("email", request.email().trim().toLowerCase());
        }
        return ApiResponse.ok("If the account exists, a reset token was created", data);
    }

    @PostMapping("/reset-password")
    public ApiResponse<Void> reset(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request.token(), request.password());
        return ApiResponse.ok("Password updated");
    }

    @PostMapping("/change-password")
    public ApiResponse<Void> changePassword(
            @AuthenticationPrincipal User actor,
            @Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(actor, request.currentPassword(), request.newPassword());
        return ApiResponse.ok("Password changed");
    }
}
