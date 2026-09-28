package com.stackly.pms.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class AuthDtos {
    public record LoginRequest(@Email @NotBlank String email, @NotBlank String password) {}

    public record TokenResponse(String accessToken, String refreshToken, String tokenType, Long userId, String email, String firstName, String lastName) {
        public TokenResponse(String access, String refresh, Long userId, String email, String firstName, String lastName) {
            this(access, refresh, "Bearer", userId, email, firstName, lastName);
        }
    }

    public record RefreshRequest(@NotBlank String refreshToken) {}

    public record ForgotPasswordRequest(@Email @NotBlank String email) {}

    public record ResetPasswordRequest(@NotBlank String token, @Size(min = 8) String password) {}

    public record ChangePasswordRequest(@NotBlank String currentPassword, @Size(min = 8) @NotBlank String newPassword) {}
}
