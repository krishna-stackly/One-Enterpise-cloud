package com.stackly.pms.service;

import com.stackly.pms.dto.AuthDtos.LoginRequest;
import com.stackly.pms.dto.AuthDtos.TokenResponse;
import com.stackly.pms.entity.PasswordResetToken;
import com.stackly.pms.entity.RefreshToken;
import com.stackly.pms.entity.User;
import com.stackly.pms.exception.ApiException;
import com.stackly.pms.repository.PasswordResetTokenRepository;
import com.stackly.pms.repository.RefreshTokenRepository;
import com.stackly.pms.repository.UserRepository;
import com.stackly.pms.security.JwtService;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final HierarchyService hierarchyService;

    @Transactional
    public TokenResponse login(LoginRequest request) {
        User user = userRepository.findByEmailIgnoreCase(request.email())
                .orElseThrow(() -> ApiException.unauthorized("Invalid email or password"));
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw ApiException.unauthorized("Invalid email or password");
        }
        if (!hierarchyService.canSignIn(user)) {
            throw ApiException.unauthorized(
                    "Associates do not have app login or a dashboard. Ask your POC to update work.");
        }
        return issue(user);
    }

    @Transactional
    public TokenResponse refresh(String refreshToken) {
        RefreshToken stored = refreshTokenRepository.findByToken(refreshToken)
                .orElseThrow(() -> ApiException.unauthorized("Invalid refresh token"));
        if (stored.isRevoked() || stored.getExpiresAt().isBefore(Instant.now())) {
            throw ApiException.unauthorized("Invalid refresh token");
        }
        stored.setRevoked(true);
        return issue(stored.getUser());
    }

    @Transactional
    public void logout(String refreshToken) {
        refreshTokenRepository.findByToken(refreshToken).ifPresent(token -> token.setRevoked(true));
    }

    @Transactional
    public String forgotPassword(String email) {
        return userRepository.findByEmailIgnoreCase(email).filter(hierarchyService::canSignIn).map(user -> {
            String value = UUID.randomUUID().toString();
            PasswordResetToken token = PasswordResetToken.builder()
                    .user(user)
                    .token(value)
                    .expiresAt(Instant.now().plusSeconds(3600))
                    .used(false)
                    .build();
            passwordResetTokenRepository.save(token);
            return value;
        }).orElse(null);
    }

    @Transactional
    public void resetPassword(String token, String password) {
        PasswordResetToken reset = passwordResetTokenRepository.findByToken(token)
                .orElseThrow(() -> ApiException.badRequest("Invalid reset token"));
        if (reset.isUsed() || reset.getExpiresAt().isBefore(Instant.now())) {
            throw ApiException.badRequest("Invalid reset token");
        }
        reset.setUsed(true);
        reset.getUser().setPasswordHash(passwordEncoder.encode(password));
    }

    @Transactional
    public void changePassword(User actor, String currentPassword, String newPassword) {
        if (!passwordEncoder.matches(currentPassword, actor.getPasswordHash())) {
            throw ApiException.badRequest("Current password is incorrect");
        }
        actor.setPasswordHash(passwordEncoder.encode(newPassword));
    }

    private TokenResponse issue(User user) {
        String access = jwtService.createAccessToken(user.getId(), user.getEmail());
        String refresh = jwtService.createRefreshToken(user.getId(), user.getEmail());
        refreshTokenRepository.save(RefreshToken.builder()
                .user(user)
                .token(refresh)
                .expiresAt(Instant.now().plusMillis(jwtService.getRefreshExpirationMs()))
                .revoked(false)
                .build());
        return new TokenResponse(access, refresh, user.getId(), user.getEmail(), user.getFirstName(), user.getLastName());
    }
}
