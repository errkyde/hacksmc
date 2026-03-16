package com.hacksmc.service;

import com.hacksmc.dto.ChangePasswordRequest;
import com.hacksmc.dto.LoginRequest;
import com.hacksmc.dto.LoginResponse;
import com.hacksmc.entity.User;
import com.hacksmc.repository.UserRepository;
import com.hacksmc.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuditLogService auditLogService;
    private final MaintenanceService maintenanceService;

    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByUsername(request.username())
                .orElseThrow(() -> new BadCredentialsException("Invalid credentials"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new BadCredentialsException("Invalid credentials");
        }

        if (!user.isEnabled()) {
            throw new BadCredentialsException("Invalid credentials");
        }

        if (!user.getRole().equals("ADMIN")) {
            com.hacksmc.entity.SystemSettings settings = maintenanceService.getSettings();
            if (settings.isSiteMaintenance()) {
                throw new com.hacksmc.exception.MaintenanceException(settings.getSiteMaintenanceMessage());
            }
        }

        auditLogService.log(user.getUsername(), "LOGIN", null, null);
        String token = jwtUtil.generateToken(user.getUsername(), user.getRole());
        return new LoginResponse(token, user.getUsername(), user.getRole());
    }

    @Transactional
    public void changePassword(String username, ChangePasswordRequest req) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new BadCredentialsException("User not found"));
        if (!passwordEncoder.matches(req.currentPassword(), user.getPasswordHash())) {
            throw new BadCredentialsException("Current password is incorrect");
        }
        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        userRepository.save(user);
    }
}
